import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { CARD_CATALOG, VARIANTS, needsMintNumber } from '@pixel-packs/shared';
import { Card } from '../components/Card.js';
import { CardDetails } from '../components/CardDetails.js';
import { Panel } from '../components/Panel.js';
import { CardStage } from '../render/CardStage.js';
import { FpsMeter } from '../render/FpsMeter.js';
import { debugSpec, parseDebugParams, type DebugParams } from './debugParams.js';
import './debug.css';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="lab__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * Card lab (`/debug`, T11): any card × variant × stars × badges, live in the
 * Pixi renderer next to the static DOM card and the full-text panel, with an
 * FPS meter. Not in the nav; the state is in the URL.
 */
export function DebugPage() {
  const [query, setQuery] = useSearchParams();
  const p = parseDebugParams(query);
  const set = (patch: Partial<Record<keyof DebugParams, string | number>>) => {
    const next = new URLSearchParams(query);
    for (const [k, v] of Object.entries(patch)) next.set(k, String(v));
    setQuery(next, { replace: true });
  };
  const spec = debugSpec(p);
  const reduced = p.fx === 'settings' ? undefined : p.fx === 'reduced';
  const frozenAt = p.freeze >= 0 ? p.freeze : undefined;
  const stress = Array.from({ length: p.stress }, (_, i) => ({
    ...debugSpec({ ...p, card: CARD_CATALOG[i % CARD_CATALOG.length]?.id ?? p.card }),
    variant: VARIANTS[1 + (i % 4)] ?? 'foil',
    mintNumber: needsMintNumber(VARIANTS[1 + (i % 4)] ?? 'foil') ? i + 1 : null,
  }));

  return (
    <div className="lab">
      <header className="lab__head">
        <h1 className="page-title">Card lab</h1>
        <FpsMeter />
      </header>

      <Panel className="lab__controls" aria-label="Card options">
        <Field label="Card">
          <select
            value={p.card}
            onChange={(e) => {
              set({ card: e.target.value });
            }}
          >
            {CARD_CATALOG.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Variant">
          <select
            value={p.variant}
            onChange={(e) => {
              set({ variant: e.target.value });
            }}
          >
            {VARIANTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Stars">
          <select
            value={p.stars}
            onChange={(e) => {
              set({ stars: e.target.value });
            }}
          >
            {[1, 2, 3].map((s) => (
              <option key={s} value={s}>
                ★{s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Edition">
          <select
            value={p.edition}
            onChange={(e) => {
              set({ edition: e.target.value });
            }}
          >
            <option value={0}>none</option>
            {[1, 2, 3].map((s) => (
              <option key={s} value={s}>
                1st · S{s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mint #">
          <input
            type="number"
            min={1}
            max={99999}
            value={p.mint}
            onChange={(e) => {
              set({ mint: e.target.value });
            }}
          />
        </Field>
        <Field label="Effects">
          <select
            value={p.fx}
            onChange={(e) => {
              set({ fx: e.target.value });
            }}
          >
            <option value="settings">follow settings</option>
            <option value="full">full</option>
            <option value="reduced">reduced</option>
          </select>
        </Field>
        <Field label="Stress">
          <select
            value={p.stress}
            onChange={(e) => {
              set({ stress: e.target.value });
            }}
          >
            {[0, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'off' : `${String(n)} live cards`}
              </option>
            ))}
          </select>
        </Field>
      </Panel>

      <section className="lab__row" aria-label="Preview">
        <figure className="lab__cell" data-testid="pixi-card">
          <CardStage specs={[spec]} reduced={reduced} frozenAt={frozenAt} />
          <figcaption>Pixi (live)</figcaption>
        </figure>
        <figure className="lab__cell" data-testid="dom-card">
          <Card {...spec} />
          <figcaption>DOM (static)</figcaption>
        </figure>
        <CardDetails {...spec} />
      </section>

      {p.all === 1 && (
        <section className="lab__row" aria-label="All variants" data-testid="all-variants">
          <CardStage
            specs={VARIANTS.map((v) => debugSpec(p, v))}
            reduced={reduced}
            frozenAt={frozenAt}
          />
        </section>
      )}

      {stress.length > 0 && (
        <section className="lab__row" aria-label="Stress test" data-testid="stress">
          <CardStage specs={stress} columns={6} reduced={reduced} frozenAt={frozenAt} scale={2} />
        </section>
      )}
    </div>
  );
}
