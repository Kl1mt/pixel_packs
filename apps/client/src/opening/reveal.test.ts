import { describe, expect, it } from 'vitest';
import type { OpenedCard, PackOpening, Rarity } from '@pixel-packs/shared';
import {
  backGlow,
  catalogCard,
  initialReveal,
  packMood,
  revealReducer,
  revealSequence,
  summarize,
  type RevealAction,
  type RevealState,
} from './reveal.js';

const card = (slot: number, rarity: Rarity, over: Partial<OpenedCard> = {}): OpenedCard => ({
  slot,
  featured: slot === 5,
  cardId: 'MOS-001',
  realm: 'mossgrove',
  rarity,
  variant: 'normal',
  userCardId: `00000000-0000-4000-8000-00000000000${String(slot)}`,
  mintNumber: null,
  edition: null,
  isNew: true,
  ...over,
});

const opening = (cards: OpenedCard[], revealOrder = [1, 2, 3, 4, 5]): PackOpening => ({
  id: '00000000-0000-4000-8000-000000000000',
  packTypeId: 'realm:mossgrove',
  scripted: false,
  pityTrigger: null,
  cards,
  revealOrder,
  createdAt: '2026-11-23T00:00:00.000Z',
  revealedAt: null,
});

const run = (s: RevealState, ...actions: RevealAction['type'][]) =>
  actions.reduce((st, type) => revealReducer(st, { type }), s);

describe('reveal state', () => {
  it('tears, flips five cards and then shows the results', () => {
    let s = initialReveal(false);
    expect(s.phase).toBe('tear');
    expect(run(s, 'flip').flipped).toBe(0);
    s = run(s, 'torn', 'flip', 'flip');
    expect(s).toMatchObject({ phase: 'reveal', flipped: 2 });
    s = run(s, 'flip', 'flip', 'flip', 'flip');
    expect(s.flipped).toBe(5);
    expect(run(s, 'results').phase).toBe('summary');
  });

  it('resumes at the card stack', () => {
    expect(initialReveal(true)).toMatchObject({ phase: 'reveal', flipped: 0 });
  });

  it('"Reveal all" flips on a timer until the last card, "Skip" jumps to the results', () => {
    let s = run(initialReveal(true), 'flip', 'revealAll');
    expect(s.auto).toBe(true);
    s = run(s, 'flip', 'flip', 'flip');
    expect(s.auto).toBe(true);
    s = run(s, 'flip');
    expect(s).toMatchObject({ flipped: 5, auto: false });
    expect(run(initialReveal(false), 'skip')).toMatchObject({ phase: 'summary', flipped: 5 });
  });
});

describe('opening helpers', () => {
  const o = opening(
    [
      card(1, 'rare'),
      card(2, 'common', { isNew: false }),
      card(3, 'uncommon', { variant: 'foil' }),
      card(4, 'common'),
      card(5, 'epic', { isNew: false }),
    ],
    [2, 4, 3, 1, 5],
  );

  it('follows the server reveal order with the featured slot last', () => {
    const seq = revealSequence(o);
    expect(seq.map((c) => c.slot)).toEqual([2, 4, 3, 1, 5]);
    expect(seq.at(-1)?.featured).toBe(true);
  });

  it('glows every back except Commons', () => {
    expect(backGlow({ rarity: 'common' })).toBeNull();
    expect(backGlow({ rarity: 'rare' })).toBe('rare');
  });

  it('sets the pack mood from the best card', () => {
    expect(packMood(o)).toBe('epic');
    expect(packMood(opening([1, 2, 3, 4, 5].map((s) => card(s, 'common'))))).toBe('calm');
    expect(
      packMood(
        opening([card(1, 'common'), ...[2, 3, 4].map((s) => card(s, 'common')), card(5, 'mythic')]),
      ),
    ).toBe('mythic');
    expect(
      packMood(opening([...[1, 2, 3, 4].map((s) => card(s, 'common')), card(5, 'legendary')])),
    ).toBe('golden');
  });

  it('counts new cards, extras and special variants', () => {
    expect(summarize(o)).toEqual({ newCount: 3, extraCount: 2, specialCount: 1 });
  });

  it('finds catalog cards and rejects unknown ids', () => {
    expect(catalogCard('MOS-001').id).toBe('MOS-001');
    expect(() => catalogCard('XXX-999')).toThrow();
  });
});
