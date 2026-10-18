// AudioSystem implementation: thin wiring of the audio runtime. The AudioContext and mixing graph
// are built at boot (preload) but stay suspended and silent until unlock() (a user gesture):
// nothing plays before it, and music requested earlier starts on unlock. Without WebAudio the
// game runs silent (every method no-ops). Bus events drive every gameplay sound (events-*.ts),
// the session watcher the continuous ones, music/pump.ts the scheduling clock, voice/barks.ts
// the character lines. Volumes follow app.save settings.
import { Vector3 } from 'three';
import { AUDIO_RATE, Engine, type Volumes } from './engine';
import { wireCombat } from './events-combat';
import { wireRace } from './events-race';
import { prepareDrumSamples } from './music/instruments/drum-samples';
import { prepareSampleBanks } from './music/instruments/banks';
import { prepareLoopBuffers } from './sfx/loop-buffers';
import { Conductor } from './music/conductor';
import { SONGS } from './music/songs';
import { Pump } from './music/pump';
import { isStinger, type StingerId } from './music/stingers';
import { PREWARM_RACE, PREWARM_UI, SfxPlayer, type PlayOpts } from './sfx/bank';
import { CENTER, place, type Placement } from './sfx/spatial';
import { Barks } from './voice/barks';
import { VoicePlayer } from './voice/player';
import { SessionWatcher } from './watcher';
import { installAudioDebug, Trace, type TraceEntry } from './debug';
import type { AppContext, AudioSystem, Session } from '../core/contracts';
import type { RiderId } from '../core/types';
import type { BarkKind, Host, Where } from './host';

interface Live {
  ctx: AudioContext;
  engine: Engine;
  conductor: Conductor;
  sfx: SfxPlayer;
  voices: VoicePlayer;
  barks: Barks;
  watcher: SessionWatcher;
}

/** Sub-heavy impacts closer together than this (ms) share one low end. */
const BOOM_GAP_MS = 400;
/** External muffle at or above this = the game is paused (voices hold, a running countdown stops). */
const PAUSED = 0.9;
const VOLUME_KEYS = ['master', 'music', 'sfx', 'voice'] as const;
/** Form index the results song starts from after a finish outside the top 3 (its B section). */
const RESULTS_LOW = Math.max(0, SONGS.results?.form.indexOf('B') ?? 0);

function createContext(): AudioContext {
  if (typeof AudioContext === 'undefined') throw new Error('AudioContext is not available');
  try {
    return new AudioContext({ latencyHint: 'interactive', sampleRate: AUDIO_RATE });
  } catch (err) {
    // Only an unsupported rate is worth a retry; anything else is the real failure (see prepare).
    if (!(err instanceof DOMException && err.name === 'NotSupportedError')) throw err;
    console.warn('[audio] 32 kHz context unavailable, using the device rate', err);
    return new AudioContext({ latencyHint: 'interactive' });
  }
}

export class AudioRuntime implements AudioSystem, Host {
  private rt: Live | null = null;
  /** WebAudio could not start (see prepare): every method is a no-op. */
  private disabled = false;
  private unlocked = false;
  private wanted: { id: string | null; fade: number } | null = null;
  private volumes: Volumes;
  private external = 0;
  private cine = 0;
  private attached: Session | null = null;
  private attachUsed = false;
  private cool = new Map<string, number>();
  /** Main-thread time spent in update() since unlock (ms) and when unlocked. */
  private spentMs = 0;
  private since = 0;
  private pos = new Vector3();
  private warnedSting = false;
  private lastBoom = -Infinity;
  /** The player's final place (results music variant; Infinity = did not finish), null before. */
  private finishPlace: number | null = null;
  private pump: Pump;
  private trace = new Trace();

  constructor(readonly app: AppContext) {
    const st = app.save.data.settings;
    this.volumes = { master: st.master, music: st.music, sfx: st.sfx, voice: st.voice };
    // Only an edit of the saved volumes re-applies them: unrelated saves (achievements, coins)
    // must not undo a live setVolumes().
    let saved: Volumes = { ...this.volumes };
    app.save.onChange((d) => {
      const next: Volumes = { master: d.settings.master, music: d.settings.music, sfx: d.settings.sfx, voice: d.settings.voice };
      if (VOLUME_KEYS.every((k) => next[k] === saved[k])) return;
      saved = next;
      this.setVolumes(next);
    });
    wireRace(app.bus, this);
    app.bus.on('race:finishLine', ({ riderId, place }) => {
      if (this.isPlayer(riderId)) this.finishPlace = place;
    });
    app.bus.on('race:end', ({ results }) => {
      const me = results.find((r) => r.isPlayer);
      if (me) this.finishPlace = me.time === null ? Infinity : me.place;
    });
    wireCombat(app.bus, this);
    app.bus.on('police:alert', ({ level }) => this.rt?.watcher.alert(level, this.now()));
    this.pump = new Pump({
      clock: () => (this.live && this.rt ? this.rt.ctx.currentTime : null),
      schedule: (until) => this.rt?.conductor.schedule(until),
      halt: () => this.rt?.watcher.halt(),
    });
    this.pump.wire(app.bus);
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
   * mixing graph, so the first key press does not pay the device bring-up. Some engines (WebKit)
   * start an allowed context asynchronously: it is suspended again until unlock().
   */
  prepare(): Live | null {
    if (this.rt || this.disabled) return this.rt;
    let ctx: AudioContext | null = null;
    try {
      const c = createContext();
      ctx = c;
      const hold = (): void => {
        if (this.unlocked) c.onstatechange = null;
        else if (c.state === 'running') c.suspend().catch((err: unknown) => console.warn('[audio] could not suspend the early context', err));
      };
      c.onstatechange = hold;
      hold();
      const engine = new Engine(c, this.volumes);
      prepareDrumSamples(c);
      prepareLoopBuffers(c);
      void prepareSampleBanks(c.sampleRate);
      const conductor = new Conductor(engine);
      const voices = new VoicePlayer(engine, new URL(import.meta.env.BASE_URL, window.location.href),
        (id, channel, gain) => this.trace.note(channel === 'bark' ? 'bark' : 'voice', id, gain));
      const watcher = new SessionWatcher(this, engine, (level) => conductor.setIntensity(level));
      this.rt = { ctx: c, engine, conductor, sfx: new SfxPlayer(engine), voices, barks: new Barks(this, voices), watcher };
    } catch (err) {
      // No WebAudio (disabled, no output device, context limit): the game runs silent.
      this.disabled = true;
      console.warn('[audio] WebAudio unavailable, the game runs without sound', err);
      ctx?.close().catch((e: unknown) => console.warn('[audio] could not close the failed context', e));
    }
    return this.rt;
  }

  unlock(): Promise<void> {
    const rt = this.prepare();
    if (!rt) return Promise.resolve();
    if (!this.unlocked) {
      this.unlocked = true;
      rt.ctx.onstatechange = null;
      this.pump.start();
      this.since = performance.now();
      rt.voices.prefetch();
      rt.sfx.prewarm(PREWARM_UI);
      if (this.wanted) this.startSong(this.wanted.id, this.wanted.fade);
    }
    if (rt.ctx.state === 'running') return Promise.resolve();
    return rt.ctx.resume().catch((err: unknown) => console.warn('[audio] AudioContext could not start yet (needs a user gesture)', err));
  }

  /** The race song starts in its vamp while the race intro / countdown runs (GO lands on bar 1 of A). */
  private vampFor(id: string | null): boolean {
    const s = this.session();
    return id !== null && id === this.raceSong() && (s?.phase === 'intro' || s?.phase === 'countdown');
  }

  private startSong(id: string | null, fade: number): void {
    // Off the podium the results open on their gospel bridge instead of the brass fanfare.
    const consolation = id === 'results' && this.finishPlace !== null && this.finishPlace > 3;
    this.rt?.conductor.play(id, fade, { vamp: this.vampFor(id), section: consolation ? RESULTS_LOW : undefined });
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
      if (rt.sfx.play(id, opts) > 0) this.trace.note('sfx', id, opts.volume ?? 1);
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
    if (this.live) this.rt?.voices.play(id, { channel: 'announcer' });
  }

  setMuffle(amount: number): void {
    const was = this.external >= PAUSED;
    this.external = Math.min(1, Math.max(0, amount));
    const paused = this.external >= PAUSED;
    if (paused === was || !this.rt) return;
    this.rt.voices.setPaused(paused);
    if (paused) this.rt.conductor.pauseCountdown();
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number; voice?: number }): void {
    this.volumes = { ...this.volumes, ...v };
    this.rt?.engine.setVolumes(this.volumes);
  }

  attach(session: Session | null): void {
    this.attachUsed = true;
    this.attached = session;
    if (!session) return;
    this.finishPlace = null;
    this.pump.set('settling');
    this.rt?.sfx.prewarm(PREWARM_RACE);
    // Restarting the same track: the song is already current, so re-enter its vamp for the new intro.
    const id = this.raceSong();
    if (this.unlocked && this.rt && id !== null && this.rt.conductor.playing === id && this.vampFor(id)) {
      this.rt.conductor.restart(id);
    }
  }

  update(): void {
    const rt = this.rt;
    this.pump.frame();
    if (!rt || !this.live) return;
    this.pump.run();
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

  place(where: Where): Placement {
    if (where === null) return CENTER;
    if (typeof where !== 'number') return place(this.app.camera, where);
    const s = this.session();
    const r = s?.rider(where);
    if (!s || !r || r.isPlayer) return CENTER;
    s.track.toWorld(r.s, r.x, r.y + 1, this.pos);
    return place(this.app.camera, this.pos);
  }

  play(id: string, where: Where = null, opts: PlayOpts = {}): void {
    const rt = this.rt;
    if (!rt || !this.live) return;
    const p = this.place(where);
    if (p.gain < 0.02) return;
    const scale = this.app.clock.scale;
    const slow = where !== null && scale < 1 ? 0.6 + 0.4 * scale : 1;
    const volume = (opts.volume ?? 1) * p.gain;
    const played = rt.sfx.play(id, { ...opts, volume, pan: (opts.pan ?? 0) + p.pan, lowpass: Math.min(opts.lowpass ?? 20000, p.lowpass), pitch: (opts.pitch ?? 1) * slow });
    if (played > 0) this.trace.note('sfx', id, volume);
  }

  boom(id: string, where: Where = null, opts: PlayOpts = {}): void {
    const now = performance.now();
    const owned = now - this.lastBoom < BOOM_GAP_MS;
    this.lastBoom = now;
    this.play(id, where, owned ? { ...opts, highpass: Math.max(opts.highpass ?? 0, 180) } : { ...opts, impact: true });
  }

  announce(id: string, priority = 1): void {
    if (this.live) this.rt?.voices.play(id, { channel: 'announcer', priority });
  }

  bark(riderId: RiderId, kind: BarkKind, text?: string, wait?: number): void {
    if (this.live) this.rt?.barks.say(riderId, kind, text, wait);
  }

  stinger(id: StingerId): void {
    if (!this.live || !this.rt) return;
    this.rt.conductor.stinger(id);
    this.trace.note('sting', id, 1);
  }

  song(id: string | null, fade = 0.8): void {
    this.music(id, fade);
  }

  countdown(n: number): void {
    const rt = this.rt;
    if (!rt || !this.live) return;
    if (n > 0) rt.conductor.countdown(n);
    else rt.conductor.go();
    this.trace.note('sting', n > 0 ? 'count' : 'go', 1);
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

  // ------------------------------------------------------------------ debug surface (debug.ts)
  debugState(): Record<string, unknown> {
    const rt = this.rt;
    const c = rt?.conductor;
    const spent = this.spentMs + this.pump.spentMs;
    return {
      live: this.live, ctx: rt?.ctx.state ?? (this.disabled ? 'disabled' : 'none'), rate: rt?.ctx.sampleRate ?? 0,
      latency: rt?.ctx.baseLatency ?? 0, song: c?.playing ?? null, intensity: c?.level ?? 0, muffle: rt?.engine.muffled ?? 0,
      wanted: this.wanted?.id ?? null, songsStarted: c?.created ?? 0, lookahead: this.pump.mode, stalled: this.pump.stalled,
      mainThreadPct: this.since ? +((spent / Math.max(1, performance.now() - this.since)) * 100).toFixed(3) : 0,
      sync: c?.sync() ?? null,
    };
  }

  traceLog(): TraceEntry[] {
    return this.trace.log();
  }

  /** The final mix (for recording / metering in tests), once unlocked. */
  mixOutput(): { ctx: AudioContext; node: AudioNode } | null {
    return this.rt && this.unlocked ? { ctx: this.rt.ctx, node: this.rt.engine.output } : null;
  }
}
