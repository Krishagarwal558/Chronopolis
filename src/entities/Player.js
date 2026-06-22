import Phaser from 'phaser';
import { directionFromVector, getCharacterFrame, walkingStep } from '../utils/spriteFrames.js';

const PLAYER_SPEED = 180;
const PLAYER_SPRITE_INDEX = 6;
const CHARACTER_SCALE = 0.5;
const BODY_WIDTH = 24;
const BODY_HEIGHT = 18;
const BODY_OFFSET_X = 28;
const BODY_OFFSET_Y = 92;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, textureKey, frame = getCharacterFrame(PLAYER_SPRITE_INDEX)) {
    super(scene, x, y, textureKey, frame);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.spriteIndex = PLAYER_SPRITE_INDEX;
    this.facing = 'down';
    this.walkElapsed = 0;

    this.setDepth(20);
    this.setOrigin(0.5, 0.9);
    this.setScale(CHARACTER_SCALE);
    this.body.setSize(BODY_WIDTH, BODY_HEIGHT);
    this.body.setOffset(BODY_OFFSET_X, BODY_OFFSET_Y);
    this.body.setCollideWorldBounds(true);
  }

  update(input, delta = 0) {
    const movement = new Phaser.Math.Vector2(0, 0);

    if (input.left?.isDown || input.a?.isDown) {
      movement.x -= 1;
    }

    if (input.right?.isDown || input.d?.isDown) {
      movement.x += 1;
    }

    if (input.up?.isDown || input.w?.isDown) {
      movement.y -= 1;
    }

    if (input.down?.isDown || input.s?.isDown) {
      movement.y += 1;
    }

    if (movement.lengthSq() > 0) {
      movement.normalize().scale(PLAYER_SPEED);
      this.facing = directionFromVector(movement.x, movement.y, this.facing);
      this.walkElapsed += delta;
      this.setFrame(getCharacterFrame(this.spriteIndex, this.facing, walkingStep(this.walkElapsed)));
    } else {
      this.walkElapsed = 0;
      this.setFrame(getCharacterFrame(this.spriteIndex, this.facing, 1));
    }

    this.body.setVelocity(movement.x, movement.y);
  }
}
