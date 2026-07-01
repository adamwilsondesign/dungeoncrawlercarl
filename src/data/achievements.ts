/**
 * Achievement registry. Earned state is the flag ach:<id> in GameState (so
 * it saves for free); the panel shows locked entries dimmed and hidden ones
 * as ??? until earned.
 */

import type { AchievementDef } from './types';

export const achievements: Record<string, AchievementDef> = {
  lever_puller: {
    id: 'lever_puller',
    name: 'LEVER PULLER',
    description: 'You were told not to. Everyone is told not to.',
  },
  hatch_toucher: {
    id: 'hatch_toucher',
    name: 'HATCH TOUCHER',
    description: 'You touched the hatch. The hatch has filed a complaint.',
  },
  first_death: {
    id: 'first_death',
    name: 'FRESH MEAT',
    description: 'Died once. Statistically inevitable. Emotionally? Still funny.',
    hidden: true,
  },
};
