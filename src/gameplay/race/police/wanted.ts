// The wanted stars (SPEC §14): the level W 0..3 the police put on the player. The heat decides
// the level with hysteresis (it drops a level only under a lower line than it rose at), and a
// few events raise the floor: two knocks on the officer in this chase, a rival KO right next to
// it, an officer knocked out, two refused bribes.
import { T } from './tuning';

export interface Wanted {
  /** The current star count (0..3). */
  readonly level: number;
  /** Recompute the level from the heat; true when it changed. */
  update(heat: number): boolean;
  /** An event raises the floor (never lowers it): 2 = knocked twice / a rival KO nearby, 3 = an officer down / two refused bribes. */
  bump(level: number): void;
  /** The chase is over: the stars and the chase floor are forgotten (the bribe count is not). */
  reset(): void;
  /** Knocks on the officer in this chase. */
  knock(): void;
  /** A refused bribe this race. */
  refuse(): void;
  /** How many bribes were refused this race. */
  readonly refusals: number;
}

export function createWanted(): Wanted {
  let level = 0;
  let floor = 0;
  let knocks = 0;
  let refusals = 0;
  const wanted = {
    get level(): number { return level; },
    get refusals(): number { return refusals; },
    update(heat: number): boolean {
      const next = Math.max(heatLevel(heat, level), floor);
      if (next === level) return false;
      level = next;
      return true;
    },
    bump(l: number): void {
      if (l > floor) floor = l;
    },
    knock(): void {
      knocks += 1;
      if (knocks >= T.knockBump) wanted.bump(2);
    },
    refuse(): void {
      refusals += 1;
      if (refusals >= T.refuseBump) wanted.bump(3);
    },
    reset(): void {
      level = 0;
      floor = 0;
      knocks = 0;
    },
  };
  return wanted;
}

/** The level the heat alone asks for; a level is only dropped under its own (lower) drop line. */
function heatLevel(heat: number, cur: number): number {
  const want = heat > T.w3 ? 3 : heat >= T.w2 ? 2 : heat >= T.w1 ? 1 : 0;
  if (want >= cur) return want;
  const drop = cur === 3 ? T.w3Drop : cur === 2 ? T.w2Drop : T.w1Drop;
  return heat > drop ? cur : want;
}
