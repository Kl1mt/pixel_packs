import { CARD_CATALOG, buildCatalogIndex, type Card, type CatalogIndex } from '@pixel-packs/shared';

/** The catalog synced into `cards` on start: the T03 set from `packages/shared`. */
export const SERVER_CATALOG: readonly Card[] = CARD_CATALOG;

/** Pack pool of the enabled realms; built once, validated against the set composition. */
export const SERVER_CATALOG_INDEX: CatalogIndex = buildCatalogIndex(SERVER_CATALOG);
