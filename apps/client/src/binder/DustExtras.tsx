import { useState } from 'react';
import type { DustExtrasPreview } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Icon } from '../components/Icon.js';
import { ApiError } from '../http.js';
import type { BinderApi } from './api.js';

/**
 * "Dust extras" (GDD §9): plain copies beyond a maxed card, after a preview. Variants,
 * stamps, mint numbers and starters are never touched.
 */
export function DustExtras({
  api,
  onDusted,
}: {
  api: BinderApi;
  onDusted: (count: number, dust: number) => void;
}) {
  const [preview, setPreview] = useState<DustExtrasPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (err: unknown) => {
    setError(err instanceof ApiError ? err.message : 'The dust jar is stuck. Please try again.');
  };

  if (!preview)
    return (
      <div className="binder__extras">
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            api
              .dustExtrasPreview()
              .then(setPreview, fail)
              .finally(() => {
                setBusy(false);
              });
          }}
        >
          Dust extras…
        </Button>
        {error && <p className="small binder__error">{error}</p>}
      </div>
    );

  const n = preview.copies.length;
  return (
    <div
      className="binder__extras panel panel--parchment"
      role="alertdialog"
      aria-label="Dust extras"
    >
      {n === 0 ? (
        <p className="small">
          No extras yet. A card has extras once you hold more than a ★★★ worth of it.
        </p>
      ) : (
        <p className="small">
          Dust {n} extra plain {n === 1 ? 'copy' : 'copies'} for <Icon name="stardust" />{' '}
          {preview.dust}? Variants, stamps, mint numbers and starters stay.
        </p>
      )}
      <div className="row">
        {n > 0 && (
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              api
                .dustExtras()
                .then((r) => {
                  setPreview(null);
                  onDusted(r.dusted, r.dust);
                }, fail)
                .finally(() => {
                  setBusy(false);
                });
            }}
          >
            {busy ? 'Dusting…' : 'Dust extras'}
          </Button>
        )}
        <Button
          onClick={() => {
            setPreview(null);
          }}
        >
          {n > 0 ? 'Keep them' : 'Close'}
        </Button>
      </div>
      {error && <p className="small binder__error">{error}</p>}
    </div>
  );
}
