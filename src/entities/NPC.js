import Phaser from 'phaser';
import { directionFromVector, getCharacterFrame, walkingStep } from '../utils/spriteFrames.js';

const SHEET_KEYS = {
  male: 'male-npcs',
  female: 'female-npcs',
  child: 'child-npcs'
};
const CHARACTER_SCALE = 0.5;
const BODY_WIDTH = 24;
const BODY_HEIGHT = 18;
const BODY_OFFSET_X = 28;
const BODY_OFFSET_Y = 92;
const LABEL_OFFSET_Y = -64;
const NPC_RENDER_SPEED = 72;

export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, npcState) {
    const textureKey = SHEET_KEYS[npcState.spriteSheet] || SHEET_KEYS.male;
    const spriteIndex = Number(npcState.spriteIndex) || 0;
    super(scene, npcState.x, npcState.y, textureKey, getCharacterFrame(spriteIndex));

    this.name = npcState.name;
    this.job = npcState.job;
    this.currentLocation = npcState.currentLocation;
    this.destination = npcState.destination;
    this.activity = npcState.activity;
    this.nextStop = npcState.nextStop;
    this.nextTime = npcState.nextTime;
    this.isMoving = npcState.isMoving;
    this.spriteIndex = spriteIndex;
    this.facing = 'down';
    this.walkElapsed = 0;
    this.targetX = npcState.x;
    this.targetY = npcState.y;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(18 + this.y / 1000);
    this.setOrigin(0.5, 0.9);
    this.setScale(CHARACTER_SCALE);
    this.body.setSize(BODY_WIDTH, BODY_HEIGHT);
    this.body.setOffset(BODY_OFFSET_X, BODY_OFFSET_Y);
    this.body.setCollideWorldBounds(true);
    this.body.setImmovable(true);
    this.body.pushable = false;

    this.label = scene.add
      .text(npcState.x, npcState.y + LABEL_OFFSET_Y, this.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f8fafc',
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        padding: { x: 4, y: 2 }
      })
      .setOrigin(0.5, 1)
      .setDepth(30);
  }

  syncFromState(npcState, immediate = false) {
    this.job = npcState.job;
    this.currentLocation = npcState.currentLocation;
    this.destination = npcState.destination;
    this.activity = npcState.activity;
    this.nextStop = npcState.nextStop;
    this.nextTime = npcState.nextTime;
    this.isMoving = npcState.isMoving;
    this.targetX = npcState.x;
    this.targetY = npcState.y;

    if (immediate) {
      this.setPosition(this.targetX, this.targetY);
    }
  }

  update(delta) {
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetX,
      this.targetY
    );

    if (distance > 1) {
      const step = Math.min(distance, (delta / 1000) * NPC_RENDER_SPEED);
      const direction = new Phaser.Math.Vector2(
        this.targetX - this.x,
        this.targetY - this.y
      )
        .normalize()
        .scale(step);
      this.setPosition(this.x + direction.x, this.y + direction.y);
      this.facing = directionFromVector(direction.x, direction.y, this.facing);
      this.walkElapsed += delta;
      this.setFrame(getCharacterFrame(this.spriteIndex, this.facing, walkingStep(this.walkElapsed)));
    } else {
      this.setPosition(this.targetX, this.targetY);
      this.walkElapsed = 0;
      this.facing = 'down';
      this.setFrame(getCharacterFrame(this.spriteIndex, this.facing, 1));
    }

    this.setDepth(18 + this.y / 1000);
    this.label.setPosition(Math.round(this.x), Math.round(this.y + LABEL_OFFSET_Y));
  }

  getLocationLabel() {
    const route = this.currentLocation === this.destination
      ? this.currentLocation
      : `${this.currentLocation} -> ${this.destination}`;

    if (this.nextStop && this.nextTime) {
      return `${route} | next ${this.nextTime}: ${this.nextStop}`;
    }

    return route;
  }

  destroy(fromScene) {
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
