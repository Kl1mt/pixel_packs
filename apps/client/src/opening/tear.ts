/** Columns of the seam the player has torn (drag-to-tear, GDD §7). */
export class SeamTear {
  private readonly torn: boolean[];
  constructor(
    readonly x0: number,
    readonly x1: number,
  ) {
    this.torn = Array.from({ length: x1 - x0 + 1 }, () => false);
  }

  /** Tears every column between two pointer positions (fast drags skip none). */
  drag(fromX: number, toX: number): void {
    const a = Math.max(this.x0, Math.round(Math.min(fromX, toX)));
    const b = Math.min(this.x1, Math.round(Math.max(fromX, toX)));
    for (let x = a; x <= b; x++) this.torn[x - this.x0] = true;
  }

  /** Tears from the left up to fraction `p` (the click fallback animates this). */
  tearTo(p: number): void {
    this.drag(this.x0, this.x0 + (this.x1 - this.x0) * Math.min(1, p));
  }

  isTorn(x: number): boolean {
    return this.torn[x - this.x0] ?? false;
  }

  get progress(): number {
    return this.torn.filter(Boolean).length / this.torn.length;
  }
}

/** Torn this much of the seam and the pack gives way (the last bit rips by itself). */
export const TEAR_DONE = 0.8;

/** A drag counts near the seam within this many art px above or below it. */
export const SEAM_REACH = 9;
