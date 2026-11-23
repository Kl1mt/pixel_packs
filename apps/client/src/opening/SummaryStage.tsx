import { useEffect, useState } from 'react';
import type { DustExtrasPreview, PackOpening } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { CurrencyBadge } from '../components/CurrencyBadge.js';
import { Notice } from '../components/Notice.js';
import { economyApi } from '../economy/api.js';
import { economyStore } from '../economy/useEconomy.js';
import { ApiError } from '../http.js';
import { NewTag, OpenedFace } from './RevealStage.js';
import { summarize } from './reveal.js';

export interface SummaryStageProps {
  opening: PackOpening;
  /** Another pack of the same type is in the inventory. */
  canOpenAnother: boolean;
  onOpenAnother: () => void;
  onDone: () => void;
}

type DustState =
  | { s: 'loading' }
  | { s: 'ready'; preview: DustExtrasPreview }
  | { s: 'confirm'; preview: DustExtrasPreview }
  | { s: 'busy' }
  | { s: 'done'; dusted: number; dust: number }
  | { s: 'error'; message: string };

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** Step 3: all five cards with NEW / extra tags, "Dust extras", and the way back (GDD §7). */
export function SummaryStage({
  opening,
  canOpenAnother,
  onOpenAnother,
  onDone,
}: SummaryStageProps) {
  const sum = summarize(opening);
  const [dust, setDust] = useState<DustState>({ s: 'loading' });

  useEffect(() => {
    let live = true;
    economyApi.dustExtrasPreview().then(
      (preview) => {
        if (live) setDust({ s: 'ready', preview });
      },
      () => {
        if (live) setDust({ s: 'error', message: 'Could not count your extras.' });
      },
    );
    return () => {
      live = false;
    };
  }, [opening.id]);

  const dustNow = () => {
    setDust({ s: 'busy' });
    economyApi.dustExtras().then(
      (r) => {
        economyStore.setWallet(r.wallet);
        setDust({ s: 'done', dusted: r.dusted, dust: r.dust });
      },
      (err: unknown) => {
        setDust({
          s: 'error',
          message: err instanceof ApiError ? err.message : 'Dusting failed. Please try again.',
        });
      },
    );
  };

  return (
    <div className="summary">
      <header className="summary__head">
        <h2 className="summary__title">Your pulls</h2>
        <p className="summary__counts">
          {plural(sum.newCount, 'new card', 'new cards')} ·{' '}
          {plural(sum.extraCount, 'extra', 'extras')}
        </p>
      </header>

      <ul className="summary__cards" aria-label="Cards in this pack">
        {opening.cards.map((c) => (
          <li key={c.slot} className="summary__card" data-featured={c.featured}>
            <OpenedFace card={c} />
            <NewTag card={c} />
          </li>
        ))}
      </ul>

      <div className="summary__dust" aria-live="polite">
        {dust.s === 'ready' &&
          (dust.preview.copies.length === 0 ? (
            <p className="summary__note">
              Nothing to dust yet: you keep every copy a card needs to reach ★3.
            </p>
          ) : (
            <Button
              onClick={() => {
                setDust({ s: 'confirm', preview: dust.preview });
              }}
            >
              Dust extras
            </Button>
          ))}
        {dust.s === 'confirm' && (
          <div className="summary__confirm">
            <p className="summary__note">
              Dust {plural(dust.preview.copies.length, 'extra copy', 'extra copies')} from your
              whole binder for <CurrencyBadge currency="dust" amount={dust.preview.dust} />? Copies
              a card still needs for ★3 and every special copy stay.
            </p>
            <Button onClick={dustNow}>Dust them</Button>
            <Button
              onClick={() => {
                setDust({ s: 'ready', preview: dust.preview });
              }}
            >
              Keep them
            </Button>
          </div>
        )}
        {dust.s === 'busy' && <p className="summary__note">Sweeping up…</p>}
        {dust.s === 'done' && (
          <p className="summary__note">
            Dusted {plural(dust.dusted, 'copy', 'copies')}: +
            <CurrencyBadge currency="dust" amount={dust.dust} />
          </p>
        )}
        {dust.s === 'error' && <Notice tone="error">{dust.message}</Notice>}
      </div>

      <div className="summary__actions">
        {canOpenAnother && <Button onClick={onOpenAnother}>Open another</Button>}
        <Button onClick={onDone}>Back to the shelf</Button>
      </div>
    </div>
  );
}
