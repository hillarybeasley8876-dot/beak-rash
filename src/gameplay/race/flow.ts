// Race flow: intro flyover → countdown 3-2-1-GO (launch boost for throttle held on GO) → racing →
// player finishes (or 60 s after the winner) → race:end exactly once.
// Online (SPEC §28): no intro flyby and no skip by key — the countdown starts at tick 0 — and the race ends
// when every human has finished, or 45 s after the first human did (the same tick on every client).
import type { RiderId } from '../../core/types';
import type { RaceCtx } from './ctx';

export const INTRO_TIME = 3.6;      // s grid flyover
const COUNT_STEP = 1.0;             // s per countdown number
const END_DELAY = 3.0;              // s after the player's finish (FINISH splash) before race:end
const DNF_AFTER = 60;               // s after the winner before unfinished riders are DNF
const PERFECT_WINDOW = 2.0;         // countdown time after which a fresh press = perfect start
export const FINISH_GRACE_MS = 45;  // s after the first human finished before the online race ends (the brief's name)

export interface Flow {
  preStep(dt: number): void;
  postStep(dt: number): void;
  skipIntro(): void;
  /** 0..1 progress of the intro flyover (1 once it is over or skipped). */
  readonly introProgress: number;
  /** Countdown seconds elapsed (0 before the countdown). */
  readonly countdownTime: number;
  dispose(): void;
}

export function createFlow(ctx: RaceCtx, onEnd: (timedOut: boolean) => void): Flow {
  const { session } = ctx;
  const { app } = session;
  const { bus } = app;
  const online = ctx.online;
  let introT = 0;
  let countT = 0;
  let lastShown = 4;
  let endTimer = -1;
  const warned = new Set<number>();
  const pressStart = new Map<RiderId, number | null>();

  const goToCountdown = (): void => {
    if (session.phase !== 'intro') return;
    session.phase = 'countdown';
    introT = INTRO_TIME;
  };

  const launch = (): void => {
    for (const r of session.riders) {
      const c = session.controls.get(r.id);
      const start = pressStart.get(r.id) ?? null;
      if (r.mode === 'grid') { r.mode = 'racing'; r.modeTime = 0; }
      if (!c || c.throttle < 0.5 || start === null) continue;
      const perfect = start >= PERFECT_WINDOW;
      const time = perfect ? 1.1 : 0.6;
      const power = perfect ? 0.3 : 0.18;
      r.boostTime = Math.max(r.boostTime, time);
      r.boostPower = Math.max(r.boostPower, power);
      bus.emit('rider:boost', { riderId: r.id, kind: 'launch', power, time });
    }
  };

  const trackThrottle = (): void => {
    for (const r of session.riders) {
      const held = (session.controls.get(r.id)?.throttle ?? 0) >= 0.5;
      const start = pressStart.get(r.id) ?? null;
      if (held && start === null) pressStart.set(r.id, countT);
      else if (!held) pressStart.set(r.id, null);
    }
  };

  const countdown = (dt: number): void => {
    trackThrottle();
    const n = Math.max(0, 3 - Math.floor(countT / COUNT_STEP + 1e-9));
    if (n < lastShown) {
      lastShown = n;
      bus.emit('race:countdown', { n });
      if (n === 0) {
        session.phase = 'racing';
        launch();
        bus.emit('race:start', {});
        return;
      }
    }
    countT += dt;
  };

  /**
   * Online: the race is over when every human has crossed the line, or 45 s after the first one did. The
   * humans are the same on every client and the race clock is the same, so the race ends on the same tick
   * everywhere (SPEC §28).
   */
  const checkOnlineEnd = (): void => {
    const humans = session.humans;
    if (humans.length === 0) { session.phase = 'finished'; onEnd(false); return; }
    let allDone = true;
    for (const h of humans) {
      if (h.finishTime === null) { allDone = false; break; }
    }
    if (allDone) { session.phase = 'finished'; onEnd(false); return; }
    const first = ctx.firstHumanFinish;
    if (first !== null && ctx.clock - first >= FINISH_GRACE_MS) {
      session.phase = 'finished';
      onEnd(true);
    }
  };

  const checkEnd = (dt: number): void => {
    if (online) { checkOnlineEnd(); return; }
    const p = session.player;
    if (p.finishTime !== null) {
      if (session.phase === 'racing') session.phase = 'finished';
      if (endTimer < 0) endTimer = 0;
      endTimer += dt;
      if (endTimer >= END_DELAY) onEnd(false);
      return;
    }
    if (ctx.winnerTime === null) return;
    const left = DNF_AFTER - (ctx.clock - ctx.winnerTime);
    for (const mark of [30, 10]) {
      if (left <= mark && !warned.has(mark)) {
        warned.add(mark);
        app.ui.toast(`冠军已到终点 —— 还剩 ${mark} 秒！`, 'warn');
      }
    }
    if (left <= 0) {
      session.phase = 'finished';
      onEnd(true);
    }
  };

  // The local key only skips the intro of an OFFLINE race: an online race has no intro to skip.
  const unAction = online ? (): void => undefined : app.input.onAction((a) => {
    if (a === 'confirm' && session.phase === 'intro' && app.ui.screen === 'race') goToCountdown();
  });
  if (!online && app.params.get('intro') === '0') goToCountdown();
  // Online: the countdown starts at tick 0 — the intro flyby does not run (SPEC §28).
  if (online) { session.phase = 'countdown'; introT = INTRO_TIME; }

  return {
    get introProgress() { return Math.min(1, introT / INTRO_TIME); },
    get countdownTime() { return countT; },
    skipIntro: goToCountdown,
    preStep(dt) {
      if (session.phase === 'intro') {
        introT += dt;
        if (introT >= INTRO_TIME) goToCountdown();
        return;
      }
      if (session.phase === 'countdown') countdown(dt);
    },
    postStep(dt) {
      if (ctx.ended) return;
      if (session.phase === 'racing' || session.phase === 'finished') {
        ctx.clock += dt;
        checkEnd(dt);
      }
    },
    dispose() {
      unAction();
    },
  };
}
