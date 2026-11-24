import { useState } from 'react';
import { Button } from '../components/Button.js';
import { Panel } from '../components/Panel.js';

/** The moth courier's three lines (GDD §17 step 1). */
export const COURIER_LINES = [
  'Special delivery from the Wandering Post! Mind the wings.',
  'This satchel is yours: two sealed packs, one from Mossgrove and one from Starhollow.',
  'Tear them open and keep what you find. Your binder has a page for every card.',
] as const;

export interface CourierProps {
  busy: boolean;
  onDone: () => void;
}

/** A parchment letter with the Mail Moth peeking over its edge, one line at a time. */
export function Courier({ busy, onDone }: CourierProps) {
  const [line, setLine] = useState(0);
  const last = line === COURIER_LINES.length - 1;
  return (
    <div className="courier">
      <img
        className="courier__moth"
        src="/assets/cards/STA-008.png"
        alt="A mail moth with a satchel"
        width={192}
        height={192}
        draggable={false}
      />
      <Panel className="courier__letter pinned" aria-live="polite">
        <p className="courier__from small muted">The Wandering Post · moth courier</p>
        <p className="courier__line" data-testid="courier-line">
          {COURIER_LINES[line]}
        </p>
        <div className="courier__satchel" aria-hidden="true">
          {line >= 1 && (
            <>
              <img src="/assets/packs/mossgrove.png" alt="" width={96} height={96} />
              <img src="/assets/packs/starhollow.png" alt="" width={96} height={96} />
            </>
          )}
        </div>
        <div className="welcome__actions">
          <Button
            disabled={busy}
            onClick={() => {
              if (last) onDone();
              else setLine(line + 1);
            }}
          >
            {last ? 'Take the satchel' : 'Next'}
          </Button>
          <span className="small muted" aria-hidden="true">
            {line + 1} / {COURIER_LINES.length}
          </span>
        </div>
      </Panel>
    </div>
  );
}
