import { ICON_SIZE, UI_SCALE, iconFile, type IconName } from '@pixel-packs/shared';

export interface IconProps {
  name: IconName;
  /** Integer pixel scale (defaults to `UI_SCALE`). */
  scale?: number;
  /** Accessible name; omit for decorative icons next to a text label. */
  label?: string;
  className?: string;
}

/** A 16×16 pixel icon from T06, drawn at an integer scale. */
export function Icon({ name, scale = UI_SCALE, label, className }: IconProps) {
  const size = ICON_SIZE * Math.max(1, Math.round(scale));
  return (
    <img
      className={['icon', className].filter(Boolean).join(' ')}
      src={iconFile(name)}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  );
}
