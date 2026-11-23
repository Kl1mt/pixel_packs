import { notInArray, sql } from 'drizzle-orm';
import { ENABLED_REALMS, REALMS, pityGroupOf, type Card, type PackType } from '@pixel-packs/shared';
import type { Db } from './client.js';
import { cards, packTypes } from './schema.js';

/**
 * Mirrors the shared catalog into `cards` (GDD §21). Cards that left the catalog
 * are marked retired rather than deleted, because owned copies reference them.
 */
export async function syncCatalog(db: Db, catalog: readonly Card[]): Promise<void> {
  if (catalog.length === 0) return;
  await db.transaction(async (tx) => {
    await tx
      .insert(cards)
      .values(
        catalog.map((c) => ({
          id: c.id,
          set: c.set,
          name: c.name,
          realm: c.realm,
          rarity: c.rarity,
          atk: c.atk,
          hp: c.hp,
          abilities: c.abilities,
          flavour: c.flavour,
          event: c.flags.event,
          craftable: c.flags.craftable,
        })),
      )
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          set: sql`excluded.set`,
          name: sql`excluded.name`,
          realm: sql`excluded.realm`,
          rarity: sql`excluded.rarity`,
          atk: sql`excluded.atk`,
          hp: sql`excluded.hp`,
          abilities: sql`excluded.abilities`,
          flavour: sql`excluded.flavour`,
          event: sql`excluded.event`,
          craftable: sql`excluded.craftable`,
          retired: false,
          syncedAt: sql`now()`,
        },
      });
    await tx
      .update(cards)
      .set({ retired: true })
      .where(
        notInArray(
          cards.id,
          catalog.map((c) => c.id),
        ),
      );
  });
}

export function packTypeId(pack: PackType): string {
  return pack.kind === 'realm' ? `realm:${pack.realm}` : 'mythic';
}

/**
 * Upserts one pack type per realm plus the Mythic pack. Realm packs are enabled for
 * the enabled realms only. The release season is set on first insert (Season 0) and
 * then kept, since it decides First-Edition stamps.
 */
export async function syncPackTypes(db: Db): Promise<void> {
  const all: PackType[] = [
    ...REALMS.map((realm) => ({ kind: 'realm', realm }) as const),
    { kind: 'mythic' },
  ];
  await db
    .insert(packTypes)
    .values(
      all.map((p) => ({
        id: packTypeId(p),
        kind: p.kind,
        realm: p.kind === 'realm' ? p.realm : null,
        pityGroup: pityGroupOf(p),
        releaseSeason: 0,
        enabled: p.kind === 'mythic' || ENABLED_REALMS.includes(p.realm),
      })),
    )
    .onConflictDoUpdate({
      target: packTypes.id,
      set: {
        kind: sql`excluded.kind`,
        realm: sql`excluded.realm`,
        pityGroup: sql`excluded.pity_group`,
        enabled: sql`excluded.enabled`,
      },
    });
}
