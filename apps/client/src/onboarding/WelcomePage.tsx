import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { OnboardingStage } from '@pixel-packs/shared';
import { Notice } from '../components/Notice.js';
import { economyStore, useEconomy } from '../economy/useEconomy.js';
import { ApiError } from '../http.js';
import { Courier } from './Courier.js';
import { ScriptedPacks } from './ScriptedPacks.js';
import { StarterCards } from './StarterCards.js';
import { onboardingStore, useOnboarding } from './useOnboarding.js';
import './onboarding.css';

/** Home after onboarding, with the free-pack timer pointed out (GDD §17 step 5). */
export const HOME_AFTER_WELCOME = '/?welcome=1';
/** The binder with its two-tooltip tour (GDD §17 step 4). */
export const BINDER_TOUR = '/binder?tour=1';

/**
 * The onboarding flow (GDD §17): the courier, the two scripted packs, then the binder
 * tour (on the binder page) and the five starter cards. The server keeps the stage, so
 * a reload continues where the player left. Every step, and the whole flow, can be skipped.
 */
export function WelcomePage() {
  const onboarding = useOnboarding();
  const economy = useEconomy();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = async (stage: OnboardingStage, then?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onboardingStore.advance(stage);
      if (then) void navigate(then, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The post is slow today. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (onboarding.status === 'error' || economy.status === 'error')
    return <Notice tone="error">The Wandering Post is not answering. Please reload.</Notice>;
  if (onboarding.status !== 'ready' || economy.status !== 'ready')
    return <p className="on-ground">A moth is fluttering in…</p>;

  const { stage, scriptedPacksOpened, starterCards } = onboarding.state;
  if (stage === 'done') return <Navigate to="/" replace />;
  if (stage === 'tour') return <Navigate to={BINDER_TOUR} replace />;

  return (
    <div className="welcome">
      <div className="welcome__head">
        <h1 className="page-title">Welcome to the Wandering Post</h1>
        <button
          type="button"
          className="welcome__skip-all small"
          disabled={busy}
          onClick={() => void advance('done', HOME_AFTER_WELCOME)}
        >
          Skip the welcome
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {stage === 'courier' && <Courier busy={busy} onDone={() => void advance('packs')} />}
      {stage === 'packs' && (
        <ScriptedPacks
          economy={economy.state}
          opened={scriptedPacksOpened}
          busy={busy}
          onOpened={() => {
            void (async () => {
              await Promise.all([onboardingStore.refresh(), economyStore.refresh()]);
              const s = onboardingStore.get();
              if (s.status === 'ready' && s.state.scriptedPacksOpened >= 2)
                await advance('tour', BINDER_TOUR);
            })();
          }}
          onSkip={() => void advance('tour', BINDER_TOUR)}
        />
      )}
      {stage === 'starter' && (
        <StarterCards
          copies={starterCards ?? []}
          busy={busy}
          onDone={() => void advance('done', HOME_AFTER_WELCOME)}
        />
      )}
    </div>
  );
}
