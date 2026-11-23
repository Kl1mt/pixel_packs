/** Elements that get hover and press sounds: wood buttons (also links styled as buttons) and nav. */
export const SOUNDED = '.btn, .shell__navlink, [data-sound="press"]';

/**
 * One delegated listener for UI sounds, so every button (React `Button`, `Link
 * className="btn"`, nav items) sounds the same without each wiring it up.
 */
export function installUiSounds(
  root: Document,
  play: (id: 'ui.hover' | 'ui.press') => void,
): () => void {
  let hovered: Element | null = null;
  const target = (e: Event): Element | null => {
    const el = e.target instanceof Element ? e.target.closest(SOUNDED) : null;
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return null;
    return el;
  };
  const over = (e: PointerEvent) => {
    const el = target(e);
    if (el !== hovered && el && e.pointerType === 'mouse') play('ui.hover');
    hovered = el;
  };
  const click = (e: MouseEvent) => {
    if (target(e)) play('ui.press');
  };
  root.addEventListener('pointerover', over, true);
  root.addEventListener('click', click, true);
  return () => {
    root.removeEventListener('pointerover', over, true);
    root.removeEventListener('click', click, true);
  };
}
