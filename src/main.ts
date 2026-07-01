import { r00_test } from './data/rooms/r00_test';
import type { RoomDef, SpriteSheetDef } from './data/types';
import { Game } from './engine/game';
import { RoomScene } from './engine/room';

/**
 * Player sprite sheet. The frame layout matches the placeholder generator's
 * convention (and the convention real art must follow): 3 columns x 3 rows,
 * rows = down/up/right, column 0 = idle, columns 1-2 = walk poses.
 * Left-facing reuses the right-facing frames mirrored.
 */
const carlSheet: SpriteSheetDef = {
  path: 'sprites/carl.png',
  frameW: 24,
  frameH: 32,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    walk_down: { frames: [1, 0, 2, 0], frameMs: 140, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    walk_up: { frames: [4, 3, 5, 3], frameMs: 140, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
    walk_right: { frames: [7, 6, 8, 6], frameMs: 140, loop: true },
  },
};

const rooms: Record<string, RoomDef> = {
  [r00_test.id]: r00_test,
};

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) throw new Error('Missing #game canvas');

  const game = new Game(canvas);
  const scene = new RoomScene(game, rooms, {
    label: 'CARL',
    color: '#f2a65a',
    sheet: carlSheet,
  });
  await scene.enterRoom('r00_test');
  game.pushScene(scene);
  game.start();
}

void boot();
