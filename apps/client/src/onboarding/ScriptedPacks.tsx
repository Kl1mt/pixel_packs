import { lazy, Suspense, useRef, useState } from 'react';
import type { EconomyState, PackOpening, PackTypeId } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { Panel } from '../components/Panel.js';
import { economyApi, newIdempotencyKey } from '../economy/api.js';
import { economyStore } from '../economy/useEconomy.js';
import { ApiError } from '../http.js';
import { ownedCount, packName } from '../packs/ShopShelf.js';
import '../packs/packs.css';

const OpeningScene = lazy(() =>
  import('../opening/OpeningScene.js').then((m) => ({ default: m.OpeningScene })),
);

/** What each scripted pack teaches (GDD §17 steps 2–3). */
const LESSONS = [
  {
    title: 'Your first pack',
    text: 'Watch the card backs before they flip. A coloured glow means something rare is waiting, and the last card is always the featured one.',
  },
  {
    title: 'One more',
    text: 'This one hides a shiny. Variants like Foil catch the light; inspect one in your binder and tilt it around.',
  },
] as const;

/** Mossgrove first, then Starhollow (the satchel's order); any realm pack if those are gone. */
export function nextScriptedPack(s: EconomyState, opened: number): PackTypeId | null {
  const preferred: PackTypeId = opened === 0 ? 'realm:mossgrove' : 'realm:starhollow';
  if (ownedCount(s, preferred) > 0) return preferred;
  return s.packs.find((p) => p.packTypeId !== 'mythic')?.packTypeId ?? null;
}

export interface ScriptedPacksProps {
  economy: EconomyState;
  /** Scripted packs opened so far (0 or 1 here). */
  opened: number;
  busy: boolean;
  /** A reveal reached its results and was closed. */
  onOpened: () => void;
  onSkip: () => void;
}

/** The two scripted onboarding packs, torn open in the full opening scene. */
export function ScriptedPacks({ economy, opened, busy, onOpened, onSkip }: ScriptedPacksProps) {
  const [scene, setScene] = useState<{ opening: PackOpening; resumed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // Kept until the open succeeds, so a retry after a network error is the same action.
  const key = useRef<string | null>(null);
  const lesson = LESSONS[Math.min(opened, LESSONS.length - 1)] ?? LESSONS[0];
  const pack = nextScriptedPack(economy, opened);

  const go = async (work: () => Promise<void>) => {
    setWorking(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) key.current = null;
      setError(err instanceof ApiError ? err.message : 'The satchel is stuck. Please try again.');
    } finally {
      setWorking(false);
    }
  };
  const open = (id: PackTypeId) =>
    go(async () => {
      key.current ??= newIdempotencyKey();
      const opening = await economyApi.open(id, key.current);
      key.current = null;
      setScene({ opening, resumed: false });
      void economyStore.refresh();
    });
  const resume = () =>
    go(async () => {
      const opening = await economyApi.pending();
      if (opening) setScene({ opening, resumed: true });
      else await economyStore.refresh();
    });

  return (
    <Panel className="scripted" aria-label="Scripted packs">
      <p className="small muted">Pack {Math.min(opened + 1, 2)} of 2</p>
      <h2>{lesson.title}</h2>
      <p>{lesson.text}</p>
      {pack && (
        <img
          className="scripted__pack"
          src={`/assets/packs/${pack.slice(6)}.png`}
          alt={packName(pack)}
          width={192}
          height={192}
        />
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="welcome__actions">
        {economy.pendingOpeningId ? (
          <Button disabled={busy || working} onClick={() => void resume()}>
            Finish revealing
          </Button>
        ) : pack ? (
          <Button disabled={busy || working} onClick={() => void open(pack)}>
            Open the {packName(pack)}
          </Button>
        ) : (
          <p>The satchel is empty.</p>
        )}
        <Button disabled={busy || working} onClick={onSkip}>
          {pack ? 'Save it for later' : 'Continue'}
        </Button>
      </div>
      {scene && (
        <Suspense fallback={<div className="opening opening--loading" />}>
          <OpeningScene
            key={scene.opening.id}
            opening={scene.opening}
            resumed={scene.resumed}
            packName={packName(scene.opening.packTypeId)}
            canOpenAnother={false}
            onOpenAnother={() => undefined}
            doneLabel={opened === 0 ? 'On to the next pack' : 'Off to the binder'}
            onClose={() => {
              setScene(null);
              onOpened();
            }}
          />
        </Suspense>
      )}
    </Panel>
  );
}
