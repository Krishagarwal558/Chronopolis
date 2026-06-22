import Phaser from 'phaser';

const SHEET_COLUMNS = 12;
const CHARACTER_COLUMNS = 4;
const CHARACTER_WIDTH = 3;
const CHARACTER_HEIGHT = 4;

export const DIRECTIONS = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

export function getCharacterFrame(characterIndex = 0, direction = 'down', step = 1) {
  const normalizedIndex = Math.max(0, Number(characterIndex) || 0);
  const blockColumn = (normalizedIndex % CHARACTER_COLUMNS) * CHARACTER_WIDTH;
  const blockRow = Math.floor(normalizedIndex / CHARACTER_COLUMNS) * CHARACTER_HEIGHT;
  const directionRow = DIRECTIONS[direction] ?? DIRECTIONS.down;
  const animationStep = Phaser.Math.Clamp(Number(step) || 0, 0, CHARACTER_WIDTH - 1);

  return (blockRow + directionRow) * SHEET_COLUMNS + blockColumn + animationStep;
}

export function directionFromVector(x, y, fallback = 'down', options = {}) {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) {
    return fallback;
  }

  if (Math.abs(x) > Math.abs(y)) {
    return x > 0 ? 'right' : 'left';
  }

  if (y < 0 && options.allowUp === false) {
    return 'down';
  }

  return y > 0 ? 'down' : 'up';
}

export function walkingStep(elapsed) {
  const cycle = [1, 0, 1, 2];
  return cycle[Math.floor(elapsed / 110) % cycle.length];
}
