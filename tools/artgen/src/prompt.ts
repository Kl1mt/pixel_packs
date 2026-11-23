/** The fixed card-art prompt template from GDD §19; only the critter description varies. */
export const CARD_ART_STYLE_SUFFIX =
  'cozy whimsical fantasy critter, full body, facing the viewer in 3/4 front view, centered, ' +
  'feet on one ground line, transparent background, 1 px dark outline, soft shading, ' +
  'light from top-left, no text, no frame, no scenery';

export function cardArtPrompt(critterDescription: string): string {
  const critter = critterDescription.trim().replace(/[.,;\s]+$/, '');
  if (!critter) throw new Error('critter description is empty');
  return `${critter}, ${CARD_ART_STYLE_SUFFIX}`;
}
