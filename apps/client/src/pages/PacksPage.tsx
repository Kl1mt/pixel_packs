import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ENABLED_REALMS,
  type OddsResponse,
  type PackOpening,
  type PackTypeId,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { Panel } from '../components/Panel.js';
import { economyApi, newIdempotencyKey } from '../economy/api.js';
import { economyStore, useEconomy } from '../economy/useEconomy.js';
import { ApiError } from '../http.js';
import { clockText } from '../packs/format.js';
import { OddsDialog } from '../packs/OddsDialog.js';
import { PityMeter } from '../packs/PityMeter.js';
import { REALM_NAME, ShopShelf, ownedCount, packName } from '../packs/ShopShelf.js';
import '../packs/packs.css';

// Pixi (variant cards) loads with the scene, not with the shelf.
const OpeningScene = lazy(() =>
  import('../opening/OpeningScene.js').then((m) => ({ default: m.OpeningScene })),
);

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

/**
 * The shop counter (GDD §7, §16): owned packs on the shelf, buying, the odds "?",
 * the pity meter, the free pack and "Resume reveal". Opening a pack plays the
 * opening scene over the page.
 */
export function PacksPage() {
  const snap = useEconomy();
  const [odds, setOdds] = useState<OddsResponse | null>(null);
  const [oddsFor, setOddsFor] = useState<PackTypeId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<{ opening: PackOpening; resumed: boolean } | null>(null);
  // One idempotency key per intended action, reused when the same action is retried.
  const keys = useRef(new Map<string, string>());
  const keyFor = (action: string) => {
    const k = keys.current.get(action) ?? newIdempotencyKey();
    keys.current.set(action, k);
    return k;
  };

  useEffect(() => {
    void economyStore.refresh();
    economyApi.odds().then(setOdds, () => undefined);
  }, []);

  const run = async (action: string, work: (key: string) => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work(keyFor(action));
      keys.current.delete(action);
    } catch (err) {
      // A definite "no" from the server: the next try is a new action.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500)
        keys.current.delete(action);
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const open = (id: PackTypeId) =>
    run(`open:${id}`, async (key) => {
      const opening = await economyApi.open(id, key);
      setScene({ opening, resumed: false });
      void economyStore.refresh();
    });
  const buy = (id: PackTypeId) =>
    run(`buy:${id}`, async (key) => {
      economyStore.set(await economyApi.buy(id, key));
    });
  const resume = () =>
    run('resume', async () => {
      const opening = await economyApi.pending();
      if (opening) setScene({ opening, resumed: true });
      else void economyStore.refresh();
    });

  if (snap.status !== 'ready')
    return (
      <>
        <h1 className="page-title">Packs</h1>
        {snap.status === 'error' ? (
          <Notice tone="error">The shop is closed for a moment. Please reload.</Notice>
        ) : (
          <p className="on-ground">Opening the shop…</p>
        )}
      </>
    );

  const s = snap.state;
  const realmPity = s.pity.find((m) => m.group === 'realm');
  const oddsPack = oddsFor && odds?.packs.find((p) => p.packTypeId === oddsFor);

  return (
    <>
      <h1 className="page-title">Packs</h1>
      {s.pendingOpeningId && !scene && (
        <Panel className="shop-resume" aria-label="Unfinished pack">
          <p>You left a pack half-revealed. Your cards are waiting.</p>
          <Button onClick={() => void resume()} disabled={busy}>
            Resume reveal
          </Button>
        </Panel>
      )}
      <Panel material="wood" className="shop" aria-label="The shop counter">
        <h2>The shop counter</h2>
        <ShopShelf
          state={s}
          busy={busy}
          onOpen={(id) => void open(id)}
          onBuy={(id) => void buy(id)}
          onOdds={setOddsFor}
        />
        {error && <Notice tone="error">{error}</Notice>}
      </Panel>
      <div className="shop-side">
        <Panel className="shop-free" aria-label="Free pack">
          {s.freePack.stored > 0 ? (
            <>
              <p>
                {s.freePack.stored > 1 ? 'Two free packs are' : 'A free pack is'} waiting. Pick a
                realm:
              </p>
              {ENABLED_REALMS.map((realm) => (
                <Button
                  key={realm}
                  disabled={busy}
                  onClick={() =>
                    void run('free', async () => {
                      economyStore.set(await economyApi.claimFreePack(realm));
                    })
                  }
                >
                  Take {REALM_NAME[realm]}
                </Button>
              ))}
            </>
          ) : (
            <p>
              Next free pack
              {s.freePack.nextAt ? ` at ${clockText(s.freePack.nextAt)}` : ' soon'}.
            </p>
          )}
        </Panel>
        {realmPity && (
          <Panel className="shop-pity" aria-label="Pity meter">
            <PityMeter meter={realmPity} />
          </Panel>
        )}
      </div>

      {oddsFor && oddsPack && (
        <OddsDialog
          name={packName(oddsFor)}
          odds={oddsPack}
          onClose={() => {
            setOddsFor(null);
          }}
        />
      )}
      {scene && (
        <Suspense fallback={<div className="opening opening--loading" />}>
          <OpeningScene
            key={scene.opening.id}
            opening={scene.opening}
            resumed={scene.resumed}
            packName={packName(scene.opening.packTypeId)}
            canOpenAnother={!busy && ownedCount(s, scene.opening.packTypeId) > 0}
            onOpenAnother={() => void open(scene.opening.packTypeId)}
            onClose={() => {
              setScene(null);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
