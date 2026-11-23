import type { IconName } from '@pixel-packs/shared';

/** Main navigation (GDD §16: at most 5 items; M1 has Home · Packs · Binder). */
export const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'nav-home' },
  { to: '/packs', label: 'Packs', icon: 'nav-packs' },
  { to: '/binder', label: 'Binder', icon: 'nav-binder' },
] as const satisfies readonly { to: string; label: string; icon: IconName }[];

export const MAX_NAV_ITEMS = 5;
