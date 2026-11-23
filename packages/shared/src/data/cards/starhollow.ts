import type { Card } from '../../model/card.js';
import { defineRealmCards } from './define.js';

/**
 * Starhollow (STA): moths, wisps, sleepy night beasts. Identity: debuffs, ally-faint synergy
 * (GDD §3).
 */
export const STARHOLLOW_CARDS: readonly Card[] = defineRealmCards('starhollow', [
  {
    n: 1,
    name: 'Dusk Moth',
    rarity: 'common',
    atk: 3,
    hp: 5,
    abilities: [{ trigger: 'onEnter', effect: 'weaken', target: 'enemyFront', value: 1 }],
    flavour: 'Its wingbeats hum a lullaby nobody asked for.',
    artPrompt:
      'a small fluffy moth with dusky lilac wings with silver eye spots, big dark sleepy eyes, feathery antennae',
  },
  {
    n: 2,
    name: 'Pillow Wisp',
    rarity: 'common',
    atk: 2,
    hp: 6,
    abilities: [{ trigger: 'onFaint', effect: 'buffHp', target: 'behind', value: 2 }],
    flavour: 'Pops softly, and leaves a warm spot for a friend.',
    artPrompt:
      'a round soft floating wisp like a little pale-blue cloud pillow, glowing gently, tiny closed eyes and a yawn',
  },
  {
    n: 3,
    name: 'Yawning Dormouse',
    rarity: 'common',
    atk: 4,
    hp: 4,
    abilities: [{ trigger: 'onAllyFaint', effect: 'buffAtk', target: 'self', value: 1 }],
    flavour: 'Only wakes up for snacks, and for friends in trouble.',
    artPrompt:
      'a plump grey dormouse in an indigo nightcap, mid-yawn, rubbing one eye, long fluffy tail',
  },
  {
    n: 4,
    name: 'Lamplight Moth',
    rarity: 'common',
    atk: 5,
    hp: 3,
    abilities: [{ trigger: 'startOfBattle', effect: 'damage', target: 'randomEnemy', value: 1 }],
    flavour: 'Drawn to every lantern but yours.',
    artPrompt:
      'a small moth with rounded warm honey-and-cream wings that glow softly, big dark eyes, fluffy cream collar, holding a tiny glowing lantern in its front legs',
  },
  {
    n: 5,
    name: 'Drowsy Bat',
    rarity: 'uncommon',
    atk: 4,
    hp: 5,
    abilities: [{ trigger: 'support', effect: 'weaken', target: 'enemyFront', value: 1, every: 3 }],
    flavour: 'Hums so softly that its foes forget to swing.',
    artPrompt:
      'a small round fruit bat with velvety indigo fur, wings wrapped around itself like a blanket, half-closed eyes',
  },
  {
    n: 6,
    name: 'Stargazer Mole',
    rarity: 'uncommon',
    atk: 5,
    hp: 4,
    abilities: [{ trigger: 'onAllyFaint', effect: 'damage', target: 'enemyFront', value: 2 }],
    flavour: 'Has never seen the sky, but knows every star by name.',
    artPrompt:
      'a star-nosed mole with dark velvet fur, a pink star-shaped nose that sparkles, holding a tiny brass telescope',
  },
  {
    n: 7,
    name: 'Driftwisp',
    rarity: 'uncommon',
    atk: 3,
    hp: 6,
    abilities: [{ trigger: 'onFaint', effect: 'weaken', target: 'enemyFront', value: 2 }],
    flavour: 'Fades into fog, and the fog gets into everything.',
    artPrompt:
      'a wispy lilac flame spirit with a trailing misty tail, small curious eyes, faint silver sparkles around it',
  },
  {
    n: 8,
    name: 'Mail Moth',
    rarity: 'rare',
    atk: 4,
    hp: 6,
    abilities: [{ trigger: 'startOfBattle', effect: 'weaken', target: 'enemyBack', value: 2 }],
    flavour: 'Delivers sealed packs by moonlight for the Wandering Post.',
    artPrompt:
      'a sturdy moth courier with silver-grey wings, a tiny satchel strap across its chest and a sealed parcel in its arms',
  },
  {
    n: 9,
    name: 'Nightcap Badger',
    rarity: 'rare',
    atk: 5,
    hp: 5,
    abilities: [
      { trigger: 'onAllyFaint', effect: 'buffAtk', target: 'self', value: 2 },
      { trigger: 'onHurt', effect: 'buffHp', target: 'self', value: 1 },
    ],
    flavour: 'Sleepwalks into battle and wins most of them anyway.',
    artPrompt:
      'a stocky badger in striped pyjamas and a long drooping nightcap, eyes closed, sleepwalking with arms out',
  },
  {
    n: 10,
    name: 'Lullaby Moth',
    rarity: 'epic',
    atk: 3,
    hp: 8,
    abilities: [
      { trigger: 'startOfBattle', effect: 'weaken', target: 'enemyFront', value: 2 },
      { trigger: 'support', effect: 'weaken', target: 'randomEnemy', value: 1, every: 4 },
    ],
    flavour: 'One verse and the whole enemy caravan starts nodding off.',
    artPrompt:
      'a large velvety moth with deep indigo wings patterned like a starry sky with music-note shaped markings',
  },
  {
    n: 11,
    name: 'Wisp Shepherd',
    rarity: 'epic',
    atk: 4,
    hp: 7,
    abilities: [{ trigger: 'onAllyFaint', effect: 'buffAtk', target: 'allAllies', value: 1 }],
    flavour: 'Every lost wisp finds its way home to her crook.',
    artPrompt:
      'a small cloaked night creature like a lop-eared hare in a silver hooded cape, holding a crook with three tiny wisps',
  },
  {
    n: 12,
    name: 'Lady Lunamoth',
    rarity: 'legendary',
    atk: 5,
    hp: 7,
    abilities: [
      { trigger: 'startOfBattle', effect: 'weaken', target: 'enemyFront', value: 2 },
      { trigger: 'onAllyFaint', effect: 'damage', target: 'randomEnemy', value: 2 },
    ],
    flavour: 'Her wings hold the moon’s light long after it has set.',
    artPrompt:
      'an elegant luna moth with long trailing pale-lilac wings edged in silver, crescent moon markings, a delicate crown of antennae',
  },
  {
    n: 13,
    name: 'Umbra, the Dreaming Bear',
    rarity: 'mythic',
    atk: 7,
    hp: 6,
    abilities: [
      { trigger: 'onEnter', effect: 'weaken', target: 'enemyFront', value: 3 },
      { trigger: 'onAllyFaint', effect: 'buffHp', target: 'self', value: 3 },
    ],
    flavour: 'Sleeps at the bottom of the Hollow. The stars are her dreams.',
    artPrompt:
      'a great sleeping bear made of deep indigo night sky with silver stars and a crescent moon in her fur, sitting up with eyes half closed and a sleepy smile',
  },
]);
