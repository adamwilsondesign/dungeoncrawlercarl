import { achievements } from './data/achievements';
import { characters } from './data/characters';
import { combatants } from './data/combatants';
import { cutscenes } from './data/cutscenes';
import { dialogues } from './data/dialogues';
import { encounters } from './data/encounters';
import { items } from './data/items';
import { r00_test } from './data/rooms/r00_test';
import { r01_street } from './data/rooms/r01_street';
import { r02_descent } from './data/rooms/r02_descent';
import { r03_entrance } from './data/rooms/r03_entrance';
import { r04_guild } from './data/rooms/r04_guild';
import { r05_act2_stub } from './data/rooms/r05_act2_stub';
import { skills } from './data/skills';
import type { RoomDef, SpriteSheetDef } from './data/types';
import { Game } from './engine/game';
import { AchievementsScene, ListMenuScene, TitleScene } from './engine/menus';
import { RoomScene } from './engine/room';
import { formatPlaytime, formatTimestamp, MANUAL_SLOTS, readSave, type SaveSlot } from './engine/saves';
import { GameState } from './engine/state';

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
  [r01_street.id]: r01_street,
  [r02_descent.id]: r02_descent,
  [r03_entrance.id]: r03_entrance,
  [r04_guild.id]: r04_guild,
  [r05_act2_stub.id]: r05_act2_stub,
  // Engine proving ground from P1-P5; unreachable in Act I but kept
  // registered so old saves and regression checks still load.
  [r00_test.id]: r00_test,
};

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) throw new Error('Missing #game canvas');

  const game = new Game(canvas);
  const state = new GameState();

  let titleScene: TitleScene;

  const roomScene = new RoomScene(
    game,
    {
      rooms,
      player: { label: 'CARL', color: '#f2a65a', sheet: carlSheet },
      characters,
      dialogues,
      items,
      cutscenes,
      achievements,
      skills,
      combatants,
      encounters,
      startRoom: r01_street.id,
    },
    state,
    { quitToTitle: () => game.resetTo(titleScene) },
  );

  const openTitleLoadMenu = (): void => {
    const slots: SaveSlot[] = ['auto', ...MANUAL_SLOTS];
    game.pushScene(
      new ListMenuScene(game, {
        title: 'LOAD GAME',
        items: slots.map((slot) => {
          const file = readSave(slot);
          return {
            label: slot === 'auto' ? 'AUTOSAVE' : `SLOT ${slot}`,
            sub: file
              ? `${file.roomLabel} - ${formatTimestamp(file.savedAt)} - ${formatPlaytime(file.playtimeMs)}`
              : 'EMPTY',
            disabled: !file,
          };
        }),
        footer: 'ESC: BACK',
        onPick: (i) => {
          game.resetTo(roomScene);
          void roomScene.loadSlot(slots[i]);
        },
        onCancel: () => game.popScene(),
      }),
    );
  };

  titleScene = new TitleScene(game, {
    canContinue: () => readSave('auto') !== null,
    onNewGame: () => {
      game.resetTo(roomScene);
      void roomScene.startNewGame();
    },
    onContinue: () => {
      game.resetTo(roomScene);
      void roomScene.continueFromAutosave().then((ok) => {
        if (!ok) void roomScene.startNewGame();
      });
    },
    onSettings: () => {
      game.pushScene(
        new ListMenuScene(game, {
          title: 'SETTINGS',
          items: [{ label: 'LOAD GAME' }, { label: 'ACHIEVEMENTS' }, { label: 'BACK' }],
          footer: 'ESC: BACK',
          onPick: (i) => {
            if (i === 0) openTitleLoadMenu();
            else if (i === 1) game.pushScene(new AchievementsScene(game, achievements, state));
            else game.popScene();
          },
          onCancel: () => game.popScene(),
        }),
      );
    },
  });

  game.pushScene(titleScene);
  game.start();
}

boot();
