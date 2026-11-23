import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button.js';
import { onboardingStore } from './useOnboarding.js';

/** The two binder tooltips (GDD §17 step 4); each names the element it points at. */
export const TOUR_STEPS = [
  {
    targets: ['.binder__realms'],
    title: 'One book, every realm',
    text: 'Each realm has its own pages. The tabs jump there and show how much of it you have found.',
  },
  {
    targets: ['.pocket--owned', '.binder__book'],
    title: 'A pocket for every card',
    text: 'Cards you own sit in pockets, extra copies stacked behind. Pick one to inspect it. Empty sleeves wait for cards you haven’t found yet.',
  },
] as const;

const GAP = 12;
const WIDTH = 340;

function findTarget(selectors: readonly string[]): HTMLElement | null {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (el) return el;
  }
  return null;
}

/**
 * The binder tour: a parchment note under the element it explains, which gets a
 * dashed frame. Finishing or skipping moves onboarding on to the starter cards.
 */
export function BinderTour() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ step: number; top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped to look for the target again while it isn't on the page yet.
  const [tick, setTick] = useState(0);
  const current = TOUR_STEPS[step] ?? TOUR_STEPS[0];

  useLayoutEffect(() => {
    const el = findTarget(current.targets);
    if (!el) return;
    el.classList.add('tour-target');
    const place = () => {
      const r = el.getBoundingClientRect();
      const maxLeft = document.documentElement.clientWidth - Math.min(WIDTH, innerWidth - 16) - 8;
      setPos({
        step,
        top: r.bottom + window.scrollY + GAP,
        left: Math.max(8, Math.min(r.left + window.scrollX, maxLeft)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      el.classList.remove('tour-target');
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [current, step, tick]);

  // The pockets arrive with the collection: look again shortly if nothing was found.
  const placed = pos?.step === step ? pos : null;
  const note = useRef<HTMLDivElement>(null);
  // Bring the note (and the target just above it) into view once it is placed.
  const placedAt = placed ? `${String(step)}:${String(placed.top)}` : null;
  useEffect(() => {
    if (placedAt) note.current?.scrollIntoView({ block: 'nearest' });
  }, [placedAt]);
  useEffect(() => {
    if (placed) return;
    const t = window.setTimeout(() => {
      setTick((n) => n + 1);
    }, 200);
    return () => {
      window.clearTimeout(t);
    };
  }, [placed, tick]);

  const finish = async () => {
    setBusy(true);
    try {
      await onboardingStore.advance('starter');
    } catch {
      // The welcome page reads the stage again and shows any error there.
    }
    void navigate('/welcome', { replace: true });
  };
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div
      ref={note}
      className="tour"
      role="dialog"
      aria-label="Binder tour"
      aria-describedby="tour-text"
      style={
        placed ? { top: placed.top, left: placed.left, maxWidth: WIDTH } : { visibility: 'hidden' }
      }
    >
      <p className="small muted">
        Binder tour · {step + 1} / {TOUR_STEPS.length}
      </p>
      <h2>{current.title}</h2>
      <p id="tour-text">{current.text}</p>
      <div className="welcome__actions">
        <Button
          disabled={busy}
          onClick={() => {
            if (last) void finish();
            else setStep(step + 1);
          }}
        >
          {last ? 'Got it' : 'Next'}
        </Button>
        {!last && (
          <button
            type="button"
            className="welcome__skip-all small"
            disabled={busy}
            onClick={() => void finish()}
          >
            Skip the tour
          </button>
        )}
      </div>
    </div>
  );
}
