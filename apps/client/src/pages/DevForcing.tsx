import { useState } from 'react';
import { Link } from 'react-router';
import {
  ENABLED_REALMS,
  RARITIES,
  VARIANTS,
  type DevGrantRequest,
  type Rarity,
  type Variant,
} from '@pixel-packs/shared';
import { useSession } from '../auth/useSession.js';
import { Button } from '../components/Button.js';
import { Panel } from '../components/Panel.js';
import { economyApi } from '../economy/api.js';
import { economyStore } from '../economy/useEconomy.js';
import { ApiError } from '../http.js';

/**
 * Dev forcing (T12): the featured card of your next packs, plus gold and packs to
 * test with. It talks to `/api/dev/*`, which only a non-production server has.
 */
export function DevForcing() {
  const session = useSession();
  const [rarity, setRarity] = useState<Rarity | ''>('legendary');
  const [variant, setVariant] = useState<Variant | ''>('');
  const [packs, setPacks] = useState(1);
  const [status, setStatus] = useState('');

  if (session.status !== 'user')
    return (
      <Panel className="lab__forcing" aria-label="Dev forcing">
        <h2>Dev forcing</h2>
        <p>
          <Link to="/login?next=/debug">Log in</Link> to force the results of your own packs.
        </p>
      </Panel>
    );

  const call = (work: () => Promise<string>) => {
    setStatus('…');
    work().then(setStatus, (err: unknown) => {
      setStatus(
        err instanceof ApiError && err.status === 404
          ? 'This server has no dev routes (production).'
          : err instanceof Error
            ? err.message
            : 'Failed.',
      );
    });
  };
  const grant = (g: DevGrantRequest, what: string) => {
    call(async () => {
      economyStore.set(await economyApi.devGrant(g));
      return `Granted ${what}.`;
    });
  };
  const force = (n: number) => {
    call(async () => {
      await economyApi.devOddsOverride({
        packs: n,
        ...(rarity ? { rarity } : {}),
        ...(variant ? { variant } : {}),
      });
      return n === 0
        ? 'Override cleared.'
        : `Your next ${String(n)} pack(s) feature ${rarity || 'a rolled'} ${variant || 'card'}. Onboarding packs come first.`;
    });
  };

  return (
    <Panel className="lab__forcing" aria-label="Dev forcing">
      <h2>Dev forcing</h2>
      <div className="lab__forcing-row">
        <label className="lab__field">
          <span>Featured rarity</span>
          <select
            value={rarity}
            onChange={(e) => {
              setRarity(e.target.value as Rarity | '');
            }}
          >
            <option value="">rolled</option>
            {RARITIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="lab__field">
          <span>Featured variant</span>
          <select
            value={variant}
            onChange={(e) => {
              setVariant(e.target.value as Variant | '');
            }}
          >
            <option value="">rolled</option>
            {VARIANTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="lab__field">
          <span>Packs</span>
          <select
            value={packs}
            onChange={(e) => {
              setPacks(Number(e.target.value));
            }}
          >
            {[1, 3, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => {
            force(packs);
          }}
        >
          Force
        </Button>
        <Button
          onClick={() => {
            force(0);
          }}
        >
          Clear
        </Button>
      </div>
      <div className="lab__forcing-row">
        <Button
          onClick={() => {
            grant({ gold: 1000 }, '1000 gold');
          }}
        >
          +1000 gold
        </Button>
        {ENABLED_REALMS.map((realm) => (
          <Button
            key={realm}
            onClick={() => {
              grant({ packs: { packTypeId: `realm:${realm}`, count: 5 } }, `5 ${realm} packs`);
            }}
          >
            +5 {realm}
          </Button>
        ))}
        <Link to="/packs">To the shop →</Link>
      </div>
      <p className="lab__status" role="status">
        {status}
      </p>
    </Panel>
  );
}
