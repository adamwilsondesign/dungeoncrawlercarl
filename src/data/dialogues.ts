/**
 * Dialogue tree registry (looked up by startDialogue(treeId), like rooms).
 * Hub-and-spoke Sierra model: intro lines, then a topic menu whose options
 * come and go with flags ('showIf') or after being asked ('once').
 */

import { giveItem } from './script';
import type { DialogueTree } from './types';

const npcSurvivor: DialogueTree = {
  id: 'npc_survivor',
  entry: 'intro',
  nodes: {
    intro: {
      lines: [
        { speakerId: 'npc', text: 'Oh good, a new one. Do not pull the lever. Everyone pulls the lever.' },
        { speakerId: 'npc', text: 'You are going to pull the lever, are you not.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'Who are you?', goto: 'who', once: true },
        { text: 'What is this place?', goto: 'place' },
        { text: 'About that lever...', goto: 'lever', showIf: { flag: 'r00.lever_pulled' } },
        { text: 'Got anything useful?', goto: 'gift', once: true },
        { text: 'Goodbye.', goto: 'bye' },
      ],
    },
    who: {
      lines: [
        { speakerId: 'npc', text: 'Nobody. I was somebody upstairs. Down here I am a cautionary tale with legs.' },
        { speakerId: 'donut', text: 'He smells like lever-puller. They always smell like lever-puller.', expression: 'smug' },
        { speakerId: 'npc', text: 'Your cat is very rude.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    place: {
      lines: [
        { speakerId: 'npc', text: 'A test chamber. The dungeon warms you up before it gets creative.' },
        { speakerId: 'npc', text: 'Touch things. It likes that. It likes it a little too much.' },
      ],
      goto: 'hub',
    },
    lever: {
      lines: [
        { speakerId: 'npc', text: 'You pulled it. Of course you pulled it.', expression: 'worried' },
        { speakerId: 'npc', text: 'Whatever that hatch leads to, it heard the clunk. It knows you are coming.' },
      ],
      goto: 'hub',
    },
    gift: {
      lines: [
        { speakerId: 'npc', text: 'Take this key. It opens something around here. I never had the nerve to learn what.' },
      ],
      goto: 'gift_give',
    },
    gift_give: {
      onEnter: [giveItem('rusty_key')],
      lines: [],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'npc', text: 'Good luck, Crawler. Statistically you will need all of it.' },
      ],
      goto: 'end',
    },
  },
};

export const dialogues: Record<string, DialogueTree> = {
  [npcSurvivor.id]: npcSurvivor,
};
