// Race flow: intro flyover → countdown 3-2-1-GO (launch boost for throttle held on GO) → racing →
// player finishes (or 60 s after the winner) → race:end exactly once.
import type { RiderId } from '../../core/types';
import type { RaceCtx } from './ctx';

export const INTRO_TIME = 3.6;      // s grid flyover
const COUNT_STEP = 1.0;             // s per countdown number
const END_DELAY = 3.0;              // s after the player's finish (FINISH splash) before race:end
const DNF_AFTER = 60;               // s after the winner before unfinished riders are DNF
const PERFECT_WINDOW = 2.0;         // countdown time after which a fresh press = perfect start

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
      // Until the HUD has a 'launch' callout (status/race.md core request 1) a toast marks the perfect start.
      if (r.isPlayer && perfect) app.ui.toast('PERFECT START!  起步完美', 'meme');
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

  const checkEnd = (dt: number): void => {
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

  const unAction = app.input.onAction((a) => {
    if (a === 'confirm' && session.phase === 'intro' && app.ui.screen === 'race') goToCountdown();
  });
  if (app.params.get('intro') === '0') goToCountdown();

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
