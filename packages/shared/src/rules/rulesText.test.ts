import { describe, expect, it } from 'vitest';
import { CARD_CATALOG } from '../data/cards/index.js';
import {
  abilityFaceText,
  abilityRulesText,
  cardFaceRulesText,
  cardRulesText,
  isAbilityTargetValid,
} from './rulesText.js';
import { starredCard } from './stars.js';

describe('abilityRulesText', () => {
  it('writes self effects as verbs', () => {
    expect(
      abilityRulesText({ trigger: 'onHurt', effect: 'buffAtk', target: 'self', value: 1 }),
    ).toBe('When hurt: gain +1 ATK.');
    expect(
      abilityRulesText({ trigger: 'onEnter', effect: 'thorns', target: 'self', value: 2 }),
    ).toBe('On enter: gain 2 thorns.');
    expect(
      abilityRulesText({ trigger: 'onEnter', effect: 'shield', target: 'self', value: 2 }),
    ).toBe('On enter: gain a 2 shield.');
    expect(abilityRulesText({ trigger: 'onHurt', effect: 'regen', target: 'self', value: 1 })).toBe(
      'When hurt: gain regen 1.',
    );
  });

  it('names other targets', () => {
    expect(
      abilityRulesText({ trigger: 'onFaint', effect: 'heal', target: 'allAllies', value: 2 }),
    ).toBe('On faint: heal all allies for 2 HP.');
    expect(
      abilityRulesText({
        trigger: 'startOfBattle',
        effect: 'weaken',
        target: 'enemyBack',
        value: 2,
      }),
    ).toBe('Start of battle: give the back enemy −2 ATK.');
    expect(
      abilityRulesText({
        trigger: 'onAllyFaint',
        effect: 'damage',
        target: 'randomEnemy',
        value: 2,
      }),
    ).toBe('When an ally faints: deal 2 damage to a random enemy.');
    expect(
      abilityRulesText({ trigger: 'onFaint', effect: 'buffHp', target: 'behind', value: 2 }),
    ).toBe('On faint: give the ally behind +2 HP.');
  });

  it('writes support intervals', () => {
    const base = { trigger: 'support', effect: 'heal', target: 'front', value: 1 } as const;
    expect(abilityRulesText({ ...base, every: 3 })).toBe(
      'Support, every 3 ticks: heal the front ally for 1 HP.',
    );
    expect(abilityRulesText({ ...base, every: 1 })).toBe(
      'Support, every tick: heal the front ally for 1 HP.',
    );
  });

  it('rejects harmful effects on allies and helpful effects on enemies', () => {
    expect(isAbilityTargetValid({ effect: 'damage', target: 'self' })).toBe(false);
    expect(isAbilityTargetValid({ effect: 'heal', target: 'enemyFront' })).toBe(false);
    expect(isAbilityTargetValid({ effect: 'weaken', target: 'enemyFront' })).toBe(true);
    expect(() =>
      abilityRulesText({ trigger: 'onEnter', effect: 'shield', target: 'randomEnemy', value: 1 }),
    ).toThrow();
  });

  it('gives one line per ability', () => {
    const lines = cardRulesText({
      abilities: [
        { trigger: 'onEnter', effect: 'thorns', target: 'self', value: 2 },
        { trigger: 'onHurt', effect: 'buffAtk', target: 'self', value: 1 },
      ],
    });
    expect(lines).toEqual(['On enter: gain 2 thorns.', 'When hurt: gain +1 ATK.']);
  });
});

describe('abilityFaceText (compact card-face wording, T24)', () => {
  it('uses short triggers and targets, "dmg" and no articles', () => {
    expect(
      abilityFaceText({
        trigger: 'startOfBattle',
        effect: 'weaken',
        target: 'enemyFront',
        value: 2,
      }),
    ).toBe('Battle start: front enemy −2 ATK.');
    expect(
      abilityFaceText({
        trigger: 'onAllyFaint',
        effect: 'damage',
        target: 'randomEnemy',
        value: 2,
      }),
    ).toBe('Ally faints: 2 dmg to random enemy.');
    expect(
      abilityFaceText({ trigger: 'onHurt', effect: 'buffAtk', target: 'self', value: 1 }),
    ).toBe('Hurt: +1 ATK.');
    expect(
      abilityFaceText({ trigger: 'onEnter', effect: 'shield', target: 'self', value: 2 }),
    ).toBe('Enter: +2 shield.');
    expect(
      abilityFaceText({ trigger: 'onFaint', effect: 'heal', target: 'allAllies', value: 3 }),
    ).toBe('Faint: heal all allies 3 HP.');
    expect(
      abilityFaceText({ trigger: 'onFaint', effect: 'buffHp', target: 'behind', value: 2 }),
    ).toBe('Faint: ally behind +2 HP.');
    const support = { trigger: 'support', effect: 'heal', target: 'front', value: 1 } as const;
    expect(abilityFaceText({ ...support, every: 3 })).toBe('Every 3 ticks: heal front ally 1 HP.');
    expect(abilityFaceText({ ...support, every: 1 })).toBe('Every tick: heal front ally 1 HP.');
  });

  it('rejects invalid targets like the full text', () => {
    expect(() =>
      abilityFaceText({ trigger: 'onEnter', effect: 'damage', target: 'self', value: 1 }),
    ).toThrow();
  });

  it('is never longer than the full sentence, for every card and star level', () => {
    for (const card of CARD_CATALOG)
      for (const stars of [1, 2, 3] as const) {
        const played = starredCard(card, stars);
        const face = cardFaceRulesText(played);
        const full = cardRulesText(played);
        expect(face).toHaveLength(full.length);
        face.forEach((line, i) => {
          expect(line.length, card.id).toBeLessThanOrEqual(full[i]?.length ?? 0);
        });
      }
  });
});
