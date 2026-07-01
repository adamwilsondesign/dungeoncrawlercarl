/**
 * The KQ5-style verb system: verb order/cycling, per-verb cursors, and the
 * default narrator responses — written in the dungeon-AI voice (dry, smug,
 * faintly menacing game-show patter). All later content matches this tone.
 */

import type { ActionVerb } from '../data/types';
import { loadImage, type LoadedImage } from './assets';

export type Verb = 'walk' | ActionVerb;

export const VERB_ORDER: readonly Verb[] = ['walk', 'look', 'hand', 'talk', 'item'];

export function nextVerb(verb: Verb): Verb {
  const i = VERB_ORDER.indexOf(verb);
  return VERB_ORDER[(i + 1) % VERB_ORDER.length];
}

/** Cursor images per verb, real art from ui/cursor_<verb>.png or generated. */
export async function loadCursors(): Promise<Record<Verb, LoadedImage>> {
  const entries = await Promise.all(
    VERB_ORDER.map(
      async (v) => [v, await loadImage(`ui/cursor_${v}.png`, { kind: 'cursor', glyph: v })] as const,
    ),
  );
  const cursors = {} as Record<Verb, LoadedImage>;
  for (const [verb, image] of entries) cursors[verb] = image;
  return cursors;
}

// ---------------------------------------------------------------------------
// Default narrator lines (the dungeon AI voice)
// ---------------------------------------------------------------------------

const cycleCounters: Record<string, number> = {};

function cycleLine(key: string, lines: readonly string[]): string {
  const i = cycleCounters[key] ?? 0;
  cycleCounters[key] = i + 1;
  return lines[i % lines.length];
}

const EMPTY_CLICK: Record<ActionVerb, readonly string[]> = {
  look: [
    'Scenery. The dungeon spent literal minutes on it. Move along.',
    'You stare at nothing. Nothing stares back. Very mutual.',
    "Nothing there. The good stuff is clearly marked. Mostly.",
  ],
  hand: [
    'You grab a fistful of air. The air remains unimpressed.',
    'No. Touch something interesting. The viewers are bored.',
    'That is not a thing. Interact with actual things, Crawler.',
  ],
  talk: [
    'You address the room. The room declines to comment.',
    'Talking to nobody already? That usually takes a full week.',
  ],
  item: [
    "You're not holding anything. Bold tactical choice.",
    'Item? What item? Your hands are tragically empty.',
  ],
};

const UNHANDLED: Record<ActionVerb, ReadonlyArray<(name: string) => string>> = {
  look: [
    (n) => `It's the ${n}. It is exactly what it looks like.`,
    (n) => `The ${n}. Fascinating. To someone, probably.`,
  ],
  hand: [
    (n) => `You pat the ${n}. Deeply satisfying. Nothing happens.`,
    (n) => `The ${n} resists your groping. Wise.`,
  ],
  talk: [
    (n) => `The ${n} says nothing. It's a ${n}.`,
    (n) => `You chat up the ${n}. Riveting one-sided stuff.`,
  ],
  item: [(n) => `That doesn't work on the ${n}. Nice try though.`],
};

/** Default line for clicking empty space with a non-walk verb. */
export function emptyClickLine(verb: ActionVerb): string {
  return cycleLine(`empty:${verb}`, EMPTY_CLICK[verb]);
}

/** Default line for a hotspot that has no handler for the active verb. */
export function unhandledLine(verb: ActionVerb, name: string): string {
  const templates = UNHANDLED[verb];
  const i = cycleCounters[`unhandled:${verb}`] ?? 0;
  cycleCounters[`unhandled:${verb}`] = i + 1;
  return templates[i % templates.length](name);
}

/** ITEM verb with no inventory item selected (inventory itself is P3). */
export function noItemLine(): string {
  return cycleLine('noitem', EMPTY_CLICK.item);
}

export const INVENTORY_LINE = 'Your inventory is empty. The audience finds this hilarious.';

export const SETTINGS_LINE =
  'Settings. Adorable. The dungeon is not currently accepting configuration requests.';

export function achievementLine(id: string): string {
  return `NEW ACHIEVEMENT: ${id.toUpperCase()}! Reward: our continued attention. Congratulations, Crawler.`;
}

/** giveItem confirmation, with the running count for stackables. */
export function acquiredLine(name: string, count: number): string {
  return count > 1
    ? `ACQUIRED: ${name.toUpperCase()} (X${count}). Hoarding already. The audience approves.`
    : `ACQUIRED: ${name.toUpperCase()}. Try not to lose it immediately.`;
}

/** Held item used on a hotspot with no matching handler and no default. */
export function wrongItemLine(itemName: string, targetName: string): string {
  return cycleLine('wrongitem', [
    `The ${itemName} accomplishes nothing against the ${targetName}. Zero points awarded.`,
    `Interesting theory. The ${targetName} disagrees with your ${itemName}.`,
  ]);
}

/** Held item clicked on empty space. */
export function itemOnNothingLine(itemName: string): string {
  return cycleLine('itemnothing', [
    `You brandish the ${itemName} at empty air. Menacing. Pointless.`,
    `The ${itemName} is not a wand, Crawler. Aim it at something.`,
  ]);
}
