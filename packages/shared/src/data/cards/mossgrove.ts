import type { Card } from '../../model/card.js';
import { defineRealmCards } from './define.js';

/** Mossgrove (MOS): mushrooms, hedgehogs, snails, beetles. Identity: regen, thorns (GDD §3). */
export const MOSSGROVE_CARDS: readonly Card[] = defineRealmCards('mossgrove', [
  {
    n: 1,
    name: 'Pebble Snail',
    rarity: 'common',
    atk: 1,
    hp: 7,
    abilities: [{ trigger: 'onEnter', effect: 'shield', target: 'self', value: 2 }],
    flavour: 'Slow, steady, and never once late for tea.',
    artPrompt:
      'a small round snail with a smooth grey pebble shell speckled with moss, sleepy smiling eyes on short stalks',
  },
  {
    n: 2,
    name: 'Button Cap',
    rarity: 'common',
    atk: 2,
    hp: 6,
    abilities: [{ trigger: 'support', effect: 'heal', target: 'front', value: 1, every: 3 }],
    flavour: 'A tiny mushroom with a very big habit of fussing over friends.',
    artPrompt:
      'a tiny walking mushroom with a round berry-red cap with cream spots, stubby legs, holding a leaf like a bandage',
  },
  {
    n: 3,
    name: 'Burr Hoglet',
    rarity: 'common',
    atk: 3,
    hp: 5,
    abilities: [{ trigger: 'onEnter', effect: 'thorns', target: 'self', value: 1 }],
    flavour: 'Hugs are free. Prickles are included.',
    artPrompt:
      'a baby hedgehog curled halfway into a ball, soft brown spines with a few burrs stuck in them, tiny pink nose',
  },
  {
    n: 4,
    name: 'Acorn Beetle',
    rarity: 'common',
    atk: 5,
    hp: 3,
    abilities: [{ trigger: 'onHurt', effect: 'buffAtk', target: 'self', value: 1 }],
    flavour: 'Wears an acorn cap like a helmet, and means it.',
    artPrompt:
      'a stout round beetle with a glossy bark-brown shell, wearing an acorn cap as a helmet, determined little face',
  },
  {
    n: 5,
    name: 'Lantern Shroom',
    rarity: 'uncommon',
    atk: 2,
    hp: 7,
    abilities: [{ trigger: 'onFaint', effect: 'heal', target: 'allAllies', value: 2 }],
    flavour: 'It glows brightest right at the very end.',
    artPrompt:
      'a tall slender mushroom with a softly glowing pale-green bell cap and a kind sleepy face on its stem, holding a small glowing lantern by its handle in one little hand',
  },
  {
    n: 6,
    name: 'Thistle Hedgehog',
    rarity: 'uncommon',
    atk: 4,
    hp: 5,
    abilities: [{ trigger: 'onEnter', effect: 'thorns', target: 'self', value: 2 }],
    flavour: 'Grows a purple thistle on its back every spring, out of pure spite.',
    artPrompt:
      'a round little hedgehog standing on its hind legs in a brave boxing pose with tiny fists raised, a neat crown of brown spines each tipped with a small purple thistle blossom, determined smile',
  },
  {
    n: 7,
    name: 'Snug Rolypoly',
    rarity: 'uncommon',
    atk: 3,
    hp: 6,
    abilities: [{ trigger: 'onHurt', effect: 'regen', target: 'self', value: 1 }],
    flavour: 'Curls up, counts to ten, feels much better.',
    artPrompt:
      'a chubby pill bug with segmented slate-blue armour plates, half curled up, peeking out with a content smile',
  },
  {
    n: 8,
    name: 'Toadstool Elder',
    rarity: 'rare',
    atk: 2,
    hp: 8,
    abilities: [{ trigger: 'support', effect: 'heal', target: 'allAllies', value: 1, every: 3 }],
    flavour: 'Has given the same good advice for three hundred years.',
    artPrompt:
      'an old wise toadstool with a wide drooping red cap, long white moss beard, leaning on a twig walking stick',
  },
  {
    n: 9,
    name: 'Briar Stag Beetle',
    rarity: 'rare',
    atk: 6,
    hp: 4,
    abilities: [
      { trigger: 'onEnter', effect: 'thorns', target: 'self', value: 2 },
      { trigger: 'onHurt', effect: 'buffAtk', target: 'self', value: 1 },
    ],
    flavour: 'Its antlers are bramble. Its temper is worse.',
    artPrompt:
      'a stag beetle with a dark bark-brown shell and large antler jaws made of thorny bramble with small berries',
  },
  {
    n: 10,
    name: 'Moss-Coat Snail',
    rarity: 'epic',
    atk: 2,
    hp: 9,
    abilities: [
      { trigger: 'startOfBattle', effect: 'shield', target: 'allAllies', value: 2 },
      { trigger: 'onHurt', effect: 'regen', target: 'self', value: 1 },
    ],
    flavour: 'Carries a whole little garden on its back, and shares it.',
    artPrompt:
      'a large gentle snail whose shell is covered in a thick moss coat with tiny ferns and white flowers growing on it',
  },
  {
    n: 11,
    name: 'Bramblemum',
    rarity: 'epic',
    atk: 5,
    hp: 6,
    abilities: [
      { trigger: 'startOfBattle', effect: 'thorns', target: 'allAllies', value: 1 },
      { trigger: 'onAllyFaint', effect: 'buffAtk', target: 'self', value: 2 },
    ],
    flavour: 'Knits thorny jumpers for every hoglet in the grove.',
    artPrompt:
      'a motherly hedgehog with bramble spines, wearing a knitted berry-red shawl, holding knitting needles and yarn',
  },
  {
    n: 12,
    name: 'Grandmother Morel',
    rarity: 'legendary',
    atk: 3,
    hp: 9,
    abilities: [
      { trigger: 'startOfBattle', effect: 'regen', target: 'allAllies', value: 1 },
      { trigger: 'onFaint', effect: 'heal', target: 'allAllies', value: 3 },
    ],
    flavour: 'When she hums, the whole forest floor remembers how to grow.',
    artPrompt:
      'an ancient morel mushroom with a tall honeycombed tan cap, round spectacles, a shawl of moss, glowing spores around her',
  },
  {
    n: 13,
    name: 'Old Thornback',
    rarity: 'mythic',
    atk: 6,
    hp: 7,
    abilities: [
      { trigger: 'onEnter', effect: 'thorns', target: 'allAllies', value: 2 },
      { trigger: 'onHurt', effect: 'regen', target: 'self', value: 2 },
    ],
    flavour: 'The hedge that walks. Villages plant themselves along its path.',
    artPrompt:
      'a huge ancient hedgehog with a whole hedgerow of thorny branches, berries and tiny flowers growing from its back, wise old eyes',
  },
]);
