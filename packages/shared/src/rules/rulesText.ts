import type { Ability, AbilityEffect, AbilityTarget, AbilityTrigger, Card } from '../model/card.js';

/**
 * Rules text generated from structured abilities (GDD §4). Ability semantics (GDD §10, §29):
 * - shield N absorbs the next N damage; thorns N deals N damage back to each attacker;
 * - regen N heals N HP at the end of every tick; weaken N lowers ATK by N (not below 0);
 * - buffHp raises max and current HP; heal never goes above max HP;
 * - `support` fires every N ticks, and only from slots 2–5.
 */

const TRIGGER_TEXT: Readonly<Record<Exclude<AbilityTrigger, 'support'>, string>> = {
  startOfBattle: 'Start of battle',
  onEnter: 'On enter',
  onHurt: 'When hurt',
  onAllyFaint: 'When an ally faints',
  onFaint: 'On faint',
};

const TARGET_TEXT: Readonly<Record<AbilityTarget, string>> = {
  self: 'itself',
  front: 'the front ally',
  behind: 'the ally behind',
  allAllies: 'all allies',
  enemyFront: 'the front enemy',
  enemyBack: 'the back enemy',
  randomEnemy: 'a random enemy',
};

const ENEMY_TARGETS: ReadonlySet<AbilityTarget> = new Set([
  'enemyFront',
  'enemyBack',
  'randomEnemy',
]);
const HARMFUL_EFFECTS: ReadonlySet<AbilityEffect> = new Set(['damage', 'weaken']);

/** Harmful effects must target enemies and helpful effects must target allies or self. */
export function isAbilityTargetValid(ability: Pick<Ability, 'effect' | 'target'>): boolean {
  return HARMFUL_EFFECTS.has(ability.effect) === ENEMY_TARGETS.has(ability.target);
}

function triggerText(ability: Ability): string {
  if (ability.trigger === 'support') {
    const n = ability.every ?? 1;
    return n === 1 ? 'Support, every tick' : `Support, every ${n} ticks`;
  }
  return TRIGGER_TEXT[ability.trigger];
}

/** `self` reads as a verb on the card ("Gain 2 thorns"); others as "Give <target> …". */
function effectText(effect: AbilityEffect, target: AbilityTarget, v: number): string {
  const self = target === 'self';
  const t = TARGET_TEXT[target];
  switch (effect) {
    case 'damage':
      return `deal ${v} damage to ${t}`;
    case 'weaken':
      return `give ${t} −${v} ATK`;
    case 'heal':
      return self ? `heal ${v} HP` : `heal ${t} for ${v} HP`;
    case 'buffAtk':
      return self ? `gain +${v} ATK` : `give ${t} +${v} ATK`;
    case 'buffHp':
      return self ? `gain +${v} HP` : `give ${t} +${v} HP`;
    case 'shield':
      return self ? `gain a ${v} shield` : `give ${t} a ${v} shield`;
    case 'thorns':
      return self ? `gain ${v} thorns` : `give ${t} ${v} thorns`;
    case 'regen':
      return self ? `gain regen ${v}` : `give ${t} regen ${v}`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One line of rules text, e.g. "When hurt: gain +1 ATK." */
export function abilityRulesText(ability: Ability): string {
  if (!isAbilityTargetValid(ability)) {
    throw new Error(`invalid target ${ability.target} for ${ability.effect}`);
  }
  const body = effectText(ability.effect, ability.target, ability.value);
  return `${capitalize(triggerText(ability))}: ${body}.`;
}

/** The card's rules text, one line per ability. */
export function cardRulesText(card: Pick<Card, 'abilities'>): string[] {
  return card.abilities.map(abilityRulesText);
}

/**
 * Compact card-face wording (T24): the full sentences don't fit the 72×15 art px parchment at
 * 13 px, so the face uses short trigger labels and targets, "dmg" and no articles. Card inspect
 * (`CardDetails`) keeps the full `abilityRulesText` at body size.
 */
const FACE_TRIGGER_TEXT: Readonly<Record<Exclude<AbilityTrigger, 'support'>, string>> = {
  startOfBattle: 'Battle start',
  onEnter: 'Enter',
  onHurt: 'Hurt',
  onAllyFaint: 'Ally faints',
  onFaint: 'Faint',
};

const FACE_TARGET_TEXT: Readonly<Record<AbilityTarget, string>> = {
  self: 'self',
  front: 'front ally',
  behind: 'ally behind',
  allAllies: 'all allies',
  enemyFront: 'front enemy',
  enemyBack: 'back enemy',
  randomEnemy: 'random enemy',
};

function faceTriggerText(ability: Ability): string {
  if (ability.trigger === 'support') {
    const n = ability.every ?? 1;
    return n === 1 ? 'Every tick' : `Every ${String(n)} ticks`;
  }
  return FACE_TRIGGER_TEXT[ability.trigger];
}

/** Self effects read as a bare change ("+1 ATK"); others name the target first ("front enemy −2 ATK"). */
function faceEffectText(effect: AbilityEffect, target: AbilityTarget, v: number): string {
  const n = String(v);
  const t = target === 'self' ? '' : `${FACE_TARGET_TEXT[target]} `;
  switch (effect) {
    case 'damage':
      return `${n} dmg to ${FACE_TARGET_TEXT[target]}`;
    case 'weaken':
      return `${t}−${n} ATK`;
    case 'heal':
      return `heal ${t}${n} HP`;
    case 'buffAtk':
      return `${t}+${n} ATK`;
    case 'buffHp':
      return `${t}+${n} HP`;
    case 'shield':
      return `${t}+${n} shield`;
    case 'thorns':
      return `${t}+${n} thorns`;
    case 'regen':
      return `${t}+${n} regen`;
  }
}

/** One ability in compact card-face wording, e.g. "Ally faints: 2 dmg to random enemy." */
export function abilityFaceText(ability: Ability): string {
  if (!isAbilityTargetValid(ability)) {
    throw new Error(`invalid target ${ability.target} for ${ability.effect}`);
  }
  const body = faceEffectText(ability.effect, ability.target, ability.value);
  return `${faceTriggerText(ability)}: ${body}.`;
}

/** The card face's compact rules text, one entry per ability. */
export function cardFaceRulesText(card: Pick<Card, 'abilities'>): string[] {
  return card.abilities.map(abilityFaceText);
}

/** Short reminder text for keyword effects, for tooltips. */
export const KEYWORD_REMINDERS: Readonly<Partial<Record<AbilityEffect, string>>> = {
  shield: 'Shield N: absorbs the next N damage.',
  thorns: 'Thorns N: deals N damage back to each attacker.',
  regen: 'Regen N: heals N HP at the end of every tick.',
  weaken: 'Weaken: lowers ATK, but not below 0.',
};
