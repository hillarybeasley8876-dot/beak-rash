// The running STYLE chain: the action kinds it holds, how many actions it has and their points.
import { MULT_MAX, MULT_STEP, REPEAT_FACTOR } from './tuning';

export class StyleChain {
  private readonly kinds = new Set<string>();
  private sum = 0;
  private count = 0;
  private lastKind: string | null = null;

  /** True while the chain waits for its next action. */
  get active(): boolean {
    return this.count > 0;
  }

  /** Σ points of the chain, before the multiplier. */
  get total(): number {
    return this.sum;
  }

  /** Actions in the chain. */
  get actions(): number {
    return this.count;
  }

  /** 1 + 0.25 × (distinct action kinds − 1), capped at ×4. */
  get multiplier(): number {
    if (this.kinds.size === 0) return 1;
    return Math.min(MULT_MAX, 1 + MULT_STEP * (this.kinds.size - 1));
  }

  /** Add an action and return the points it scored (half when the same kind just happened). */
  push(kind: string, points: number): number {
    const scored = this.lastKind === kind ? Math.floor(points * REPEAT_FACTOR) : points;
    this.kinds.add(kind);
    this.lastKind = kind;
    this.sum += scored;
    this.count += 1;
    return scored;
  }

  reset(): void {
    this.kinds.clear();
    this.sum = 0;
    this.count = 0;
    this.lastKind = null;
  }
}
