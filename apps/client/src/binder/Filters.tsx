import type { ReactNode } from 'react';
import {
  BINDER_SORTS,
  DEFAULT_BINDER_FILTER,
  RARITIES,
  StarsSchema,
  VARIANTS,
  isFiltered,
  type BinderFilter,
  type BinderSort,
  type OwnedFilter,
} from '@pixel-packs/shared';
import { variantName } from './copyText.js';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const SORT_LABEL: Record<BinderSort, string> = {
  number: 'Card number',
  rarity: 'Rarity',
  name: 'Name',
  count: 'Most copies',
  newest: 'Newest',
};

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="binder__field">
      <span className="small">{label}</span>
      <select
        className="binder__select"
        value={value}
        onChange={(e) => {
          const picked = options.find(([v]) => v === e.target.value);
          if (picked) onChange(picked[0]);
        }}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

const all = <T extends string>(values: readonly T[], name: (v: T) => string) =>
  [['all', 'All'] as const, ...values.map((v) => [v, name(v)] as const)] as const;

export interface FiltersProps {
  filter: BinderFilter;
  sort: BinderSort;
  onFilter: (f: BinderFilter) => void;
  onSort: (s: BinderSort) => void;
  children?: ReactNode;
}

/** Binder filters and sorting (GDD §12): rarity, variant, stars, owned, edition, minted. */
export function Filters({ filter, sort, onFilter, onSort, children }: FiltersProps) {
  const set = <K extends keyof BinderFilter>(k: K, v: BinderFilter[K]) => {
    onFilter({ ...filter, [k]: v });
  };
  const stars = filter.stars === 'all' ? 'all' : String(filter.stars);
  return (
    <div className="binder__filters" role="group" aria-label="Filters and sorting">
      <Select
        label="Rarity"
        value={filter.rarity}
        options={all(RARITIES, cap)}
        onChange={(v) => {
          set('rarity', v);
        }}
      />
      <Select
        label="Variant"
        value={filter.variant}
        options={all(VARIANTS, variantName)}
        onChange={(v) => {
          set('variant', v);
        }}
      />
      <Select
        label="Stars"
        value={stars}
        options={[
          ['all', 'Any'],
          ['2', '★★ or more'],
          ['3', '★★★'],
        ]}
        onChange={(v) => {
          set('stars', v === 'all' ? 'all' : StarsSchema.parse(Number(v)));
        }}
      />
      <Select<OwnedFilter>
        label="Show"
        value={filter.owned}
        options={[
          ['all', 'All cards'],
          ['owned', 'Owned'],
          ['missing', 'Missing'],
        ]}
        onChange={(v) => {
          set('owned', v);
        }}
      />
      <label className="choice binder__check">
        <input
          type="checkbox"
          checked={filter.edition}
          onChange={(e) => {
            set('edition', e.target.checked);
          }}
        />
        <span className="small">1st Edition</span>
      </label>
      <label className="choice binder__check">
        <input
          type="checkbox"
          checked={filter.minted}
          onChange={(e) => {
            set('minted', e.target.checked);
          }}
        />
        <span className="small">Minted</span>
      </label>
      <Select
        label="Sort"
        value={sort}
        options={BINDER_SORTS.map((s) => [s, SORT_LABEL[s]] as const)}
        onChange={onSort}
      />
      {isFiltered(filter) && (
        <button
          type="button"
          className="binder__clear small"
          onClick={() => {
            onFilter(DEFAULT_BINDER_FILTER);
          }}
        >
          Clear filters
        </button>
      )}
      {children}
    </div>
  );
}
