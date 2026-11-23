import { useEffect, useReducer, useRef } from 'react';
import type { OpenedCard, PackOpening } from '@pixel-packs/shared';
import { audio, useMusic } from '../audio/audio.js';
import { flipSounds, moodLayers } from '../audio/events.js';
import { economyApi } from '../economy/api.js';
import { economyStore } from '../economy/useEconomy.js';
import { useReducedCardEffects } from '../render/CardStage.js';
import { RevealStage } from './RevealStage.js';
import { SummaryStage } from './SummaryStage.js';
import { TearStage } from './TearStage.js';
import {
  initialReveal,
  packMood,
  revealReducer,
  revealSequence,
  type RevealState,
} from './reveal.js';
import { packArt, themeFor } from './themes.js';
import './opening.css';

export interface OpeningSceneProps {
  opening: PackOpening;
  /** Continuing an unfinished reveal ("Resume reveal"): the pack is already open. */
  resumed: boolean;
  packName: string;
  canOpenAnother: boolean;
  /** Label of the results' leave button; defaults to "Back to the shelf". */
  doneLabel?: string;
  onOpenAnother: () => void;
  onClose: () => void;
}

const AUTO_FLIP_MS = 320;
const AUTO_FLIP_MS_REDUCED = 120;

/**
 * The opening scene over the whole screen (GDD §7): tear → card stack → results.
 * The roll was saved by the server before this mounts; reaching the results tells
 * the server the reveal is finished, so "Resume reveal" goes away.
 */
export function OpeningScene(p: OpeningSceneProps) {
  const { opening } = p;
  const reduced = useReducedCardEffects();
  const [state, dispatch] = useReducer(revealReducer, p.resumed, initialReveal);
  const sequence = revealSequence(opening);
  const root = useRef<HTMLDivElement>(null);
  const marked = useRef<string | null>(null);
  useMusic('opening', moodLayers(packMood(opening)));
  useOpeningSounds(state, sequence);

  useEffect(() => {
    root.current?.focus();
  }, [state.phase]);

  useEffect(() => {
    if (!state.auto) return;
    const t = setTimeout(
      () => {
        dispatch({ type: 'flip' });
      },
      reduced ? AUTO_FLIP_MS_REDUCED : AUTO_FLIP_MS,
    );
    return () => {
      clearTimeout(t);
    };
  }, [state.auto, state.flipped, reduced]);

  useEffect(() => {
    if (state.phase !== 'summary' || marked.current === opening.id) return;
    marked.current = opening.id;
    economyApi.markRevealed(opening.id).then(
      () => economyStore.refresh(),
      // Not fatal: the next visit offers "Resume reveal" again.
      () => undefined,
    );
  }, [state.phase, opening.id]);

  return (
    <div
      ref={root}
      className="opening"
      role="dialog"
      aria-modal="true"
      aria-label={`Opening a ${p.packName}`}
      data-phase={state.phase}
      data-theme={themeFor(opening.packTypeId).id}
      tabIndex={-1}
    >
      {state.phase === 'tear' && (
        <TearStage
          theme={themeFor(opening.packTypeId)}
          packSrc={packArt(opening.packTypeId)}
          packName={p.packName}
          mood={packMood(opening)}
          reduced={reduced}
          onTorn={() => {
            audio.play('open.tear');
            dispatch({ type: 'torn' });
          }}
        />
      )}
      {state.phase === 'reveal' && (
        <RevealStage
          sequence={sequence}
          flipped={state.flipped}
          auto={state.auto}
          onFlip={() => {
            dispatch({ type: 'flip' });
          }}
          onRevealAll={() => {
            dispatch({ type: 'revealAll' });
          }}
          onSkip={() => {
            dispatch({ type: 'skip' });
          }}
          onResults={() => {
            dispatch({ type: 'results' });
          }}
        />
      )}
      {state.phase === 'summary' && (
        <SummaryStage
          opening={opening}
          canOpenAnother={p.canOpenAnother}
          doneLabel={p.doneLabel}
          onOpenAnother={p.onOpenAnother}
          onDone={p.onClose}
        />
      )}
    </div>
  );
}

/** SFX for the scene (GDD §20): the stack slides in, then each flip and its stingers. */
function useOpeningSounds(state: RevealState, sequence: readonly OpenedCard[]) {
  const shown = useRef(state.flipped);
  useEffect(() => {
    if (state.phase === 'reveal') audio.play('open.slide');
  }, [state.phase]);
  useEffect(() => {
    const prev = shown.current;
    shown.current = state.flipped;
    // One flip at a time; "Skip" jumps to the end silently.
    if (state.phase !== 'reveal' || state.flipped !== prev + 1) return;
    const card = sequence[state.flipped - 1];
    if (card) for (const [id, delay] of flipSounds(card)) audio.play(id, delay);
  }, [state.phase, state.flipped, sequence]);
}
