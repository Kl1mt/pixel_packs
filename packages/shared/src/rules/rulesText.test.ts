import { describe, expect, it } from 'vitest';
import { abilityRulesText, cardRulesText, isAbilityTargetValid } from './rulesText.js';

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
