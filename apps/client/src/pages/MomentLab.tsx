import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ENABLED_REALMS, RARITIES, VARIANTS } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { useReducedCardEffects } from '../render/CardStage.js';
import { RevealStage } from '../opening/RevealStage.js';
import { TearStage } from '../opening/TearStage.js';
import { packArt, themeFor } from '../opening/themes.js';
import { labMood, labSequence, parseMomentLab, type MomentLabParams } from './momentLabParams.js';
import '../opening/opening.css';
import './debug.css';

const OPTIONS = {
  scene: ['reveal', 'tear'],
  rarity: RARITIES,
  variant: VARIANTS,
  realm: ENABLED_REALMS,
  fx: ['settings', 'full', 'reduced'],
} as const;

/**
 * `/debug/moments` (T13): replays the reveal moment of any rarity × variant × realm,
 * or a realm's tear, with nothing sent to the server. `at` holds one frame for screenshots.
 */
export function MomentLab() {
  const [q, setQ] = useSearchParams();
  const p = parseMomentLab(q);
  const settingsReduced = useReducedCardEffects();
  const reduced = p.fx === 'settings' ? settingsReduced : p.fx === 'reduced';
  const [run, setRun] = useState(0);
  const set = (k: keyof MomentLabParams, v: string) => {
    const next = new URLSearchParams(q);
    next.set(k, v);
    setQ(next, { replace: true });
  };
  const sequence = labSequence(p);
  const packTypeId = p.realm === 'mossgrove' ? 'realm:mossgrove' : 'realm:starhollow';

  return (
    <div
      className="opening lab-moments"
      data-theme={themeFor(packTypeId).id}
      role="dialog"
      aria-label="Moment lab"
    >
      <form
        className="lab-moments__bar"
        aria-label="Moment options"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => (
          <label key={k}>
            <span>{k}</span>
            <select
              value={p[k]}
              onChange={(e) => {
                set(k, e.target.value);
              }}
            >
              {OPTIONS[k].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
        <Button
          onClick={() => {
            setRun((n) => n + 1);
          }}
        >
          Replay
        </Button>
      </form>
      {p.scene === 'tear' ? (
        <TearStage
          key={`${String(run)}-${p.realm}-${p.rarity}`}
          theme={themeFor(packTypeId)}
          packSrc={packArt(packTypeId)}
          packName={`${p.realm} pack`}
          mood={labMood(p.rarity)}
          reduced={reduced}
          onTorn={() => undefined}
        />
      ) : (
        <RevealStage
          key={`${String(run)}-${p.realm}-${p.rarity}-${p.variant}-${p.fx}-${String(p.at)}`}
          sequence={sequence}
          flipped={sequence.length}
          auto={false}
          reduced={reduced}
          momentFrozenAt={p.at < 0 ? undefined : p.at}
          onFlip={() => undefined}
          onRevealAll={() => undefined}
          onSkip={() => undefined}
          onResults={() => {
            setRun((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
