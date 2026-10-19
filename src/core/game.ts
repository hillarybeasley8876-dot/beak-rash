// App shell: renderer, render loop and the screen flow
//   boot → title → menu → (garage | trackSelect | career …) → loading → intro → race → results → menu
// Screens are drawn by ui/; this file only decides which one is up and owns the race session.
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { Clock } from './clock';
import { EventBus } from './events';
import { Input } from './input';
import { loadModules, type Modules } from './modules';
import { buildRaceConfig } from './race-config';
import { SaveStore } from './save';
import { isQuality } from './save-sanitize';
import { RaceSession } from './session';
import { compileScene, drawEverything, nextFrame, type WarmupStats } from './warmup';
import type { AppContext, RaceConfig, ScreenId } from './contracts';
import type { GameEvents } from './events-map';
import type { Quality } from './types';

const WARMUP_LAYER = 'warmup';
const WARMUP_LABEL = '鹈鹕热身 WARM-UP';

export class Game {
  readonly app: AppContext;
  readonly achievements: ReturnType<Modules['createAchievements']>;
  session: RaceSession | null = null;
  lastConfig: RaceConfig | null = null;
  /** Manual stepping mode (tests): the RAF loop renders but does not advance time. */
  manual = false;
  fps = 0;
  /** Shader warm-up of the last race start (perf checks read it). */
  lastWarmup: WarmupStats | null = null;
  private last = performance.now();
  private loading = false;
  /** While the warm-up compiles, frames skip rendering so they never block on programs still compiling. */
  private warming = false;

  static async create(canvas: HTMLCanvasElement, uiRoot: HTMLElement, params: URLSearchParams): Promise<Game> {
    const modules = await loadModules(params);
    if (modules.stubbed.length) console.warn('[game] running with stub units:', modules.stubbed.join(', '));
    return new Game(canvas, uiRoot, params, modules);
  }

  private constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, params: URLSearchParams, modules: Modules) {
    const save = new SaveStore();
    const quality = qualityParam(params) ?? save.data.settings.quality;
    // fx draws the scene into its own (multisampled) target and only composites onto the canvas, so a
    // multisampled canvas backbuffer is pure memory + resolve cost; keep it only for fx's stub (draws directly).
    const antialias = quality !== 'low' && modules.stubbed.includes('fx');
    const renderer = new WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance' });
    const dpr = renderDpr(quality, window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(dpr);
    renderer.debug.checkShaderErrors = import.meta.env.DEV;   // info-log queries stall program use in builds
    const camera = new PerspectiveCamera(65, 16 / 9, 0.1, 2400);
    const input = new Input();
    input.attach(window);
    input.autoPedal = save.data.settings.autoPedal;
    const partial = {
      renderer, scene: new Scene(), camera, canvas, uiRoot, bus: new EventBus<GameEvents>(),
      clock: new Clock(), input, save, params, quality, modules, quit: desktopQuit(),
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
    if (!this.warming) app.fx.render();
    app.ui.update(dtReal);
    app.audio.update(dtReal);
  }

  private renderOnly(): void {
    if (!this.warming) this.app.fx.render();
  }

  async startRace(overrides: Partial<RaceConfig> = {}): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    // The previous race's world (track + rider views) stays alive, out of the scene, until the new race has
    // compiled, so the shader programs both use are shared instead of destroyed and rebuilt on every restart.
    let previous: RaceSession | null = null;
    const retire = (): void => {
      try {
        previous?.dispose();
      } catch (err) {
        console.error('[game] disposing the previous race failed', err);
      }
    };
    try {
      previous = this.detachSession();
      const config = buildRaceConfig(this.app.params, this.app.save, overrides);
      this.lastConfig = config;
      await this.show('loading', { config, progress: 0 });
      const session = await RaceSession.create(this.app, config);
      this.session = session;
      this.app.rig.attach(session);
      this.app.fx.attach(session);
      this.app.ui.attach(session);
      this.app.audio.attach?.(session);
      this.achievements.attach(session);
      await this.warmUp(retire);
      await this.show('race', { config });
    } catch (err) {
      console.error('[game] could not start race', err);
      this.endSession();
      await this.show('menu', { message: '赛道加载失败，请重试' });
    } finally {
      retire();
      this.loading = false;
    }
  }

  /** Behind the loading screen: compile the race's programs, then render one hidden frame (shadow-depth
   *  programs, texture uploads). Sim time stays frozen so the intro starts when the race screen shows. */
  private async warmUp(afterCompile: () => void): Promise<void> {
    const { bus, clock } = this.app;
    clock.setScale(WARMUP_LAYER, 0);
    this.warming = true;
    try {
      bus.emit('flow:loading', { progress: 0.92, label: WARMUP_LABEL });
      this.lastWarmup = null;
      try {
        const stats = await compileScene(this.app, nextFrame);
        afterCompile();
        bus.emit('flow:loading', { progress: 0.97, label: WARMUP_LABEL });
        await nextFrame();
        stats.drawMs = drawEverything(this.app);
        this.lastWarmup = stats;
      } catch (err) {
        console.error('[game] shader warm-up failed; programs compile on first use', err);
      }
      afterCompile();
      this.warming = false;
      await nextFrame();
    } finally {
      this.warming = false;
      clock.clearScale(WARMUP_LAYER);
    }
  }

  endSession(): void {
    this.detachSession()?.dispose();
  }

  /** Unhook the current race from the app systems and the scene and stop its gameplay systems;
   *  the caller disposes its world. */
  private detachSession(): RaceSession | null {
    const session = this.session;
    if (!session) return null;
    this.session = null;
    this.app.rig.attach(null);
    this.app.fx.attach(null);
    this.app.ui.attach(null);
    this.app.audio.attach?.(null);
    this.achievements.attach(null);
    session.world.removeFromParent();
    this.app.clock.clearScale('pause');
    this.app.audio.setMuffle(0);
    try {
      session.stopSystems();
    } catch (err) {
      console.error('[game] stopping the race systems failed', err);
    }
    return session;
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
    size.dpr = renderDpr(this.app.quality, w, h);
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(w, h, false);
    this.app.rig.resize(w, h);
    this.app.fx.resize(w, h, size.dpr);
  }
}

/** Drawing-buffer pixel budget and device-pixel-ratio cap per quality: Retina / 4K screens render at most
 *  ~1440p (high) or ~1080p (medium, low) worth of pixels instead of 4–8 MP; the DOM UI stays crisp. */
const PIXEL_BUDGET: Record<Quality, number> = { high: 2560 * 1440, medium: 1920 * 1080, low: 1920 * 1080 };
const DPR_CAP: Record<Quality, number> = { high: 2, medium: 1.5, low: 1 };
const MIN_DPR = 0.5;

function renderDpr(quality: Quality, width: number, height: number): number {
  const budget = Math.sqrt(PIXEL_BUDGET[quality] / Math.max(1, width * height));
  return Math.max(MIN_DPR, Math.min(window.devicePixelRatio || 1, DPR_CAP[quality], budget));
}

/** The desktop shell (desktop/main.cjs) serves the game from app:// and quits when its only window closes. */
function desktopQuit(): (() => void) | undefined {
  return location.protocol === 'app:' ? () => window.close() : undefined;
}

function qualityParam(params: URLSearchParams): Quality | null {
  const raw = params.get('quality');
  if (raw === null || isQuality(raw)) return raw;
  console.warn(`[game] unknown ?quality=${raw}, using the saved setting`);
  return null;
}
