import { useState } from 'react';
import type { CollectionCopy } from '@pixel-packs/shared';
import { copyLine } from './copyText.js';

/** Row height in screen px (must match `.copies__row` in binder.css). */
export const COPY_ROW = 44;
const VISIBLE_ROWS = 6;
const OVERSCAN = 4;

export interface CopyListProps {
  copies: readonly CollectionCopy[];
  shown: string;
  selected: ReadonlySet<string>;
  onShow: (id: string) => void;
  onToggle: (id: string) => void;
}

/**
 * Every copy in the stack (GDD §9 "expanding a stack lists each copy's traits"), best
 * first. Windowed: only the rows in view are in the DOM, so a 1 000-copy stack stays cheap.
 */
export function CopyList({ copies, shown, selected, onShow, onToggle }: CopyListProps) {
  const [top, setTop] = useState(0);
  const first = Math.max(0, Math.floor(top / COPY_ROW) - OVERSCAN);
  const last = Math.min(copies.length, first + VISIBLE_ROWS + 2 * OVERSCAN);
  const height = Math.min(copies.length, VISIBLE_ROWS) * COPY_ROW;
  return (
    <div
      className="copies"
      style={{ height }}
      onScroll={(e) => {
        setTop(e.currentTarget.scrollTop);
      }}
      role="list"
      aria-label={`Your copies, ${String(copies.length)}`}
      data-rendered={last - first}
    >
      <div style={{ height: copies.length * COPY_ROW, position: 'relative' }}>
        {copies.slice(first, last).map((c, i) => {
          const line = copyLine(c);
          return (
            <div
              key={c.userCardId}
              role="listitem"
              className="copies__row"
              data-shown={c.userCardId === shown ? 'true' : undefined}
              style={{ top: (first + i) * COPY_ROW }}
            >
              <input
                type="checkbox"
                aria-label={c.accountBound ? `${line} (starter, kept)` : `Select ${line} to dust`}
                checked={selected.has(c.userCardId)}
                disabled={c.accountBound}
                onChange={() => {
                  onToggle(c.userCardId);
                }}
              />
              <button
                type="button"
                className="copies__show"
                aria-pressed={c.userCardId === shown}
                onClick={() => {
                  onShow(c.userCardId);
                }}
              >
                {line}
                {c.accountBound && <span className="copies__bound"> · kept</span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
