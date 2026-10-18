// Music scheduling clock: a 25 ms timer (keeps playing in manual-step tests and background tabs)
// plus every update() schedule the conductor ahead of the audio clock. The lookahead grows while
// a race loads (the main thread blocks for seconds: from flow:startRace / restartRace / the
// loading screen until the session is attached, then it settles back) and in background tabs.
// No update() for STALL s = the frame loop stopped: the target halts its speed-linked loops.
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';

/** Lookahead (s): normal, background tab, while a race loads, right after it loaded. */
const AHEAD = { normal: 0.18, hidden: 1.6, loading: 3, settling: 0.5 } as const;
/** Real seconds without update() after which the frame loop counts as stopped. */
const STALL = 0.25;

export type AheadMode = keyof typeof AHEAD;

export interface PumpTarget {
  /** The running audio clock, or null while audio is not live (nothing is scheduled). */
  clock(): number | null;
  schedule(until: number): void;
  /** The frame loop stopped: silence whatever follows the game state per frame. */
  halt(): void;
}

export class Pump {
  mode: AheadMode = 'normal';
  stalled = false;
  /** Main-thread time spent in scheduling (ms, for the debug mainThreadPct). */
  spentMs = 0;
  private settleUntil = 0;
  private lastFrame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private target: PumpTarget) {}

  /** Race loads: schedule far ahead from the request until the session is attached. */
  wire(bus: EventBus<GameEvents>): void {
    const loading = (): void => this.set('loading');
    bus.on('flow:startRace', loading);
    bus.on('flow:restartRace', loading);
    bus.on('flow:screen', ({ screen }) => {
      if (screen === 'loading') loading();
      else if (this.mode === 'loading' && screen !== 'race' && screen !== 'intro') this.mode = 'normal';
    });
  }

  start(): void {
    this.timer ??= setInterval(() => this.run(), 25);
  }

  set(mode: AheadMode): void {
    this.mode = mode;
    this.settleUntil = performance.now() + (mode === 'loading' ? 15000 : 2000);
    this.run();
  }

  /** A frame arrived (AudioSystem.update). */
  frame(): void {
    this.lastFrame = performance.now();
    this.stalled = false;
  }

  run(): void {
    const now = this.target.clock();
    if (now === null) return;
    const t0 = performance.now();
    if (this.mode !== 'normal' && t0 > this.settleUntil) this.mode = 'normal';
    this.target.schedule(now + Math.max(AHEAD[this.mode], document.hidden ? AHEAD.hidden : 0));
    if (!this.stalled && this.lastFrame > 0 && t0 - this.lastFrame > STALL * 1000) {
      this.stalled = true;
      this.target.halt();
    }
    this.spentMs += performance.now() - t0;
  }
}
