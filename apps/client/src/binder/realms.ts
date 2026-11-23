import type { Realm } from '@pixel-packs/shared';

const NAMES: Record<Realm, string> = {
  hearthfire: 'Hearthfire',
  tidepool: 'Tidepool',
  mossgrove: 'Mossgrove',
  skyloft: 'Skyloft',
  starhollow: 'Starhollow',
};

export const realmName = (r: Realm) => NAMES[r];
