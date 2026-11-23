import { PACK_PRICES } from '@pixel-packs/shared';
import { CurrencyBadge } from '../components/CurrencyBadge.js';

const SHELF = [
  { realm: 'mossgrove', name: 'Mossgrove' },
  { realm: 'starhollow', name: 'Starhollow' },
] as const;

/** Realm packs standing on a wooden shelf, with their price (shared `PACK_PRICES`). */
export function PackShelf() {
  const price = PACK_PRICES.realm;
  return (
    <ul className="shelf">
      {SHELF.map((p) => (
        <li key={p.realm} className="shelf__pack">
          <img src={`/assets/packs/${p.realm}.png`} alt="" width={192} height={192} />
          <span className="shelf__label">
            {p.name} pack <CurrencyBadge currency={price.currency} amount={price.amount} />
          </span>
        </li>
      ))}
    </ul>
  );
}
