import type { CopySource, EditionStamp } from '../model/card.js';

/**
 * First-Edition stamp (GDD §6): a pack pull during the pack's release season gets
 * "1st Edition · S‹n›". Crafted and starter copies, and Season 0 pulls, are never stamped.
 */
export function editionStampFor(
  source: CopySource,
  packReleaseSeason: number | null,
  currentSeason: number,
): EditionStamp | null {
  if (source !== 'pack' || packReleaseSeason === null) return null;
  if (currentSeason < 1 || packReleaseSeason !== currentSeason) return null;
  return { season: currentSeason };
}
