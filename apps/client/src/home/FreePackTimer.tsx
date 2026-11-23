import { useEffect, useState } from 'react';
import {
  ENABLED_REALMS,
  FREE_PACK_INTERVAL_MS,
  type EconomyState,
  type Realm,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Icon } from '../components/Icon.js';
import { Panel } from '../components/Panel.js';
import { economyStore } from '../economy/useEconomy.js';
import { REALM_NAME } from '../packs/ShopShelf.js';
import { countdownText, timerFill } from './format.js';

const SEGMENTS = 16;

export interface FreePackTimerProps {
  freePack: EconomyState['freePack'];
  busy: boolean;
  onClaim: (realm: Realm) => void;
  /** Just finished onboarding: point at the timer once (GDD §17 step 5). */
  highlight: boolean;
}

/** The Wandering Post's free pack (GDD §7): ready to take, or a countdown with a stepped bar. */
export function FreePackTimer({ freePack, busy, onClaim, highlight }: FreePackTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);
    return () => {
      window.clearInterval(t);
    };
  }, []);
  const left = freePack.nextAt === null ? null : new Date(freePack.nextAt).getTime() - now;
  // The next pack is due: ask the server (it adds it to the stored count).
  useEffect(() => {
    if (left !== null && left <= 0) void economyStore.refresh();
  }, [left]);

  const ready = freePack.stored > 0;
  const lit = Math.round(timerFill(freePack.nextAt, FREE_PACK_INTERVAL_MS, now) * SEGMENTS);
  return (
    <Panel
      className={['pinned', 'home-timer', highlight ? 'home-timer--highlight' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label="Free pack"
    >
      {highlight && (
        <span className="home-timer__note" aria-hidden="true">
          Every 8 hours!
        </span>
      )}
      <h2>Free pack</h2>
      <div className="timer">
        <Icon name="timer" scale={3} />
        <span className="num" data-testid="free-pack-clock">
          {ready ? 'Ready' : left === null ? 'Soon' : countdownText(left)}
        </span>
      </div>
      <div className="home-timer__bar" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < lit ? 'is-lit' : undefined} />
        ))}
      </div>
      {ready ? (
        <>
          <p>
            {freePack.stored > 1 ? 'Two free packs are' : 'A free pack is'} waiting at the post.
            {left !== null && ` The next one comes in ${countdownText(left)}.`}
          </p>
          <div className="home-timer__take">
            {ENABLED_REALMS.map((realm) => (
              <Button
                key={realm}
                disabled={busy}
                onClick={() => {
                  onClaim(realm);
                }}
              >
                Take {REALM_NAME[realm]}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p>
          A moth is on its way with your next free pack. You can keep up to {freePack.max} waiting.
        </p>
      )}
    </Panel>
  );
}
