import { useEffect, useRef, useState } from 'react';
import {
  MAX_EQUIVALENTS,
  checkDust,
  isMaxed,
  stackEquivalents,
  type Card,
  type CollectionCopy,
  type DustWarning,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { CardDetails } from '../components/CardDetails.js';
import { Icon } from '../components/Icon.js';
import { Notice } from '../components/Notice.js';
import { ApiError } from '../http.js';
import type { BinderApi } from './api.js';
import { CopyList } from './CopyList.js';
import { copySpec } from './copyText.js';
import { TiltCard } from './TiltCard.js';

const WARNING: Record<DustWarning, string> = {
  variant: 'A Foil, Prismatic, Void or Glitch copy is in here. Its shine is gone for good.',
  mint: 'A numbered copy is in here. Mint numbers are never handed out again.',
  edition: 'A First Edition copy is in here. That stamp cannot be earned again.',
  stars: 'A ★2 or ★3 copy is in here (worth 3 or 9 plain copies).',
  lastCopy: 'These are your last copies. The card goes back to a silhouette.',
};

export interface InspectProps {
  card: Card;
  copies: readonly CollectionCopy[];
  api: BinderApi;
  onClose: () => void;
  onDusted: (ids: readonly string[], dust: number) => void;
  /** Screenshot/test hook: hold the shader clock. */
  frozenAt?: number | undefined;
}

/**
 * Card inspect (GDD §12): the live, tiltable copy, its full text at body size, every
 * copy's traits, and dusting with the §9 safety rules (starters never; a second look
 * before a variant, mint number, stamp, star or last copy goes).
 */
export function Inspect({ card, copies, api, onClose, onDusted, frozenAt }: InspectProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shownId, setShownId] = useState(copies[0]?.userCardId ?? '');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
    };
  }, []);

  const shown = copies.find((c) => c.userCardId === shownId) ?? copies[0];
  if (!shown) return null;
  const check = checkDust(card, copies, selected);
  const equivalents = stackEquivalents(copies);

  const toggle = (id: string) => {
    setConfirming(false);
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const dust = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.dust(check.dustable);
      setSelected(new Set());
      setConfirming(false);
      onDusted(check.dustable, r.dust);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The dust jar is stuck. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="inspect panel panel--wood"
      aria-label={`Inspect ${card.name}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="inspect__body">
        <div className="inspect__card">
          <TiltCard spec={copySpec(card, shown)} frozenAt={frozenAt} />
          <Button onClick={onClose}>Close</Button>
        </div>
        <div className="inspect__side">
          <CardDetails {...copySpec(card, shown)} />
          <section className="panel panel--parchment inspect__copies">
            <h2>
              Your copies <span className="inspect__count">×{copies.length}</span>
            </h2>
            <p className="small muted">
              {isMaxed(copies)
                ? `Maxed: ${String(equivalents)} ★1-equivalents, ${String(equivalents - MAX_EQUIVALENTS)} more than ★★★ needs.`
                : `${String(equivalents)} of ${String(MAX_EQUIVALENTS)} ★1-equivalents towards ★★★.`}
            </p>
            <CopyList
              copies={copies}
              shown={shown.userCardId}
              selected={selected}
              onShow={setShownId}
              onToggle={toggle}
            />
            {error && <Notice tone="error">{error}</Notice>}
            {confirming && check.dustable.length > 0 ? (
              <div className="inspect__confirm" role="alertdialog" aria-label="Dust these copies?">
                <p>
                  Dust {check.dustable.length} {check.dustable.length === 1 ? 'copy' : 'copies'} for{' '}
                  <Icon name="stardust" /> {check.dust} Stardust? This cannot be undone.
                </p>
                {check.warnings.length > 0 && (
                  <ul className="inspect__warnings">
                    {check.warnings.map((w) => (
                      <li key={w}>{WARNING[w]}</li>
                    ))}
                  </ul>
                )}
                <div className="row">
                  <Button onClick={() => void dust()} disabled={busy}>
                    {busy ? 'Dusting…' : 'Dust them'}
                  </Button>
                  <Button
                    onClick={() => {
                      setConfirming(false);
                    }}
                  >
                    Keep them
                  </Button>
                </div>
              </div>
            ) : (
              <div className="row inspect__actions">
                <Button
                  disabled={check.dustable.length === 0}
                  onClick={() => {
                    setConfirming(true);
                  }}
                >
                  {check.dustable.length === 0
                    ? 'Pick copies to dust'
                    : `Dust ${String(check.dustable.length)} (+${String(check.dust)})`}
                </Button>
                {selected.size > 0 && (
                  <button
                    type="button"
                    className="binder__clear small"
                    onClick={() => {
                      setSelected(new Set());
                      setConfirming(false);
                    }}
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
