import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CanvasTextMetrics, TextStyle } from 'pixi.js';
import { CARD_CATALOG, CARD_SCALE, type Stars } from '@pixel-packs/shared';
import { Card } from '../components/Card.js';
import { cardFaceModel } from '../components/cardFace.js';
import { CardStage } from '../render/CardStage.js';
import { rulesTextLines, rulesTextStyle } from '../render/cardView.js';
import './debug.css';

/** Pixi's own layout of one card's face rules (the same metrics `Text` draws with). */
export interface PixiRulesMetrics {
  card: string;
  stars: Stars;
  lines: number;
  lineHeight: number;
  maxLineWidth: number;
}

const ALL_STARS: readonly Stars[] = [1, 2, 3];

function parse(query: URLSearchParams) {
  const ids = query.get('cards')?.split(',').filter(Boolean);
  const stars = query
    .get('stars')
    ?.split(',')
    .map(Number)
    .filter((s): s is Stars => ALL_STARS.includes(s as Stars));
  const cards = ids ? CARD_CATALOG.filter((c) => ids.includes(c.id)) : CARD_CATALOG;
  return { cards, stars: stars?.length ? stars : ALL_STARS, pixi: query.get('pixi') === '1' };
}

/**
 * Rules-fit lab (`/debug/rules`, T24): every catalog card × star level as DOM cards, plus
 * Pixi's text metrics for the same faces, so `e2e/rulesFit.spec.ts` can check that the compact
 * rules text fits `CARD_FACE.rules`. `?cards=STA-012,STA-010&stars=1&pixi=1` narrows the sheet
 * and adds live Pixi cards for screenshots.
 */
export function RulesLab() {
  const [query] = useSearchParams();
  const { cards, stars, pixi } = parse(query);
  const specs = useMemo(
    () => cards.flatMap((card) => stars.map((s) => ({ card, stars: s }))),
    [cards, stars],
  );
  const [metrics, setMetrics] = useState<PixiRulesMetrics[] | null>(null);

  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      if (!live) return;
      const style = new TextStyle(rulesTextStyle(CARD_SCALE));
      setMetrics(
        specs.map(({ card, stars: s }) => {
          const m = CanvasTextMetrics.measureText(
            rulesTextLines(cardFaceModel(card, { stars: s })),
            style,
          );
          return {
            card: card.id,
            stars: s,
            lines: m.lines.length,
            lineHeight: m.lineHeight,
            maxLineWidth: Math.max(0, ...m.lineWidths),
          };
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [specs]);

  return (
    <div className="lab">
      <header className="lab__head">
        <h1 className="page-title">Rules fit</h1>
      </header>
      {pixi && (
        <>
          <h2 className="on-ground">Pixi card</h2>
          <CardStage specs={specs} columns={specs.length} frozenAt={1} reduced />
          <h2 className="on-ground">DOM card</h2>
        </>
      )}
      <div className="rules-lab">
        {specs.map(({ card, stars: s }) => (
          <figure
            key={`${card.id}-${String(s)}`}
            className="rules-lab__item"
            data-card={card.id}
            data-stars={s}
          >
            <Card card={card} stars={s} />
            <figcaption className="on-ground">
              {card.id} ★{s}
            </figcaption>
          </figure>
        ))}
      </div>
      {metrics && (
        <output data-testid="pixi-rules-metrics" hidden>
          {JSON.stringify(metrics)}
        </output>
      )}
    </div>
  );
}
