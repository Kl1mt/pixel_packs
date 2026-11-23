import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ENABLED_REALMS, type Realm } from '@pixel-packs/shared';
import { useSession } from '../auth/useSession.js';
import { CurrencyBadge } from '../components/CurrencyBadge.js';
import { Notice } from '../components/Notice.js';
import { Panel } from '../components/Panel.js';
import { economyApi } from '../economy/api.js';
import { economyStore, useEconomy } from '../economy/useEconomy.js';
import { DailyCalendar } from '../home/DailyCalendar.js';
import { FreePackTimer } from '../home/FreePackTimer.js';
import '../home/home.css';
import { ApiError } from '../http.js';
import { useOnboarding } from '../onboarding/useOnboarding.js';

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

/**
 * Home (GDD §16): the Open Packs counter, the free-pack timer, the daily calendar and
 * the purse. Players who haven't finished onboarding (GDD §17) go to `/welcome` first.
 */
export function HomePage() {
  const onboarding = useOnboarding();
  const snap = useEconomy();
  const session = useSession();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (onboarding.status === 'ready' && onboarding.state.stage !== 'done')
    return <Navigate to="/welcome" replace />;
  if (snap.status !== 'ready' || onboarding.status === 'loading' || onboarding.status === 'idle')
    return (
      <>
        <h1 className="page-title">Home</h1>
        {snap.status === 'error' ? (
          <Notice tone="error">The post office is not answering. Please reload.</Notice>
        ) : (
          <p className="on-ground">Opening the door…</p>
        )}
      </>
    );

  const s = snap.state;
  const name = session.status === 'user' ? session.user.username : null;
  const packs = s.packs.reduce((n, p) => n + p.count, 0);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  const claimFree = (realm: Realm) =>
    void run(async () => {
      economyStore.set(await economyApi.claimFreePack(realm));
    });

  return (
    <>
      <h1 className="page-title">{name ? `Welcome home, ${name}` : 'Welcome home'}</h1>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="home">
        <Panel material="wood" className="home-packs" aria-label="Your packs">
          <h2>Your satchel</h2>
          <div className="home-packs__shelf">
            {ENABLED_REALMS.map((realm) => {
              const count = s.packs.find((p) => p.packTypeId === `realm:${realm}`)?.count ?? 0;
              return (
                <span
                  key={realm}
                  className="home-packs__pack"
                  data-empty={count === 0 || undefined}
                >
                  <img src={`/assets/packs/${realm}.png`} alt="" width={192} height={192} />
                  {count > 0 && <span className="home-packs__count">×{count}</span>}
                </span>
              );
            })}
          </div>
          <p className="home-packs__line">
            {packs === 0
              ? 'Your satchel is empty. The shop has more, or wait for the post.'
              : `${String(packs)} ${packs === 1 ? 'pack is' : 'packs are'} waiting to be torn open.`}
          </p>
          <Link className="btn home-packs__open" to="/packs">
            Open packs
          </Link>
        </Panel>
        <div className="home-side">
          <FreePackTimer
            freePack={s.freePack}
            busy={busy}
            onClaim={claimFree}
            highlight={params.get('welcome') === '1'}
          />
          <DailyCalendar
            calendar={s.calendar}
            busy={busy}
            onClaim={() =>
              void run(async () => {
                economyStore.set(await economyApi.claimCalendar());
              })
            }
          />
          <Panel className="home-purse" aria-label="Purse">
            <h2>Purse</h2>
            <div className="home-purse__coins">
              <CurrencyBadge currency="gold" amount={s.wallet.gold} />
              <CurrencyBadge currency="gems" amount={s.wallet.gems} />
              <CurrencyBadge currency="dust" amount={s.wallet.dust} />
            </div>
            <p className="small muted">
              Gold buys packs. Stardust comes from extras you <Link to="/binder">dust</Link>.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
