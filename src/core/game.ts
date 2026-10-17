// App shell: renderer, render loop and the screen flow
//   boot → title → menu → (garage | trackSelect | career …) → loading → intro → race → results → menu
// Screens are drawn by ui/; this file only decides which one is up and owns the race session.
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RACER_POOL } from '../data/roster';
import { Clock } from './clock';
import { EventBus } from './events';
import { Input } from './input';
import { loadModules, type Modules } from './modules';
import { Rng } from './rng';
import { SaveStore } from './save';
import { RaceSession } from './session';
import type { AppContext, RaceConfig, ScreenId } from './contracts';
import type { GameEvents } from './events-map';
import type { BikeId, CharacterId, Quality, TrackId } from './types';

export class Game {
  readonly app: AppContext;
  readonly achievements: ReturnType<Modules['createAchievements']>;
  session: RaceSession | null = null;
  lastConfig: RaceConfig | null = null;
  /** Manual stepping mode (tests): the RAF loop renders but does not advance time. */
  manual = false;
  fps = 0;
  private last = performance.now();
  private loading = false;

  static async create(canvas: HTMLCanvasElement, uiRoot: HTMLElement, params: URLSearchParams): Promise<Game> {
    const modules = await loadModules(params);
    if (modules.stubbed.length) console.warn('[game] running with stub units:', modules.stubbed.join(', '));
    return new Game(canvas, uiRoot, params, modules);
  }

  private constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, params: URLSearchParams, modules: Modules) {
    const save = new SaveStore();
    const quality = (params.get('quality') as Quality | null) ?? save.data.settings.quality;
    const renderer = new WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1);
    renderer.setPixelRatio(dpr);
    const camera = new PerspectiveCamera(65, 16 / 9, 0.1, 2400);
    const input = new Input();
    input.attach(window);
    input.autoPedal = save.data.settings.autoPedal;
    const partial = {
      renderer, scene: new Scene(), camera, canvas, uiRoot, bus: new EventBus<GameEvents>(),
      clock: new Clock(), input, save, params, quality, modules,
      size: { width: 1, height: 1, dpr },
    };
    const app = partial as AppContext;
    app.rig = modules.createCameraRig(app);
    app.fx = modules.createFx(app);
    app.ui = modules.createUi(app);
    app.audio = modules.createAudio(app);
    this.app = app;
    this.achievements = modules.createAchievements(app);
    this.wireFlow();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  start(): void {
    const loop = (now: number): void => {
      const raw = (now - this.last) / 1000;
      this.last = now;
      if (!this.manual) this.frame(raw);
      else this.renderOnly();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Advance everything by one frame of `raw` real seconds. Public for debug stepping. */
  frame(raw: number): void {
    const { app } = this;
    if (raw > 0) this.fps = this.fps * 0.95 + (1 / raw) * 0.05;
    const { dtReal, dtSim } = app.clock.advance(raw);
    app.input.update(dtReal);
    this.session?.step(dtSim, dtReal);
    app.rig.update(dtReal, dtSim);
    app.fx.update(dtSim, dtReal);
    app.fx.render();
    app.ui.update(dtReal);
    app.audio.update(dtReal);
  }

  private renderOnly(): void {
    this.app.fx.render();
  }

  async startRace(overrides: Partial<RaceConfig> = {}): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      this.endSession();
      const config = this.buildConfig(overrides);
      this.lastConfig = config;
      await this.show('loading', { config, progress: 0 });
      const session = await RaceSession.create(this.app, config);
      this.session = session;
      this.app.rig.attach(session);
      this.app.fx.attach(session);
      this.app.ui.attach(session);
      this.app.audio.attach?.(session);
      this.achievements.attach(session);
      await this.show('race', { config });
    } catch (err) {
      console.error('[game] could not start race', err);
      this.endSession();
      await this.show('menu', { message: '赛道加载失败，请重试' });
    } finally {
      this.loading = false;
    }
  }

  endSession(): void {
    if (!this.session) return;
    this.app.rig.attach(null);
    this.app.fx.attach(null);
    this.app.ui.attach(null);
    this.app.audio.attach?.(null);
    this.achievements.attach(null);
    this.session.dispose();
    this.session = null;
    this.app.clock.clearScale('pause');
    this.app.audio.setMuffle(0);
  }

  private buildConfig(o: Partial<RaceConfig>): RaceConfig {
    const p = this.app.params;
    const seed = o.seed ?? Number(p.get('seed') ?? Math.floor(Math.random() * 1e9));
    const rng = new Rng(seed);
    const rivalsParam = p.get('rivals');
    const rivals = o.rivals ?? (rivalsParam ? (rivalsParam.split(',') as CharacterId[]) : rng.shuffle(RACER_POOL).slice(0, 7));
    return {
      trackId: o.trackId ?? ((p.get('race') ?? p.get('track') ?? 'coast') as TrackId),
      mode: o.mode ?? 'quick',
      seed,
      level: o.level ?? Number(p.get('level') ?? 1),
      playerCharacter: o.playerCharacter ?? 'pelican',
      playerBike: o.playerBike ?? ((p.get('bike') as BikeId | null) ?? this.app.save.data.bike),
      rivals,
      rivalBikes: o.rivalBikes ?? [],
      traffic: o.traffic ?? p.get('traffic') !== '0',
      police: o.police ?? p.get('police') !== '0',
      autopilot: o.autopilot ?? p.get('autopilot') === '1',
    };
  }

  private async show(screen: ScreenId, props?: Parameters<AppContext['ui']['show']>[1]): Promise<void> {
    this.app.bus.emit('flow:screen', { screen });
    await this.app.ui.show(screen, props);
  }

  private wireFlow(): void {
    const { bus, clock } = this.app;
    bus.on('flow:startRace', ({ config }) => void this.startRace(config));
    bus.on('flow:restartRace', () => void this.startRace(this.lastConfig ?? {}));
    bus.on('flow:quitRace', () => {
      this.endSession();
      void this.show('menu');
    });
    bus.on('flow:pause', ({ paused }) => {
      if (!this.session) return;
      clock.setScale('pause', paused ? 0 : 1);
      this.app.audio.setMuffle(paused ? 1 : 0);
      void this.show(paused ? 'pause' : 'race');
    });
    bus.on('race:end', ({ results }) => {
      void this.show('results', { results, config: this.lastConfig ?? undefined });
    });
  }

  private resize(): void {
    const { renderer, size } = this.app;
    const w = window.innerWidth;
    const h = window.innerHeight;
    size.width = w;
    size.height = h;
    renderer.setSize(w, h, false);
    this.app.rig.resize(w, h);
    this.app.fx.resize(w, h, size.dpr);
  }
}
