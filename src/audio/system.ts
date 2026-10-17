// AudioSystem implementation. The AudioContext and mixing graph are built at boot (preload) but
// stay suspended and silent until unlock() (a user gesture): nothing plays before it, and music
// requested earlier starts on unlock. Music is scheduled from a 25 ms timer (keeps playing in
// manual-step tests and background tabs) and from update(); the lookahead grows while a race
// loads (the main thread blocks for seconds). Bus events drive every gameplay sound (events-*.ts);
// the session watcher runs the continuous ones. Volumes follow app.save settings.
import { Vector3 } from 'three';
import { Rng } from '../core/rng';
import { ROSTER } from '../data/roster';
import { AUDIO_RATE, Engine, type Volumes } from './engine';
import { wireCombat } from './events-combat';
import { wireRace } from './events-race';
import { Conductor } from './music/conductor';
import { isStinger, type StingerId } from './music/stingers';
import { SfxPlayer, type PlayOpts } from './sfx/bank';
import { CENTER, place, type Placement } from './sfx/spatial';
import { VoicePlayer } from './voice/player';
import { SessionWatcher } from './watcher';
import { installAudioDebug } from './debug';
import type { AppContext, AudioSystem, Session } from '../core/contracts';
import type { RiderId } from '../core/types';
import type { BarkKind, Host, Where } from './host';

interface Live {
  ctx: AudioContext;
  engine: Engine;
  conductor: Conductor;
  sfx: SfxPlayer;
  voices: VoicePlayer;
  watcher: SessionWatcher;
}

type TraceEntry = { ms: number; kind: string; id: string; gain: number };

/** Music lookahead (s): normal, background tab, while a race loads, right after it loaded. */
const AHEAD = { normal: 0.18, hidden: 1.6, loading: 3, settling: 0.5 } as const;
/** Real seconds without update() after which the frame loop counts as stopped (bike loops fade). */
const STALL = 0.25;
/** Barks fade out between these track distances (m) from the player. */
const BARK_NEAR = 30;
const BARK_FAR = 45;
/** Sub-heavy impacts closer together than this (ms) share one low end. */
const BOOM_GAP_MS = 400;

function createContext(): AudioContext {
  try {
    return new AudioContext({ latencyHint: 'interactive', sampleRate: AUDIO_RATE });
  } catch (err) {
    console.warn('[audio] 32 kHz context unavailable, using the device rate', err);
    return new AudioContext({ latencyHint: 'interactive' });
  }
}

export class AudioRuntime implements AudioSystem, Host {
  private rt: Live | null = null;
  private unlocked = false;
  private wanted: { id: string | null; fade: number } | null = null;
  private volumes: Volumes;
  private external = 0;
  private cine = 0;
  private attached: Session | null = null;
  private attachUsed = false;
  private cool = new Map<string, number>();
  /** Main-thread time spent in audio scheduling / update since unlock (ms) and when unlocked. */
  private spentMs = 0;
  private since = 0;
  private rng = new Rng(0xa0d10);
  private pos = new Vector3();
  private ahead: keyof typeof AHEAD = 'normal';
  private settleUntil = 0;
  private lastUpdate = 0;
  private stalled = false;
  private warnedSting = false;
  private lastBoom = -Infinity;
  /** Recent triggers (for tests): what played, when (performance.now ms), at what gain. */
  private trace: TraceEntry[] = [];

  constructor(readonly app: AppContext) {
    const st = app.save.data.settings;
    this.volumes = { master: st.master, music: st.music, sfx: st.sfx, voice: st.voice };
    app.save.onChange((d) => this.setVolumes(d.settings));
    wireRace(app.bus, this);
    wireCombat(app.bus, this);
    app.bus.on('police:alert', ({ level }) => this.rt?.watcher.alert(level, this.now()));
    // A race load blocks the main thread for seconds: schedule far ahead until it is attached.
    const loading = (): void => this.setAhead('loading');
    app.bus.on('flow:startRace', loading);
    app.bus.on('flow:restartRace', loading);
    app.bus.on('flow:screen', ({ screen }) => {
      if (screen === 'loading') loading();
      else if (this.ahead === 'loading' && screen !== 'race' && screen !== 'intro') this.ahead = 'normal';
    });
    // The UI unlocks on its first key/click too; this covers direct-to-race URLs and tests.
    const gesture = (): void => {
      window.removeEventListener('pointerdown', gesture, true);
      window.removeEventListener('keydown', gesture, true);
      void this.unlock();
    };
    window.addEventListener('pointerdown', gesture, true);
    window.addEventListener('keydown', gesture, true);
    // window.__br appears after the game is built; hook the audio test surface onto it then.
    const hook = (): void => {
      if (!installAudioDebug(this)) setTimeout(hook, 100);
    };
    hook();
  }

  get live(): boolean {
    return this.unlocked && this.rt !== null && this.rt.ctx.state === 'running';
  }

  private now(): number {
    return this.rt ? this.rt.ctx.currentTime : 0;
  }

  /**
   * Boot-time warm-up (preload): create the context — suspended, it cannot make a sound — and the
   * mixing graph, so the first key press does not pay the device bring-up.
   */
  prepare(): Live {
    if (this.rt) return this.rt;
    const ctx = createContext();
    if (ctx.state === 'running' && !this.unlocked) {
      ctx.suspend().catch((err: unknown) => console.warn('[audio] could not suspend the early context', err));
    }
    const engine = new Engine(ctx, this.volumes);
    const conductor = new Conductor(engine);
    const voices = new VoicePlayer(engine, new URL(import.meta.env.BASE_URL, window.location.href));
    const watcher = new SessionWatcher(this, engine, (level) => conductor.setIntensity(level));
    this.rt = { ctx, engine, conductor, sfx: new SfxPlayer(engine), voices, watcher };
    return this.rt;
  }

  unlock(): Promise<void> {
    const rt = this.prepare();
    if (!this.unlocked) {
      this.unlocked = true;
      setInterval(() => this.pump(), 25);
      this.since = performance.now();
      rt.voices.prefetch();
      if (this.wanted) this.startSong(this.wanted.id, this.wanted.fade);
    }
    if (rt.ctx.state === 'running') return Promise.resolve();
    return rt.ctx.resume().catch((err: unknown) => console.warn('[audio] AudioContext could not start yet (needs a user gesture)', err));
  }

  private setAhead(mode: keyof typeof AHEAD): void {
    this.ahead = mode;
    this.settleUntil = performance.now() + (mode === 'loading' ? 15000 : 2000);
    this.pump();
  }

  private pump(): void {
    const rt = this.rt;
    if (!rt || !this.unlocked || rt.ctx.state !== 'running') return;
    const t0 = performance.now();
    if (this.ahead !== 'normal' && t0 > this.settleUntil) this.ahead = 'normal';
    const ahead = Math.max(AHEAD[this.ahead], document.hidden ? AHEAD.hidden : 0);
    rt.conductor.schedule(rt.ctx.currentTime + ahead);
    if (!this.stalled && this.lastUpdate > 0 && t0 - this.lastUpdate > STALL * 1000) {
      // The frame loop stopped (hidden tab, long stall): no speed-linked drone meanwhile.
      this.stalled = true;
      rt.watcher.halt();
    }
    this.spentMs += performance.now() - t0;
  }

  private startSong(id: string | null, fade: number): void {
    const s = this.session();
    const vamp = id !== null && id === this.raceSong() && (s?.phase === 'intro' || s?.phase === 'countdown');
    this.rt?.conductor.play(id, fade, { vamp });
  }

  // ------------------------------------------------------------------ AudioSystem
  /** Song for the UI's screen music ('race' / 'intro' = this track's song, 'pause' = keep). */
  music(id: string | null, fade = 0.8): void {
    if (id === 'pause') return;
    const resolved = id === 'race' || id === 'intro' ? this.raceSong() : id;
    // The main theme carries from the title into the menus: the lounge 'menu' never cuts it off.
    if (resolved === 'menu' && this.wanted?.id === 'title') return;
    this.wanted = { id: resolved, fade };
    if (this.unlocked) this.startSong(resolved, fade);
  }

  sfx(id: string, opts: { volume?: number; pitch?: number; pan?: number } = {}): void {
    const rt = this.rt;
    if (!rt || !this.live) return;
    if (!id.startsWith('sting.')) {
      if (rt.sfx.play(id, opts) > 0) this.note('sfx', id, opts.volume ?? 1);
      return;
    }
    const sting = id.slice(6);
    if (isStinger(sting)) this.stinger(sting);
    else if (!this.warnedSting) {
      this.warnedSting = true;
      console.warn(`[audio] unknown stinger "${sting}"`);
    }
  }

  voice(id: string): void {
    if (this.live && this.rt?.voices.play(id, { channel: 'announcer' })) this.note('voice', id, 1);
  }

  setMuffle(amount: number): void {
    this.external = Math.min(1, Math.max(0, amount));
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number; voice?: number }): void {
    this.volumes = { ...this.volumes, ...v };
    this.rt?.engine.setVolumes(this.volumes);
  }

  attach(session: Session | null): void {
    this.attachUsed = true;
    this.attached = session;
    if (session) this.setAhead('settling');
  }

  update(): void {
    const rt = this.rt;
    this.lastUpdate = performance.now();
    this.stalled = false;
    if (!rt || !this.live) return;
    this.pump();
    const t0 = performance.now();
    const clock = this.app.clock;
    const scale = clock.getScale('pause') === 0 ? 0 : clock.scale;
    rt.watcher.update(this.session(), scale, rt.ctx.currentTime);
    rt.voices.update();
    const slowmo = scale > 0 && scale < 0.95 ? (1 - scale) * 0.8 : 0;
    rt.engine.setMuffle(Math.max(this.external, this.cine, slowmo));
    this.spentMs += performance.now() - t0;
  }

  // ------------------------------------------------------------------ Host
  session(): Session | null {
    if (this.attachUsed) return this.attached;
    return window.__br?.session() ?? null;
  }

  isPlayer(id: RiderId | null): boolean {
    return id !== null && this.session()?.player.id === id;
  }

  raceSong(): string | null {
    const s = this.session();
    return s ? `race-${s.config.trackId}` : null;
  }

  play(id: string, where: Where = null, opts: PlayOpts = {}): void {
    const rt = this.rt;
    if (!rt || !this.live) return;
    const p = this.placeOf(where);
    if (p.gain < 0.02) return;
    const scale = this.app.clock.scale;
    const slow = where !== null && scale < 1 ? 0.6 + 0.4 * scale : 1;
    const volume = (opts.volume ?? 1) * p.gain;
    const played = rt.sfx.play(id, { ...opts, volume, pan: (opts.pan ?? 0) + p.pan, lowpass: Math.min(opts.lowpass ?? 20000, p.lowpass), pitch: (opts.pitch ?? 1) * slow });
    if (played > 0) this.note('sfx', id, volume);
  }

  boom(id: string, where: Where = null, opts: PlayOpts = {}): void {
    const now = performance.now();
    const owned = now - this.lastBoom < BOOM_GAP_MS;
    this.lastBoom = now;
    this.play(id, where, owned ? { ...opts, highpass: Math.max(opts.highpass ?? 0, 180) } : { ...opts, impact: true });
  }

  announce(id: string, priority = 1): void {
    if (this.live && this.rt?.voices.play(id, { channel: 'announcer', priority })) this.note('voice', id, 1);
  }

  bark(riderId: RiderId, kind: BarkKind, text?: string): void {
    const rt = this.rt;
    const s = this.session();
    const r = s?.rider(riderId);
    if (!rt || !this.live || !s || !r) return;
    if (text?.includes('叮')) {
      // The bell taunt (B) is a bell, not a voice line.
      if (this.cooldown(`bell${riderId}`, 0.6)) this.play('bike.bell', riderId);
      return;
    }
    if (Math.abs(r.s - s.player.s) > BARK_NEAR) return;
    const def = ROSTER[r.character];
    const lines = kind === 'ko' ? def.koLines : kind === 'hurt' ? def.hurtLines : def.taunts;
    // A given bubble text plays its own clip; otherwise pick one of the lines that has a clip.
    const voiced = lines.map((l) => rt.voices.idFor(l)).filter((x): x is string => x !== null);
    const id = text !== undefined ? rt.voices.idFor(text) : voiced.length ? this.rng.pick(voiced) : null;
    const follow = (): { gain: number; pan: number } | null => this.barkPlace(riderId);
    const at = follow();
    if (id && at && rt.voices.play(id, { channel: 'bark', pan: at.pan, gain: at.gain, follow })) {
      this.note('bark', id, at.gain);
      return;
    }
    if (this.cooldown(`call${riderId}`, 2)) this.play(`animal.${r.character}`, riderId, { volume: 0.85 });
  }

  stinger(id: StingerId): void {
    if (!this.live || !this.rt) return;
    this.rt.conductor.stinger(id);
    this.note('sting', id, 1);
  }

  song(id: string | null, fade = 0.8): void {
    this.music(id, fade);
  }

  countdown(n: number): void {
    const rt = this.rt;
    if (!rt || !this.live) return;
    if (n > 0) rt.conductor.countdown(n);
    else rt.conductor.go();
    this.note('sting', n > 0 ? 'count' : 'go', 1);
  }

  setCine(amount: number): void {
    this.cine = Math.min(1, Math.max(0, amount));
  }

  dropBass(amount: number, tau?: number): void {
    this.rt?.conductor.dropBass(amount, tau);
  }

  duckMusic(depthDb: number, hold: number): void {
    const rt = this.rt;
    if (rt && this.live) rt.engine.duckMusic(rt.ctx.currentTime, depthDb, hold);
  }

  cooldown(key: string, seconds: number): boolean {
    const now = performance.now() / 1000;
    const last = this.cool.get(key);
    if (last !== undefined && now - last < seconds) return false;
    this.cool.set(key, now);
    return true;
  }

  // ------------------------------------------------------------------ helpers
  private note(kind: string, id: string, gain: number): void {
    this.trace.push({ ms: performance.now(), kind, id, gain: +gain.toFixed(3) });
    if (this.trace.length > 200) this.trace.shift();
  }

  /** Snapshot for tests / the debug API. */
  debugState(): Record<string, unknown> {
    const rt = this.rt;
    return {
      live: this.live, ctx: rt?.ctx.state ?? 'none', rate: rt?.ctx.sampleRate ?? 0, latency: rt?.ctx.baseLatency ?? 0,
      song: rt?.conductor.playing ?? null, intensity: rt?.conductor.level ?? 0, muffle: rt?.engine.muffled ?? 0,
      wanted: this.wanted?.id ?? null, songsStarted: rt?.conductor.created ?? 0, lookahead: this.ahead, stalled: this.stalled,
      mainThreadPct: this.since ? +((this.spentMs / Math.max(1, performance.now() - this.since)) * 100).toFixed(3) : 0,
    };
  }

  traceLog(): TraceEntry[] {
    return this.trace.slice();
  }

  /** The final mix (for recording / metering in tests), once unlocked. */
  mixOutput(): { ctx: AudioContext; node: AudioNode } | null {
    return this.rt && this.unlocked ? { ctx: this.rt.ctx, node: this.rt.engine.output } : null;
  }

  private placeOf(where: Where): Placement {
    if (where === null) return CENTER;
    const s = this.session();
    if (typeof where === 'number') {
      const r = s?.rider(where);
      if (!s || !r) return CENTER;
      if (r.isPlayer) return CENTER;
      s.track.toWorld(r.s, r.x, r.y + 1, this.pos);
      return place(this.app.camera, this.pos);
    }
    return place(this.app.camera, where);
  }

  /** A speaking rival's gain / pan now: camera placement, faded out with track distance. */
  private barkPlace(riderId: RiderId): { gain: number; pan: number } | null {
    const s = this.session();
    const r = s?.rider(riderId);
    if (!s || !r) return null;
    const d = Math.abs(r.s - s.player.s);
    const fade = d <= BARK_NEAR ? 1 : d >= BARK_FAR ? 0 : 1 - (d - BARK_NEAR) / (BARK_FAR - BARK_NEAR);
    const p = this.placeOf(riderId);
    return { gain: Math.min(1, p.gain * 1.15) * fade, pan: p.pan };
  }
}
