// Shared shape of every cut-in: a DOM root plus a frame(t) animator driven on real time.

export interface CutIn {
  readonly root: HTMLElement;
  /** Natural length in seconds; the director may cut it short. */
  readonly dur: number;
  /** Draw the cut-in at `t` seconds since it started. */
  frame(t: number): void;
  /** Shown over a KO cinematic: the static HUD stays hidden until it has left the stage. */
  readonly cine?: boolean;
}

/** Splash priorities: a new splash replaces the current one when its priority is >= the current. */
export const PRIORITY = {
  countdown: 5,
  skill: 4,
  wrecked: 7,
  busted: 7,
  ko: 8,
  showtime: 9,
  finish: 10,
} as const;

export type SplashKind = keyof typeof PRIORITY;
