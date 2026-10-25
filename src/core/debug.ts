// window.__br — the test/automation surface. Playwright tools drive the game only through this.
import type { Game } from './game';
import type { Action } from './input';
import type { AppContext, RaceConfig, ScreenId, ScreenProps, Session } from './contracts';
import type { Controls, RiderId } from './types';

export interface DebugApi {
  ready: boolean;
  frames: number;
  errors: string[];
  game: Game;
  app: AppContext;
  session(): Session | null;
  start(config?: Partial<RaceConfig>): Promise<void>;
  show(screen: ScreenId, props?: ScreenProps): Promise<void>;
  /** Scripted player controls (null = keyboard/gamepad). Edge fields fire once. */
  setControls(c: Partial<Controls> | null): void;
  press(action: Action): void;
  /** Manual mode: the RAF loop stops advancing time; use step() for deterministic tests. */
  manual(on: boolean): void;
  step(frames: number, dt?: number): void;
  setScale(name: string, value: number, ramp?: number): void;
  teleport(id: RiderId, s: number, x?: number): void;
  /** Knock a rider out as if `attacker` landed the final hit. */
  ko(victim: RiderId, attacker?: RiderId | null): void;
  snapshot(): Record<string, unknown>;
}

declare global {
  interface Window { __br?: DebugApi }
}

/** Start recording console errors before anything else loads (module failures included). */
export function captureErrors(): string[] {
  const errors: string[] = [];
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ''}` : String(a))).join(' ').slice(0, 2000));
    if (errors.length > 200) errors.shift();
    origError(...args);
  };
  window.addEventListener('error', (e) => errors.push(`window.error: ${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => errors.push(`unhandledrejection: ${String(e.reason)}`));
  return errors;
}

export function installDebug(game: Game, errors: string[]): DebugApi {

  const api: DebugApi = {
    ready: false,
    frames: 0,
    errors,
    game,
    app: game.app,
    session: () => game.session,
    start: (config) => game.startRace(config),
    show: (screen, props) => game.app.ui.show(screen, props),
    setControls: (c) => {
      // Drop undefined fields: a script passing {steer: undefined} must get the default, not NaN rider state.
      game.app.input.scripted = c ? Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) : null;
    },
    press: (action) => game.app.input.press(action),
    manual: (on) => {
      game.manual = on;
    },
    step: (frames, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        game.frame(dt);
        api.frames++;
      }
    },
    setScale: (name, value, ramp = 0) => game.app.clock.setScale(name, value, ramp),
    teleport: (id, s, x = 0) => {
      const r = game.session?.rider(id);
      if (!r) return;
      r.s = s;
      r.x = x;
    },
    ko: (victim, attacker = 0) => {
      const s = game.session;
      const r = s?.rider(victim);
      if (!s || !r) return;
      r.lastHitBy = attacker;
      r.hp = 0;
      // Real combat notices hp <= 0 in postStep and runs the KO path (events, crash, cinematic).
    },
    snapshot: () => {
      const s = game.session;
      return {
        screen: game.app.ui.screen,
        fps: Math.round(game.fps),
        timeScale: game.app.clock.scale,
        phase: s?.phase ?? null,
        time: s?.time ?? 0,
        riders: s?.riders.map((r) => ({
          id: r.id, c: r.character, s: +r.s.toFixed(1), x: +r.x.toFixed(2), y: +r.y.toFixed(2),
          v: +r.speed.toFixed(2), place: r.place, mode: r.mode, hp: Math.round(r.hp), sp: Math.round(r.sp),
        })) ?? [],
        errors: errors.length,
      };
    },
  };
  window.__br = api;
  return api;
}
