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
  blooded: {
    id: 'blooded',
    name: 'PROPERLY BLOODED',
    description: 'Your first real fight. The rats respected the effort, briefly.',
  },
  trash_taker: {
    id: 'trash_taker',
    name: 'TOOK OUT THE TRASH',
    description: 'Neighborhood boss defeated. The pile has a new manager: nobody.',
  },
  prime_time: {
    id: 'prime_time',
    name: 'PRIME TIME',
    description: 'You premiered. The galaxy is watching. Wave, or do not. They love both.',
  },
  chemist: {
    id: 'chemist',
    name: 'APPLIED CHEMISTRY',
    description: 'Assembled a charge from yard scraps. Your teachers would be proud, then arrested.',
  },
  regime_change: {
    id: 'regime_change',
    name: 'REGIME CHANGE',
    description: 'The War Chieftain signed for one delivery. Management thanks you for the vacancy.',
  },
  wholesale: {
    id: 'wholesale',
    name: 'WHOLESALE',
    description: 'Retail violence is for lesser crawlers. You went wholesale. The audience is still cheering.',
  },
  first_death: {
    id: 'first_death',
    name: 'FRESH MEAT',
    description: 'Died once. Statistically inevitable. Emotionally? Still funny.',
    hidden: true,
  },
};
