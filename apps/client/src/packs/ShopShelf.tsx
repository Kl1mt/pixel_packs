import {
  ENABLED_REALMS,
  PACK_PRICES,
  type EconomyState,
  type PackTypeId,
  type Realm,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { CurrencyBadge } from '../components/CurrencyBadge.js';
import { packArt } from '../opening/themes.js';

export const REALM_NAME: Record<Realm, string> = {
  hearthfire: 'Hearthfire',
  tidepool: 'Tidepool',
  mossgrove: 'Mossgrove',
  skyloft: 'Skyloft',
  starhollow: 'Starhollow',
};

export const packName = (id: PackTypeId): string =>
  id === 'mythic' ? 'Mythic pack' : `${REALM_NAME[id.slice(6) as Realm]} pack`;

export const ownedCount = (s: EconomyState, id: PackTypeId): number =>
  s.packs.find((p) => p.packTypeId === id)?.count ?? 0;

export interface ShopShelfProps {
  state: EconomyState;
  /** An action is running; every button waits. */
  busy: boolean;
  onOpen: (id: PackTypeId) => void;
  onBuy: (id: PackTypeId) => void;
  onOdds: (id: PackTypeId) => void;
}

/** Every pack on the shelf: the enabled realm packs, then the Mythic pack (GDD §7). */
export const SHELF_PACKS: readonly PackTypeId[] = [
  ...ENABLED_REALMS.map((realm) => `realm:${realm}` as const),
  'mythic',
];

export const packPrice = (id: PackTypeId) =>
  id === 'mythic' ? PACK_PRICES.mythic : PACK_PRICES.realm;

/** The shop counter's shelf (GDD §16): each pack with how many you own, open, buy and "?". */
export function ShopShelf({ state, busy, onOpen, onBuy, onOdds }: ShopShelfProps) {
  return (
    <ul className="shop-shelf">
      {SHELF_PACKS.map((id) => {
        const price = packPrice(id);
        const owned = ownedCount(state, id);
        const name = packName(id);
        return (
          <li
            key={id}
            className={id === 'mythic' ? 'shop-pack shop-pack--mythic' : 'shop-pack'}
            data-pack={id}
            aria-label={name}
          >
            <div className="shop-pack__art">
              <img src={packArt(id)} alt="" width={192} height={192} />
              {owned > 0 && (
                <span className="shop-pack__count" aria-label={`${String(owned)} owned`}>
                  ×{owned}
                </span>
              )}
              <button
                type="button"
                className="shop-pack__odds"
                aria-label={`${name} odds`}
                onClick={() => {
                  onOdds(id);
                }}
              >
                ?
              </button>
            </div>
            <span className="shop-pack__tag">
              <span className="shop-pack__name">{name}</span>
              <CurrencyBadge currency={price.currency} amount={price.amount} />
            </span>
            <span className="shop-pack__buttons">
              <Button
                disabled={busy || owned === 0}
                onClick={() => {
                  onOpen(id);
                }}
              >
                Open
              </Button>
              <Button
                disabled={busy || state.wallet[price.currency] < price.amount}
                aria-label={`Buy a ${name} for ${String(price.amount)} ${price.currency}`}
                onClick={() => {
                  onBuy(id);
                }}
              >
                Buy
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
