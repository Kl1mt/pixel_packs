import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import type { UI_PANELS } from '@pixel-packs/shared';

export type PanelMaterial = keyof typeof UI_PANELS;

type PanelProps<T extends ElementType> = {
  /** 9-slice material (GDD §16): parchment for content, wood for frames and bars. */
  material?: PanelMaterial;
  as?: T;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

/** A 9-slice pixel-art panel at `UI_SCALE`; corners stay crisp at any size. */
export function Panel<T extends ElementType = 'section'>({
  material = 'parchment',
  as,
  className,
  children,
  ...rest
}: PanelProps<T>) {
  const Tag: ElementType = as ?? 'section';
  const cls = ['panel', `panel--${material}`, className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
