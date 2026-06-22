import Phaser from 'phaser';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';
import { getState, interactNPC, tickTown } from '../services/apiClient.js';

const MAP_LAYERS = ['ground', 'roads', 'buildings', 'decorations'];
const OBJECT_LAYERS = {
  locations: 'locations',
  npcSpawn: 'npc_spawn'
};
const INTERACTION_RADIUS = 58;
const GID_MASK = 0x1fffffff;
const NON_COLLIDING_LOCATIONS = new Set(['park']);

export default class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
    this.npcs = new Map();
    this.tileLayers = {};
    this.collidableLayers = [];
    this.locationColliders = [];
    this.tickInFlight = false;
    this.questionInFlight = false;
    this.controlsLocked = false;
  }

  async create() {
    this.assetKeys = this.registry.get('assetKeys');
    this.mapLocations = [];
    this.mapNpcSpawns = [];

    this.createMap();
    this.createPlayer();
    this.createInput();
    this.configureCamera();

    this.scene.launch('UIScene');
    this.game.events.on('ui:questionSubmit', this.handleQuestionSubmit, this);
    this.game.events.on('ui:questionCancel', this.handleQuestionCancel, this);
    this.events.once('shutdown', () => {
      this.game.events.off('ui:questionSubmit', this.handleQuestionSubmit, this);
      this.game.events.off('ui:questionCancel', this.handleQuestionCancel, this);
    });

    await this.loadInitialState();

    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.tickFromBackend()
    });

    const failures = this.registry.get('assetFailures') || [];
    if (failures.length > 0) {
      this.game.events.emit('ui:notice', {
        title: 'Missing local assets',
        message:
          'Add the provided files under public/assets for the Tiled map and NPC sheets to render.'
      });
    }
  }

  createMap() {
    if (!this.prepareTilemapFromXml()) {
      this.physics.world.setBounds(0, 0, 1600, 1200);
      this.add
        .text(40, 80, 'Chronopolis assets not found', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#f8fafc'
        })
        .setDepth(1);
      return;
    }

    this.map = this.make.tilemap({ key: this.assetKeys.map });
    const tilesets = this.map.tilesets
      .map((tileset) => this.map.addTilesetImage(tileset.name, this.assetKeys.tiles))
      .filter(Boolean);

    MAP_LAYERS.forEach((layerName, index) => {
      const layerData = this.findLayerData(layerName);
      if (!layerData) {
        return;
      }

      const layer = this.map.createLayer(layerData.name, tilesets, 0, 0);
      layer?.setDepth(index);
      this.tileLayers[layerName] = layer;

      if (layer && ['buildings', 'decorations'].includes(layerName)) {
        layer.setCollisionByExclusion([-1]);
        this.collidableLayers.push(layer);
      }
    });

    this.mapLocations = this.serializeObjectLayer(OBJECT_LAYERS.locations);
    this.mapNpcSpawns = this.serializeObjectLayer(OBJECT_LAYERS.npcSpawn);

    this.physics.world.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels
    );
  }

  prepareTilemapFromXml() {
    if (!this.cache.xml.exists(this.assetKeys.map)) {
      return false;
    }

    const xml = this.cache.xml.get(this.assetKeys.map);
    const mapNode = xml.querySelector('map');
    const tileWidth = Number(mapNode?.getAttribute('tilewidth') || 32);
    const tileHeight = Number(mapNode?.getAttribute('tileheight') || 32);
    const texture = this.textures.get(this.assetKeys.tiles);
    const image = texture?.getSourceImage();

    if (!mapNode || !image?.width || !image?.height) {
      return false;
    }

    const tilesetNode = mapNode.querySelector('tileset');
    const tilesetSource = tilesetNode?.getAttribute('source') || 'tilemap_packed.tsx';
    const tilesetName = tilesetSource
      .split(/[\\/]/)
      .pop()
      .replace(/\.[^.]+$/, '');
    const columns = Math.max(1, Math.floor(image.width / tileWidth));
    const tilecount = columns * Math.max(1, Math.floor(image.height / tileHeight));
    const crop = this.computeTmxCrop(mapNode);
    const baseGroundGid = this.findDominantLayerGid(mapNode, 'ground') || 1;

    const mapJson = {
      version: mapNode.getAttribute('version') || '1.10',
      tiledversion: mapNode.getAttribute('tiledversion') || '',
      type: 'map',
      orientation: mapNode.getAttribute('orientation') || 'orthogonal',
      renderorder: mapNode.getAttribute('renderorder') || 'right-down',
      width: crop.width,
      height: crop.height,
      tilewidth: tileWidth,
      tileheight: tileHeight,
      infinite: mapNode.getAttribute('infinite') === '1',
      layers: this.convertTmxLayers(mapNode, crop, baseGroundGid),
      tilesets: [
        {
          firstgid: Number(tilesetNode?.getAttribute('firstgid') || 1),
          name: tilesetName,
          image: 'tilemap_packed.png',
          imagewidth: image.width,
          imageheight: image.height,
          tilewidth: tileWidth,
          tileheight: tileHeight,
          margin: 0,
          spacing: 0,
          columns,
          tilecount
        }
      ]
    };

    this.cache.tilemap.add(this.assetKeys.map, {
      format: Phaser.Tilemaps.Formats.TILED_JSON,
      data: mapJson
    });
    return true;
  }

  findDominantLayerGid(mapNode, layerName) {
    const targetName = layerName.toLowerCase();
    const counts = new Map();
    [...mapNode.querySelectorAll('layer')].forEach((layerNode) => {
      if ((layerNode.getAttribute('name') || '').toLowerCase() !== targetName) {
        return;
      }

      const dataText = layerNode.querySelector('data')?.textContent || '';
      dataText
        .split(',')
        .map((value) => Number(value.trim()) & GID_MASK)
        .filter(Boolean)
        .forEach((gid) => counts.set(gid, (counts.get(gid) || 0) + 1));
    });

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  }

  computeTmxCrop(mapNode) {
    const mapWidth = Number(mapNode.getAttribute('width') || 0);
    const mapHeight = Number(mapNode.getAttribute('height') || 0);
    const tileWidth = Number(mapNode.getAttribute('tilewidth') || 32);
    const tileHeight = Number(mapNode.getAttribute('tileheight') || 32);
    const margin = 3;
    let minColumn = mapWidth;
    let minRow = mapHeight;
    let maxColumn = -1;
    let maxRow = -1;

    [...mapNode.querySelectorAll('layer')].forEach((layerNode) => {
      const layerWidth = Number(layerNode.getAttribute('width') || mapWidth);
      const dataText = layerNode.querySelector('data')?.textContent || '';
      dataText
        .split(',')
        .map((value) => Number(value.trim()))
        .forEach((gid, index) => {
          if (!gid) {
            return;
          }

          const column = index % layerWidth;
          const row = Math.floor(index / layerWidth);
          minColumn = Math.min(minColumn, column);
          minRow = Math.min(minRow, row);
          maxColumn = Math.max(maxColumn, column);
          maxRow = Math.max(maxRow, row);
        });
    });

    [...mapNode.querySelectorAll('objectgroup object')].forEach((objectNode) => {
      const x = Number(objectNode.getAttribute('x') || 0);
      const y = Number(objectNode.getAttribute('y') || 0);
      const width = Number(objectNode.getAttribute('width') || 0);
      const height = Number(objectNode.getAttribute('height') || 0);
      minColumn = Math.min(minColumn, Math.floor(x / tileWidth));
      minRow = Math.min(minRow, Math.floor(y / tileHeight));
      maxColumn = Math.max(maxColumn, Math.ceil((x + width) / tileWidth));
      maxRow = Math.max(maxRow, Math.ceil((y + height) / tileHeight));
    });

    if (maxColumn < minColumn || maxRow < minRow) {
      return {
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight,
        pixelX: 0,
        pixelY: 0
      };
    }

    const x = Phaser.Math.Clamp(minColumn - margin, 0, mapWidth);
    const y = Phaser.Math.Clamp(minRow - margin, 0, mapHeight);
    const right = Phaser.Math.Clamp(maxColumn + margin + 1, x + 1, mapWidth);
    const bottom = Phaser.Math.Clamp(maxRow + margin + 1, y + 1, mapHeight);

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
      pixelX: x * tileWidth,
      pixelY: y * tileHeight
    };
  }

  convertTmxLayers(mapNode, crop, baseGroundGid) {
    return [...mapNode.children]
      .filter((node) => node.tagName === 'layer' || node.tagName === 'objectgroup')
      .map((node) => {
        if (node.tagName === 'layer') {
          const layerWidth = Number(node.getAttribute('width') || mapNode.getAttribute('width') || 0);
          const layerHeight = Number(node.getAttribute('height') || mapNode.getAttribute('height') || 0);
          const dataText = node.querySelector('data')?.textContent || '';
          const sourceData = dataText
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value));
          const croppedData = [];

          for (let row = crop.y; row < crop.y + crop.height; row += 1) {
            for (let column = crop.x; column < crop.x + crop.width; column += 1) {
              if (row >= 0 && row < layerHeight && column >= 0 && column < layerWidth) {
                const gid = (sourceData[row * layerWidth + column] || 0) & GID_MASK;
                croppedData.push(gid || (node.getAttribute('name') === 'ground' ? baseGroundGid : 0));
              } else {
                croppedData.push(node.getAttribute('name') === 'ground' ? baseGroundGid : 0);
              }
            }
          }

          return {
            id: Number(node.getAttribute('id') || 0),
            name: node.getAttribute('name') || 'layer',
            type: 'tilelayer',
            x: 0,
            y: 0,
            width: crop.width,
            height: crop.height,
            opacity: 1,
            visible: true,
            data: croppedData
          };
        }

        return {
          id: Number(node.getAttribute('id') || 0),
          name: node.getAttribute('name') || 'objects',
          type: 'objectgroup',
          x: 0,
          y: 0,
          opacity: 1,
          visible: true,
          objects: [...node.querySelectorAll('object')].map((objectNode) =>
            this.convertTmxObject(objectNode, crop)
          )
        };
      });
  }

  convertTmxObject(objectNode, crop) {
    return {
      id: Number(objectNode.getAttribute('id') || 0),
      name: objectNode.getAttribute('name') || '',
      type: objectNode.getAttribute('type') || '',
      x: Number(objectNode.getAttribute('x') || 0) - crop.pixelX,
      y: Number(objectNode.getAttribute('y') || 0) - crop.pixelY,
      width: Number(objectNode.getAttribute('width') || 0),
      height: Number(objectNode.getAttribute('height') || 0),
      rotation: Number(objectNode.getAttribute('rotation') || 0),
      visible: objectNode.getAttribute('visible') !== '0',
      properties: [...objectNode.querySelectorAll('properties > property')].map(
        (propertyNode) => ({
          name: propertyNode.getAttribute('name'),
          type: propertyNode.getAttribute('type') || 'string',
          value: propertyNode.getAttribute('value') ?? propertyNode.textContent ?? ''
        })
      )
    };
  }

  createPlayer() {
    const fallbackSpawn = this.getMapSpawnPoint();
    this.player = new Player(this, fallbackSpawn.x, fallbackSpawn.y, this.assetKeys.maleNpcs);
    this.collidableLayers.forEach((layer) => {
      this.physics.add.collider(this.player, layer);
    });
    this.createLocationColliders();
  }

  createLocationColliders() {
    this.locationColliders.forEach((collider) => collider.destroy());
    this.locationColliders = [];

    this.mapLocations
      .filter((location) => this.isSolidLocation(location))
      .forEach((location) => {
        const collider = this.add
          .rectangle(
            location.x + location.width / 2,
            location.y + location.height / 2,
            location.width,
            location.height,
            0xff0000,
            0
          )
          .setVisible(false);
        this.physics.add.existing(collider, true);
        this.physics.add.collider(this.player, collider);
        this.locationColliders.push(collider);
      });
  }

  isSolidLocation(location) {
    if (!location.name || location.width <= 0 || location.height <= 0) {
      return false;
    }

    const normalizedName = location.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !NON_COLLIDING_LOCATIONS.has(normalizedName);
  }

  getMapSpawnPoint() {
    const bounds = this.physics.world.bounds;
    const location =
      this.mapLocations.find(
        (item) => item.name?.toLowerCase() === 'park'
      ) || this.mapLocations[0];

    if (!location) {
      return {
        x: bounds.width / 2,
        y: bounds.height / 2
      };
    }

    return {
      x: location.x + (location.width || 0) / 2,
      y: location.y + (location.height || 0) / 2 + 56
    };
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      e: Phaser.Input.Keyboard.KeyCodes.E
    });
  }

  configureCamera() {
    const bounds = this.physics.world.bounds;
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.roundPixels = true;
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  async loadInitialState() {
    try {
      const state = await getState();
      this.applyState(state, true);
      this.placePlayerNearTown(state);
    } catch (error) {
      this.game.events.emit('ui:notice', {
        title: 'Backend offline',
        message: 'Start the Flask backend with npm run backend or npm run dev:full.'
      });
      this.game.events.emit('ui:state', {
        time: '--:--',
        case: {
          title: 'No backend state',
          knownClues: [],
          witnessStatements: []
        }
      });
      console.error(error);
    }
  }

  placePlayerNearTown(state) {
    const park = state.locations?.find(
      (location) => location.name?.toLowerCase() === 'park'
    );
    const firstLocation = park || state.locations?.[0];

    if (firstLocation) {
      this.player.setPosition(firstLocation.centerX, firstLocation.centerY + 56);
    }
  }

  async tickFromBackend() {
    if (this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;
    try {
      const state = await tickTown({ elapsedSeconds: 0.25 });
      this.applyState(state);
    } catch (error) {
      this.game.events.emit('ui:notice', {
        title: 'Tick failed',
        message: 'The Python simulation is not responding.'
      });
      console.error(error);
    } finally {
      this.tickInFlight = false;
    }
  }

  applyState(state, immediate = false) {
    if (state.mapSize) {
      const bounds = this.physics.world.bounds;
      const width = this.map?.widthInPixels || state.mapSize.width;
      const height = this.map?.heightInPixels || state.mapSize.height;
      if (bounds.width !== width || bounds.height !== height) {
        this.physics.world.setBounds(0, 0, width, height);
        this.cameras.main.setBounds(0, 0, width, height);
      }
    }

    const liveNames = new Set();
    state.npcs?.forEach((npcState) => {
      liveNames.add(npcState.name);
      const existing = this.npcs.get(npcState.name);

      if (existing) {
        existing.syncFromState(npcState, immediate);
      } else {
        const npc = new NPC(this, npcState);
        npc.syncFromState(npcState, true);
        this.physics.add.collider(this.player, npc);
        this.npcs.set(npcState.name, npc);
      }
    });

    [...this.npcs.entries()].forEach(([name, npc]) => {
      if (!liveNames.has(name)) {
        npc.destroy();
        this.npcs.delete(name);
      }
    });

    this.game.events.emit('ui:state', state);
  }

  update(time, delta) {
    if (this.controlsLocked) {
      this.player.body.setVelocity(0, 0);
    } else {
      this.player.update({ ...this.cursors, ...this.keys }, delta);
    }
    this.npcs.forEach((npc) => npc.update(delta));

    if (!this.controlsLocked && Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      this.tryInteract();
    }
  }

  tryInteract() {
    const npc = this.getNearestNPC();

    if (!npc) {
      this.game.events.emit('ui:interaction', {
        npcName: 'No one nearby',
        job: '',
        location: '',
        dialogue: 'Move closer to an NPC before questioning them.'
      });
      return;
    }

    this.controlsLocked = true;
    this.game.events.emit('ui:questionPrompt', {
      npcName: npc.name,
      job: npc.job,
      location: this.formatNpcMeta(npc)
    });
  }

  handleQuestionCancel() {
    this.controlsLocked = false;
  }

  async handleQuestionSubmit(data) {
    if (this.questionInFlight) {
      return;
    }

    const npc = this.npcs.get(data.npcName) || this.getNearestNPC();
    if (!npc) {
      this.controlsLocked = false;
      this.game.events.emit('ui:interaction', {
        npcName: 'No one nearby',
        job: '',
        location: '',
        dialogue: 'The person you meant to question is no longer nearby.'
      });
      return;
    }

    const question = data.question || 'What have you noticed today?';
    this.questionInFlight = true;
    this.game.events.emit('ui:interactionLoading', {
      npcName: npc.name,
      job: npc.job,
      location: [
        this.formatNpcMeta(npc),
        `Q: ${question}`
      ].filter(Boolean).join('\n')
    });

    try {
      const result = await interactNPC(
        npc.name,
        question
      );
      this.game.events.emit('ui:interaction', {
        npcName: result.npcName,
        job: result.job,
        location: this.formatResultMeta(result),
        dialogue: result.dialogue,
        clue: result.clue
      });
      this.game.events.emit('ui:case', result.case);
    } catch (error) {
      this.game.events.emit('ui:interaction', {
        npcName: npc.name,
        job: npc.job,
        location: this.formatNpcMeta(npc),
        dialogue: 'The conversation slips away. The backend did not answer.'
      });
      console.error(error);
    } finally {
      this.questionInFlight = false;
      this.controlsLocked = false;
    }
  }

  formatNpcMeta(npc) {
    const route = npc.currentLocation === npc.destination
      ? npc.currentLocation
      : `${npc.currentLocation} -> ${npc.destination}`;
    const next = npc.nextTime && npc.nextStop ? `next ${npc.nextTime}: ${npc.nextStop}` : '';
    return [npc.activity, route, next].filter(Boolean).join(' | ');
  }

  formatResultMeta(result) {
    const route = [result.currentLocation, result.destination].filter(Boolean).join(' -> ');
    const next = result.nextTime && result.nextStop ? `next ${result.nextTime}: ${result.nextStop}` : '';
    const stats = result.mood
      ? `${result.mood} | suspicion ${result.suspicion} | rapport ${result.rapport}`
      : '';
    const question = result.playerQuestion ? `Q: ${result.playerQuestion}` : '';
    return [
      [result.activity, route].filter(Boolean).join(' | '),
      [next, stats].filter(Boolean).join(' | '),
      question
    ].filter(Boolean).join('\n');
  }

  getNearestNPC() {
    let closest = null;
    let closestDistance = INTERACTION_RADIUS;

    this.npcs.forEach((npc) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        npc.x,
        npc.y
      );
      if (distance <= closestDistance) {
        closest = npc;
        closestDistance = distance;
      }
    });

    return closest;
  }

  findLayerData(targetName) {
    return this.map.layers.find(
      (layer) => layer.name.toLowerCase() === targetName.toLowerCase()
    );
  }

  serializeObjectLayer(targetName) {
    const layer = this.map.objects.find(
      (objectLayer) => objectLayer.name.toLowerCase() === targetName.toLowerCase()
    );

    return (layer?.objects || [])
      .filter((object) => object.name && object.width > 0 && object.height > 0)
      .map((object) => ({
        name: object.name,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        properties: object.properties || []
      }));
  }
}
