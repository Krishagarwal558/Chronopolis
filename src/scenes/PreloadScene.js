import Phaser from 'phaser';

const ASSET_KEYS = {
  map: 'chronopolis-map',
  tiles: 'chronopolis-tiles',
  maleNpcs: 'male-npcs',
  femaleNpcs: 'female-npcs',
  childNpcs: 'child-npcs'
};

const ASSET_PATHS = {
  map: '/assets/maps/chronopolis.tmx',
  tiles: '/assets/maps/tilemap_packed.png',
  maleNpcs: '/assets/npcs/Generic Male NPCs.png',
  femaleNpcs: '/assets/npcs/Generic Female NPCs.png',
  childNpcs: '/assets/npcs/Generic Children NPCs.png'
};

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Loading Chronopolis...', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8fafc'
      })
      .setOrigin(0.5);

    const failures = [];
    this.load.on('loaderror', (file) => {
      failures.push(file.src || file.url || file.key);
    });

    this.registry.set('assetKeys', ASSET_KEYS);
    this.load.xml(ASSET_KEYS.map, ASSET_PATHS.map);
    this.load.image(ASSET_KEYS.tiles, ASSET_PATHS.tiles);
    this.load.spritesheet(ASSET_KEYS.maleNpcs, ASSET_PATHS.maleNpcs, {
      frameWidth: 80,
      frameHeight: 120
    });
    this.load.spritesheet(ASSET_KEYS.femaleNpcs, ASSET_PATHS.femaleNpcs, {
      frameWidth: 80,
      frameHeight: 120
    });
    this.load.spritesheet(ASSET_KEYS.childNpcs, ASSET_PATHS.childNpcs, {
      frameWidth: 80,
      frameHeight: 120
    });

    this.load.once('complete', () => {
      this.registry.set('assetFailures', failures);
      label.setText('Entering Chronopolis...');
    });
  }

  create() {
    Object.values(ASSET_KEYS).forEach((key) => {
      const texture = this.textures.get(key);
      if (texture && texture.key !== '__MISSING') {
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    this.scene.start('TownScene');
  }
}
