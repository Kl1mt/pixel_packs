import { cardRulesText, starredCard, type Card } from '@pixel-packs/shared';
import { editionText, mintText } from './cardBadges.js';
import type { CardFaceOverrides } from './cardFace.js';
import { Panel } from './Panel.js';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The card's full text at body size (≥ 16 px, GDD §16/§29): the face shows the
 * rules in a compact 13 px, so inspect views pair the card with this panel.
 */
export function CardDetails({ card, ...o }: { card: Card } & CardFaceOverrides) {
  const stars = o.stars ?? 1;
  const variant = o.variant ?? 'normal';
  const played = starredCard(card, stars);
  const traits = [
    variant !== 'normal' ? cap(variant) + (o.mintNumber ? ` ${mintText(o.mintNumber)}` : '') : null,
    stars > 1 ? '★'.repeat(stars) : null,
    o.edition
      ? `First Edition · Season ${String(o.edition.season)} (${editionText(o.edition)})`
      : null,
  ].filter(Boolean);
  return (
    <Panel className="card-details" aria-label={`${card.name} details`}>
      <h2 className="card-details__name">{card.name}</h2>
      <p className="card-details__meta">
        {cap(card.rarity)} · {cap(card.realm)} · {card.id}
      </p>
      {traits.length > 0 && <p className="card-details__meta">{traits.join(' · ')}</p>}
      <p className="card-details__stats">
        ATK {o.atk ?? played.atk} · HP {o.hp ?? played.hp}
      </p>
      <ul className="card-details__rules">
        {cardRulesText(played).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="card-details__flavour">{card.flavour}</p>
    </Panel>
  );
}
