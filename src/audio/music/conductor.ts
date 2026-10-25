// Conductor: which song is playing, crossfades between songs, adaptive intensity, KO bass drop,
// the race start (vamp → count-in → GO on bar 1 of section A) and stingers (in the song's key,
// on its grid, ducking it). Scheduling is pull-based (`schedule(until)`), so the same code drives
// the realtime timer and OfflineAudioContext renders.
import { Band } from './band';
import { countStep } from './countin';
import { SongPlayer } from './player';
import { SONGS } from './songs';
import { STINGERS, STING_TIMING, type StingerId } from './stingers';
import { parseKey, type Tonality } from './theory';
import type { Engine } from '../engine';
import type { Channel } from './types';

const STING_DUCK_DB = -7.5;
/** A count arriving this far (s) from the predicted GO re-phases the song (stall, missed pause). */
const DRIFT = 0.06;
/** Bars are rendered ahead only under this lookahead (s): a race load (3 s) queues live notes instead. */
const AHEAD_MAX = 2;

export class Conductor {
  private current: SongPlayer | null = null;
  private fading: SongPlayer[] = [];
  private currentId: string | null = null;
  private intensity = 0;
  private stingBand: Band | null = null;
  private lastKey: Tonality = { tonic: 0, mode: 'major' };
  /** Predicted GO time (audio clock) while a race countdown runs. */
  private goAt: number | null = null;
  /** The last GO downbeat (audio clock), for tests. */
  private lastGo: number | null = null;
  /** SongPlayers created so far (tests: resuming a race must not restart its song). */
  created = 0;

  constructor(private engine: Engine) {}

  get playing(): string | null {
    return this.currentId;
  }

  get level(): number {
    return this.intensity;
  }

  /**
   * Switch songs (crossfade over `fade` s, from `at`). Same id = no-op unless `force`; null = fade
   * to silence. `vamp`: start in the song's vamp and wait for countdown()/go() (race intro).
   */
  play(
    id: string | null, fade = 0.8,
    opts: { section?: number; at?: number; vamp?: boolean; force?: boolean; mix?: Partial<Record<Channel, number>> } = {},
  ): void {
    if (id === this.currentId && !opts.force) return;
    if (id !== null && !SONGS[id]) {
      console.warn(`[audio] unknown song "${id}"`);
      return;
    }
    const at = opts.at ?? this.engine.now + 0.05;
    if (this.current) {
      this.current.stop(Math.max(0.05, fade), Math.max(this.engine.now, at - 0.05));
      this.fading.push(this.current);
    }
    this.current = null;
    this.currentId = id;
    this.intensity = 0;
    this.goAt = null;
    const song = id ? SONGS[id] : undefined;
    if (!song) return;
    this.current = new SongPlayer(this.engine, song, at, { section: opts.section, fadeIn: Math.min(fade, 1.2), vamp: opts.vamp, mix: opts.mix });
    this.lastKey = parseKey(song.key);
    this.created++;
  }

  /**
   * Same-track restart: a fresh copy of the song in its vamp from the running one's next bar line
   * (short crossfade), so the new race's intro → count-in → GO sync starts over.
   */
  restart(id: string): void {
    const p = this.current;
    this.play(id, 0.3, { vamp: true, force: true, at: p ? p.grid(this.engine.now + 0.05, 16) : undefined });
  }

  /** The game paused mid-countdown: back to the vamp; the next count re-cues GO from scratch. */
  pauseCountdown(): void {
    const p = this.current;
    if (!p || this.goAt === null) return;
    p.hold(this.engine.now + 0.03);
    this.goAt = null;
  }

  /** Race-start sync state for tests: predicted / last GO and the song's recent section starts. */
  sync(): { goAt: number | null; lastGo: number | null; starts: Array<{ section: string; at: number }> } {
    return { goAt: this.goAt, lastGo: this.lastGo, starts: this.current ? this.current.starts.slice() : [] };
  }

  /** 0 base · 1 top-3 · 2 final stretch. */
  setIntensity(level: number): void {
    this.intensity = level;
    this.current?.setIntensity(level);
  }

  /** The music is playing live notes (not the pre-rendered bars): the main thread is behind. */
  get live(): boolean {
    return this.current !== null && this.current.liveUntil > this.engine.now;
  }

  /** Strip the low end out of the music (0 = full range); `tau` = how fast. */
  dropBass(amount: number, tau = 0.05): void {
    this.current?.band.dropBass(amount, tau);
  }

  /** Race countdown step n (3, 2, 1; `step` s apart): the song waits silently for GO, a count-in builds. */
  countdown(n: number, step = 1): void {
    const p = this.current;
    const now = this.engine.now;
    const first = this.goAt === null;
    const goAt = now + n * step;
    const drifted = this.goAt !== null && Math.abs(this.goAt - goAt) > DRIFT;
    if (p && (p.holding || drifted || (this.goAt !== null && p.scheduledUntil <= this.goAt + 0.001))) {
      p.cue(p.song.form[p.song.loopFrom] ?? 'A', goAt);
    }
    this.goAt = goAt;
    this.stinger('count', now + 0.005);
    countStep(this.band(), now, step, n, p ? p.chordOf(p.song.form[p.song.loopFrom] ?? 'A') : null, first);
  }

  /** GO: bar 1 of section A starts now (or already did, on the predicted downbeat) with the GO hit. */
  go(): void {
    const p = this.current;
    const now = this.engine.now;
    let at = now + 0.02;
    const sectionA = p ? p.song.form[p.song.loopFrom] ?? 'A' : 'A';
    if (p && this.goAt !== null && p.scheduledUntil > this.goAt + 0.001) at = Math.max(this.goAt, now + 0.005);
    else if (p && (p.holding || this.goAt !== null)) p.cue(sectionA, at);
    this.goAt = null;
    this.lastGo = at;
    this.stinger('go', at);
  }

  /**
   * Play a stinger in the current song's key: on its next 8th note / beat (per STING_TIMING)
   * unless `at` is given, ducking the music for its length. Returns the start time.
   */
  stinger(id: StingerId, at?: number): number {
    const timing = STING_TIMING[id];
    const p = this.current;
    const now = this.engine.now;
    const soon = now + 0.01;
    const onGrid = p && !p.holding && this.goAt === null && timing.grid > 0;
    const t = at ?? (onGrid ? p.grid(soon, timing.grid) : soon);
    const key = p?.key ?? this.lastKey;
    const chord = id === 'go' && p ? p.chordOf(p.song.form[p.song.loopFrom] ?? 'A') : undefined;
    const length = STINGERS[id](this.band(), t, { key, chord: chord ?? undefined });
    if (timing.duck) this.engine.duckMusic(t, STING_DUCK_DB, length * 0.8);
    return t;
  }

  /** The stinger / count-in band (stingers and count steps last ≤ 4 s: the reverb stays on that long). */
  private band(): Band {
    this.engine.keepReverb(this.engine.now + 4);
    if (!this.stingBand) {
      this.stingBand = new Band(this.engine, 120, { lead: 1.1, brass: 1.3 }, this.engine.stingIn);
      this.stingBand.fade(1, 0.01, this.engine.now);
    }
    return this.stingBand;
  }

  /** Schedule music up to `until` (audio clock) and drop finished crossfades. */
  schedule(until: number): void {
    const now = this.engine.now;
    this.stingBand?.tick(now);
    // Whole bars render ahead unless a countdown may re-phase the song or a race load needs live notes queued.
    const ahead = this.goAt === null && until - now <= AHEAD_MAX;
    this.current?.schedule(until, ahead);
    for (const p of this.fading) p.schedule(until, ahead);
    if (this.fading.length) this.fading = this.fading.filter((p) => !p.gone);
    // The music reverb runs while a song plays live notes (rendered bars carry their own).
    const live = Math.max(this.current?.liveUntil ?? -Infinity, ...this.fading.map((p) => p.liveUntil));
    if (live > now) this.engine.keepReverb(Math.min(until, live));
    this.engine.tick();
  }
}
