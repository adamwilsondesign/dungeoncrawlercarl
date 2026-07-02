/**
 * Achievement registry. Earned state is the flag ach:<id> in GameState (so
 * it saves for free); the panel shows locked entries dimmed and hidden ones
 * as ??? until earned.
 */

import type { AchievementDef } from './types';

export const achievements: Record<string, AchievementDef> = {
  fashion_victim: {
    id: 'fashion_victim',
    name: 'FASHION VICTIM',
    description: 'You looked at yourself. During an apocalypse. Priorities noted.',
  },
  first_steps: {
    id: 'first_steps',
    name: 'DOWN THE STAIRS',
    description: 'You descended. Statistically speaking, you should not have.',
  },
  guild_member: {
    id: 'guild_member',
    name: 'ORIENTATION COMPLETE',
    description: 'You found the tutorial guild before something found you.',
  },
  royal_court: {
    id: 'royal_court',
    name: 'THE ROYAL COURT',
    description: 'Party formed. Leadership structure: contested. Cat: in charge.',
  },
  first_death: {
    id: 'first_death',
    name: 'FRESH MEAT',
    description: 'Died once. Statistically inevitable. Emotionally? Still funny.',
    hidden: true,
  },
};
