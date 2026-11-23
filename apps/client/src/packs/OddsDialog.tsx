import { useEffect, useRef } from 'react';
import { RARITIES, VARIANTS, type OddsResponse } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { percentText } from './format.js';

type PackOdds = OddsResponse['packs'][number];

const LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  normal: 'Normal',
  foil: 'Foil',
  prismatic: 'Prismatic',
  void: 'Void',
  glitch: 'Glitch',
};

const cell = (table: Record<string, number>, key: string) =>
  table[key] === undefined ? '—' : percentText(table[key]);

/** The "?" on a pack (GDD §5): every chance and pity rule, straight from the server. */
export function OddsDialog({
  name,
  odds,
  onClose,
}: {
  name: string;
  odds: PackOdds;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const p = odds.pity;
  return (
    <dialog
      ref={ref}
      className="odds panel panel--parchment"
      aria-labelledby="odds-title"
      onClose={onClose}
    >
      <h2 id="odds-title">{name} odds</h2>
      <table className="odds__table">
        <thead>
          <tr>
            <th scope="col">Rarity</th>
            <th scope="col">Cards 1–4</th>
            <th scope="col">Featured card</th>
          </tr>
        </thead>
        <tbody>
          {RARITIES.map((r) => (
            <tr key={r} data-rarity={r}>
              <th scope="row">{LABEL[r]}</th>
              <td>{cell(odds.slotRarity, r)}</td>
              <td>{cell(odds.featuredRarity, r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="odds__line">
        Every card can also be special:{' '}
        {VARIANTS.filter((v) => v !== 'normal')
          .map((v) => `${LABEL[v] ?? v} ${cell(odds.variants, v)}`)
          .join(' · ')}
        .
      </p>
      {odds.ownRealmPercent !== null && (
        <p className="odds__line">
          {percentText(odds.ownRealmPercent)} of the cards come from this pack&apos;s realm, the
          rest from any realm.
        </p>
      )}
      <p className="odds__line">
        Legendary or better is guaranteed by pack {p.legendaryHardPity} without one
        {odds.pityGroup === 'realm' ? '; all realm packs share this count' : ''}.
        {p.mythicSoftPityStart !== null &&
          ` From pack ${String(p.mythicSoftPityStart)} without a Mythic its chance grows by ${percentText(p.mythicSoftPityStepPercent)} each pack,`}
        {` and pack ${String(p.mythicHardPity)} brings one for sure.`}
      </p>
      <form method="dialog" className="odds__close">
        <Button type="submit">Close</Button>
      </form>
    </dialog>
  );
}
