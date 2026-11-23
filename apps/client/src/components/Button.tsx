import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows the pressed art without a click (style guide only). */
  forceState?: 'hover' | 'pressed';
}

/**
 * Chunky wood button (GDD §16): rest / hover / pressed / disabled art; pressed
 * moves down 1 art px while its dark edge shrinks. Hover and press sounds come
 * from one delegated listener for every `.btn` (`audio/uiSounds.ts`).
 */
export function Button({ className, forceState, type = 'button', ...rest }: ButtonProps) {
  const cls = ['btn', forceState && `is-${forceState}`, className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
