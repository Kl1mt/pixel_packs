/**
 * Admin command line (GDD §23). Talks to the database directly:
 *   DATABASE_URL set → Postgres; otherwise the server's PGlite directory, which only one
 *   process can open, so stop `pnpm dev` first.
 */
import { resolve } from 'node:path';
import { z } from 'zod';
import { CurrencySchema, PackTypeIdSchema, RaritySchema, VariantSchema } from '@pixel-packs/shared';
import {
  createDb,
  findUser,
  grantCurrency,
  grantPacks,
  resetOnboarding,
  setOddsOverride,
} from '@pixel-packs/server/admin';

const USAGE = `usage: pnpm admin <command> …
  grant <user> <gold|dust|gems> <amount> [note]   add currency (negative removes)
  grant-packs <user> <packTypeId> <count> [note]   e.g. realm:mossgrove, mythic
  reset-onboarding <user>                          next two realm packs are scripted again
  odds-override <user> <packs> [rarity] [variant]  dev only; packs 0 clears it
<user> is an email or a username.`;

const Count = z.coerce.number().int();
const Positive = z.coerce.number().int().min(0).max(1000);

async function main(argv: string[]): Promise<void> {
  const [command, who, ...rest] = argv;
  if (!command || !who) {
    console.log(USAGE);
    process.exitCode = command ? 1 : 0;
    return;
  }
  const handle = createDb({
    databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
    // Relative PGLITE_DIR values are relative to apps/server, as for the server.
    pgliteDir: resolve('../../apps/server', process.env.PGLITE_DIR ?? '.data/pglite'),
  });
  try {
    const user = await findUser(handle.db, who);
    if (!user) throw new Error(`no user "${who}"`);
    switch (command) {
      case 'grant': {
        const currency = CurrencySchema.parse(rest[0]);
        const amount = Count.parse(rest[1]);
        await grantCurrency(handle.db, user.id, currency, amount, rest[2] ?? '');
        console.log(`granted ${amount} ${currency} to ${user.username}`);
        break;
      }
      case 'grant-packs': {
        const pack = PackTypeIdSchema.parse(rest[0]);
        const count = z.coerce.number().int().min(1).max(1000).parse(rest[1]);
        await grantPacks(handle.db, user.id, pack, count, rest[2] ?? '');
        console.log(`granted ${count} × ${pack} to ${user.username}`);
        break;
      }
      case 'reset-onboarding':
        await resetOnboarding(handle.db, user.id);
        console.log(`reset onboarding of ${user.username}`);
        break;
      case 'odds-override': {
        if (process.env.NODE_ENV === 'production') throw new Error('odds overrides are dev only');
        const packs = Positive.parse(rest[0]);
        const rarity = rest[1] ? RaritySchema.parse(rest[1]) : undefined;
        const variant = rest[2] ? VariantSchema.parse(rest[2]) : undefined;
        await setOddsOverride(handle.db, user.id, {
          packs,
          ...(rarity ? { rarity } : {}),
          ...(variant ? { variant } : {}),
        });
        console.log(
          packs === 0
            ? `cleared the override of ${user.username}`
            : `next ${packs} pack(s) of ${user.username}: featured ${rarity ?? 'any'} / ${variant ?? 'any'}`,
        );
        break;
      }
      default:
        console.log(USAGE);
        process.exitCode = 1;
    }
  } finally {
    await handle.close();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
