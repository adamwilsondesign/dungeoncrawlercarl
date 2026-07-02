import { achievements } from './data/achievements';
import { characters } from './data/characters';
import { combatants } from './data/combatants';
import { combines } from './data/combines';
import { cutscenes } from './data/cutscenes';
import { dialogues } from './data/dialogues';
import { encounters } from './data/encounters';
import { items } from './data/items';
import { r00_test } from './data/rooms/r00_test';
import { r01_street } from './data/rooms/r01_street';
import { r02_descent } from './data/rooms/r02_descent';
import { r03_entrance } from './data/rooms/r03_entrance';
import { r04_guild } from './data/rooms/r04_guild';
import { r05_maze } from './data/rooms/r05_maze';
import { r05b_maze } from './data/rooms/r05b_maze';
import { r06_hoarder } from './data/rooms/r06_hoarder';
import { r07_moonburger } from './data/rooms/r07_moonburger';
import { r08_alcove } from './data/rooms/r08_alcove';
import { r09_approach } from './data/rooms/r09_approach';
import { r10_workshop } from './data/rooms/r10_workshop';
import { r11_aftermath } from './data/rooms/r11_aftermath';
import { r12_east } from './data/rooms/r12_east';
import { r13_meadowlark } from './data/rooms/r13_meadowlark';
import { r14_gym } from './data/rooms/r14_gym';
import { r15_training } from './data/rooms/r15_training';
import { r16_ring } from './data/rooms/r16_ring';
import { r17_stairs } from './data/rooms/r17_stairs';
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
  [r05_maze.id]: r05_maze,
  [r05b_maze.id]: r05b_maze,
  [r06_hoarder.id]: r06_hoarder,
  [r07_moonburger.id]: r07_moonburger,
  [r08_alcove.id]: r08_alcove,
  [r09_approach.id]: r09_approach,
  [r10_workshop.id]: r10_workshop,
  [r11_aftermath.id]: r11_aftermath,
  [r12_east.id]: r12_east,
  [r13_meadowlark.id]: r13_meadowlark,
  [r14_gym.id]: r14_gym,
  [r15_training.id]: r15_training,
  [r16_ring.id]: r16_ring,
  [r17_stairs.id]: r17_stairs,
  // Engine proving ground from P1-P5; unreachable in normal play but kept
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
      combines,
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
