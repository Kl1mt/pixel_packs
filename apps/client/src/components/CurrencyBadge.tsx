import type { Currency, IconName } from '@pixel-packs/shared';
import { Icon } from './Icon.js';

const CURRENCY: Record<Currency, { icon: IconName; name: string }> = {
  gold: { icon: 'gold', name: 'gold' },
  gems: { icon: 'gem', name: 'gems' },
  dust: { icon: 'stardust', name: 'Stardust' },
};

/** Digits only: the pixel font draws numbers, separators would be unreadable at 2×. */
export function formatAmount(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return '–';
  return String(Math.max(0, Math.trunc(amount)));
}

export interface CurrencyBadgeProps {
  currency: Currency;
  /** `null` while unknown (e.g. logged out or loading). */
  amount: number | null;
  className?: string;
}

/** Icon plus amount in the pixel number font, e.g. in the top bar or on a pack price. */
export function CurrencyBadge({ currency, amount, className }: CurrencyBadgeProps) {
  const c = CURRENCY[currency];
  const label = amount === null ? `${c.name} unknown` : `${formatAmount(amount)} ${c.name}`;
  return (
    <span className={['currency', className].filter(Boolean).join(' ')} aria-label={label}>
      <Icon name={c.icon} />
      <span className="num" aria-hidden="true">
        {formatAmount(amount)}
      </span>
    </span>
  );
}
