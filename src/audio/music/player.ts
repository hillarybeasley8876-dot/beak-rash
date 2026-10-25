// SongPlayer: lookahead scheduler for one song. Walks the form bar by bar (loops seamlessly from
// `loopFrom`), applies swing + light humanisation, voice-leads chord instruments, rotates fills,
// follows the adaptive intensity (layers; the final stretch = a one-bar build, then the stretch
// form with a tempo / key lift), can hold a vamp and re-phase onto a downbeat (race start), and
// fades out on stop. Steps that fall behind the audio clock (main-thread stall) are skipped.
// In a realtime context whole bars are rendered ahead (music/bars.ts) whenever nothing can re-phase
// them (no vamp, no countdown, no race load): the band then plays from buffers and its live graph
// is unplugged. The vamp, the count-in, race loads and each song's first bar play live.
import { Rng } from '../../core/rng';
import { noise } from '../dsp/noise';
import { Band, sectionEnd } from './band';
import { BarRenderer, type BarJob } from './bars';
import { drumBar } from './groove';
import { CHORD_LANES, bassStep, chordStep, leadStep, noteSpan, type LaneSource } from './lanes';
import { compileSong, songMix, tiedLength, tokenAt, type CompiledSection, type CompiledSong } from './compile';
import { parseKey, type Chord, type Tonality } from './theory';
import type { DrumSample } from './instruments/drum-samples';
import type { Engine } from '../engine';
import type { Channel, LaneName, Song } from './types';

const VEL: Record<string, number> = { X: 1, x: 0.8, o: 0.55, g: 0.3, S: 1, s: 0.7, T: 1, t: 0.7, B: 1, b: 0.75, r: 0.7, f: 0.9 };
const LATE = 0.03;   // s: a step this far behind the clock is skipped, not played late
const BUILD = 'build';
/** Bar renders: opened ≥ BAR_LEAD s before their bar, sequenced SLICE_MS of main-thread time per
 *  scheduling call (all at once from RUSH s before the bar); they last the longest note + NOTE_RING,
 *  at least the bar + DRUM_RING (a crash), then FX_TAIL (delay / reverb). */
const BAR_LEAD = 0.6, SLICE_MS = 1.5, RUSH = 0.3, NOTE_RING = 0.8, DRUM_RING = 2, FX_TAIL = 2.2;
/** Live steps run past the lookahead only to reach a bar line this close (s), whose bar is then rendered. */
const REACH = BAR_LEAD + 0.25;
/** The live graph stays plugged LIVE_TAIL s after the last live step's bar; the final stretch lifts the band
  *  +2 dB but trims the lead by STRETCH_LEAD (−2.5 dB: about where it was; the doubled hook carries it). */
const LIVE_TAIL = 2, STRETCH_LEAD = 0.75;

interface Job { bar: BarJob; band: Band; at: number; end: number }
/** A background tab's timer fires about once a second: bars are sequenced whole there (no frames to spare). */
const hidden = (): boolean => typeof document !== 'undefined' && document.hidden;

export interface PlayerOpts {
  section?: number;
  intensity?: number;
  fadeIn?: number;
  /** Start in the song's vamp (race intro); cue() re-phases out of it. */
  vamp?: boolean;
  /** Channel gain multipliers on top of the song's mix (analysis: solo / mute stems). */
  mix?: Partial<Record<Channel, number>>;
}

export class SongPlayer {
  readonly band: Band;
  readonly song: Song;
  private compiled: CompiledSong;
  private stepDur: number;
  private nextTime: number;
  private form: string[];
  private loopFrom: number;
  private formIndex = 0;
  private stepInSection = 0;
  private intensity = 0;
  private pendingForm: 'main' | 'stretch' | typeof BUILD | null = null;
  /** A top-3 change (0 ↔ 1) waiting for the next 2-bar line. */
  private pendingLevel: number | null = null;
  private building = false;
  private holdName: string | null = null;
  private crashNext = false;
  /** Audio time up to which the drums are pre-mixed (drumBar). */
  private drumsUntil = -Infinity;
  private semis = 0;
  private bpm: number;
  private passes = new Map<string, number>();
  private rng: Rng;
  private stopAt = Infinity;
  private crackle: AudioBufferSourceNode | null = null;
  private readonly home: Tonality;
  private readonly mix: Partial<Record<Channel, number>>;
  /** Bar renders (realtime contexts only; offline renders and a failed render play live). */
  private bars: BarRenderer | null;
  /** Step context; its band / base = where the steps being sequenced play (the live band, or a bar render's). */
  private lanes: LaneSource;
  /** Audio time until which live-scheduled notes may sound (the live graph stays plugged until then). */
  private liveEnd = -Infinity;
  private shapeStale = false;    // the live band's section dynamics are behind (bars were rendered since)
  private shapeLevel = 1;        // level at the end of the last section started (a bar render starts there)
  private turns = new Map<DrumSample, number>(); // drum take rotation, shared by every band of the song
  private job: Job | null = null; // the bar render being sequenced (its band, start and end in audio time)
  /** Recent section starts (audio time): tests check that section A lands on the race GO. */
  readonly starts: Array<{ section: string; at: number }> = [];

  constructor(readonly engine: Engine, song: Song, start: number, opts: PlayerOpts = {}) {
    this.song = song;
    this.compiled = compileSong(song);
    this.home = parseKey(song.key);
    this.rng = new Rng(song.bpm * 7919 + song.id.length);
    this.mix = songMix(song, opts.mix);
    this.band = new Band(engine, song.bpm, this.mix, engine.musicIn, this.rng.fork(0xba4d));
    this.band.fade(1, opts.fadeIn ?? 0.02, start);
    this.band.drums.shareTurns(this.turns);
    const ctx = engine.ctx;
    this.bars = typeof AudioContext !== 'undefined' && ctx instanceof AudioContext ? new BarRenderer(ctx, this.band.out) : null;
    this.lanes = {
      band: this.band, base: 0, stepDur: 0, semis: 0, lead: song.lead, voicings: {}, leads: new Map(),
      time: (t) => Math.max(0, t - this.lanes.base),
      tok: (sec, lane, step) => this.tok(sec, lane, step),
      len: (sec, lane, step) => this.len(sec, lane, step),
      vel: (c) => this.vel(c),
      random: () => this.rng.next(),
    };
    this.stepDur = 60 / song.bpm / 4;
    this.bpm = song.bpm;
    this.nextTime = start;
    this.form = song.form;
    this.loopFrom = song.loopFrom;
    this.formIndex = Math.min(opts.section ?? 0, this.form.length - 1);
    this.intensity = opts.intensity ?? 0;
    if (opts.vamp) this.holdName = song.vamp ?? this.form[0] ?? null;
    if (song.crackle) {
      // Vinyl crackle runs past the fader's section dynamics, so it carries on while bars are rendered.
      const src = noise(ctx, 'crackle', start, null, this.rng);
      src.connect(new GainNode(ctx, { gain: song.crackle * this.band.level('fx') })).connect(this.band.out);
      this.crackle = src;
    }
  }

  /** Stopped and its band unplugged: the conductor can forget it. */
  get gone(): boolean { return this.band.gone; }

  /** Audio time until which this song plays live notes (the music reverb stays on for them). */
  get liveUntil(): number { return this.liveEnd; }

  /** The key the song is in right now (the final-stretch lift transposes it). */
  get key(): Tonality {
    return { tonic: (this.home.tonic + this.semis + 120) % 12, mode: this.home.mode };
  }

  /** Audio time of the next step not yet scheduled. */
  get scheduledUntil(): number {
    return this.nextTime;
  }

  get holding(): boolean {
    return this.holdName !== null;
  }

  /** First chord of a section (GO doubles the downbeat chord; the count-in holds it). */
  chordOf(section: string): Chord | null {
    return this.compiled.sections.get(section)?.chords[0] ?? null;
  }

  /**
   * 0 = base, 1 = top-3 layer, 2 = final stretch (a one-bar build, then the stretch form).
   * Top-3 layers come and go on a 2-bar line, never mid-phrase.
   */
  setIntensity(level: number): void {
    const next = Math.max(0, Math.min(2, Math.round(level)));
    const wasStretch = this.intensity >= 2;
    if (next < 2 && !wasStretch) {
      this.pendingLevel = next === this.intensity ? null : next;
      return;
    }
    this.pendingLevel = null;
    if (next === this.intensity) return;
    this.intensity = next;
    if (!this.song.stretch || (next >= 2) === wasStretch) return;
    this.pendingForm = next >= 2 ? BUILD : 'main';
  }

  /** The band plays harder up front: +1 dB in the top 3, +2 dB in the final stretch. */
  private levelGain(stretch: boolean): number {
    return stretch ? 1.26 : this.intensity >= 1 ? 1.12 : 1;
  }

  /**
   * Re-phase: the next step played is step 0 of `section` at audio time `at` (the race GO).
   * Steps until then are skipped; a vamp hold ends; rendered bars end at `at`.
   */
  cue(section: string, at: number): void {
    this.cutDrums(this.nextTime);
    this.job = null;
    this.bars?.cut(at);
    const i = this.form.indexOf(section);
    this.holdName = null;
    this.pendingForm = null;
    this.building = false;
    this.formIndex = i >= 0 ? i : this.loopFrom;
    this.stepInSection = 0;
    this.nextTime = at;
  }

  /** Back into the vamp from `at` at the latest (a paused countdown); cue() leaves it again. */
  hold(at: number): void {
    this.holdName = this.song.vamp ?? this.form[0] ?? null;
    this.pendingForm = null;
    this.building = false;
    this.stepInSection = 0;
    this.nextTime = Math.min(this.nextTime, at);
    this.cutDrums(this.nextTime);
    this.job = null;
    this.bars?.cut(this.nextTime);
  }

  /** Pre-mixed drums stop at `at` (what the old timeline still had queued); the next step re-mixes. */
  private cutDrums(at: number): void {
    this.band.drums.cut(at);
    this.drumsUntil = -Infinity;
  }

  /**
   * First grid point (every `steps` 16ths, bar-aligned) at or after `t` — stingers land on the
   * song's 8th notes / beats.
   */
  grid(t: number, steps: number): number {
    let d = Math.ceil((t - this.nextTime) / this.stepDur - 1e-6);
    const phase = (((this.stepInSection + d) % steps) + steps) % steps;
    d += (steps - phase) % steps;
    return this.nextTime + d * this.stepDur;
  }

  /** Fade out over `fade` s from `at` (default now) and stop scheduling. */
  stop(fade: number, at = this.engine.ctx.currentTime): void {
    if (this.stopAt !== Infinity) return;
    if (this.job) this.sequence(this.job, true);
    this.band.fade(0, fade, at);
    this.stopAt = at + fade + 0.05;
    this.crackle?.stop(this.stopAt + 0.05);
    this.bars?.stop(this.stopAt);
    this.band.dispose(this.stopAt + 2.5);
  }

  /**
   * Schedule every step that starts before `until` (seconds, audio clock). `ahead`: nothing will
   * re-phase the song soon (no countdown, no race load), so whole bars are rendered a bar early.
   */
  schedule(until: number, ahead = false): void {
    const now = this.engine.ctx.currentTime;
    this.band.tick(now);
    if (this.job) this.sequence(this.job, !ahead || hidden() || this.job.at < now + RUSH);
    // After a stall, resync to the clock instead of firing a burst of past notes.
    for (let guard = 0; this.nextTime < now - LATE && guard < 100000; guard++) this.advance();
    const bars = ahead && this.bars && !this.bars.failed && this.holdName === null ? this.bars : null;
    const limit = bars ? until + 16 * this.stepDur : until;
    while (!this.job && this.nextTime < limit && this.nextTime < this.stopAt) {
      const toBar = ((16 - (this.stepInSection % 16)) % 16) * this.stepDur;
      if (bars && toBar === 0 && this.nextTime >= now + BAR_LEAD) this.openBar(bars);
      else if (this.nextTime < until || this.nextTime + toBar - now <= REACH) this.liveStep();
      else break;
    }
    if (now > this.liveEnd) this.band.setLive(false);
  }

  /** One step on the live band (plugged in again first, its section dynamics caught up). */
  private liveStep(): void {
    this.band.setLive(true);
    const sec = this.section();
    if (this.shapeStale && this.stepInSection % 16 === 0) {
      this.shapeStale = false;
      const bar = this.stepInSection / 16;
      if (bar > 0) this.band.section(this.nextTime, this.stepDur * 16, sec.gainDb, sec.shape, bar);
    }
    this.liveEnd = Math.max(this.liveEnd, this.nextTime + this.stepDur * 16 + LIVE_TAIL);
    this.scheduleStep();
    this.advance();
  }

  /** Start a bar render for the bar at nextTime (its band follows the song's mix, tempo and section level). */
  private openBar(bars: BarRenderer): void {
    const sec = this.section();
    const bar = 16 * this.stepDur;
    const seconds = Math.max(bar + DRUM_RING, noteSpan(this.lanes, sec, this.stepInSection) * this.stepDur + NOTE_RING) + FX_TAIL;
    const at = bars.frame(this.nextTime);
    const job = bars.open(at, seconds);
    if (!job) return this.liveStep();
    const band = new Band(job.host, this.bpm, this.mix, job.host.musicIn, this.rng.fork(Math.floor(at * 1000)));
    band.open(this.shapeLevel);
    band.drums.shareTurns(this.turns);
    if (this.semis !== 0 || this.form !== this.song.form) band.trim('lead', STRETCH_LEAD, 0);
    const from = this.stepInSection / 16;
    if (from > 0) band.section(0, bar, sec.gainDb, sec.shape, from);
    this.shapeStale = true;
    this.job = { bar: job, band, at, end: this.nextTime + bar };
    this.sequence(this.job, hidden());
  }

  /** Sequence steps into the bar render for SLICE_MS (`all`: to the bar's end); render it once complete. */
  private sequence(job: Job, all: boolean): void {
    const t0 = performance.now();
    this.lanes.band = job.band;
    this.lanes.base = job.at;
    try {
      do {
        this.scheduleStep();
        this.advance();
      } while (this.nextTime < job.end - 1e-6 && this.nextTime < this.stopAt && (all || performance.now() - t0 < SLICE_MS));
    } finally {
      this.lanes.band = this.band;
      this.lanes.base = 0;
    }
    if (this.nextTime < job.end - 1e-6 && this.nextTime < this.stopAt) return;
    this.job = null;
    job.bar.finish();
  }

  private sectionName(): string {
    return this.holdName ?? this.form[this.formIndex] ?? this.form[0] ?? '';
  }

  private section(): CompiledSection {
    const name = this.sectionName();
    const sec = this.compiled.sections.get(name);
    if (!sec) throw new Error(`[audio] missing section ${name}`);
    return sec;
  }

  private advance(): void {
    this.nextTime += this.stepDur;
    this.stepInSection++;
    if (this.pendingLevel !== null && this.stepInSection % 32 === 0) {
      this.intensity = this.pendingLevel;
      this.pendingLevel = null;
      this.band.fade(this.levelGain(false), 0.6, this.nextTime);
    }
    if (this.stepInSection % 16 === 0 && this.pendingForm) {
      if (this.pendingForm === BUILD) {
        this.pendingForm = 'stretch';
        this.building = true;
      } else {
        this.switchForm(this.pendingForm === 'stretch');
        return;
      }
    }
    const sec = this.section();
    if (this.stepInSection >= sec.steps) {
      this.stepInSection = 0;
      if (this.holdName) return;
      this.passes.set(sec.name, (this.passes.get(sec.name) ?? 0) + 1);
      this.formIndex = this.formIndex + 1 >= this.form.length ? this.loopFrom : this.formIndex + 1;
    }
  }

  /** Enter (or leave) the final-stretch form at this bar line, with the song's tempo / key lift. */
  private switchForm(stretch: boolean): void {
    const lift = stretch ? this.song.lift ?? { tempo: 1, semis: 0 } : { tempo: 1, semis: 0 };
    this.pendingForm = null;
    this.building = false;
    this.form = stretch && this.song.stretch ? this.song.stretch : this.song.form;
    this.loopFrom = stretch ? 0 : this.song.loopFrom;
    this.formIndex = stretch ? 0 : this.song.loopFrom;
    this.stepInSection = 0;
    this.crashNext = true;
    this.bpm = this.song.bpm * lift.tempo;
    this.stepDur = 60 / this.bpm / 4;
    this.semis = lift.semis;
    this.band.setTempo(this.bpm, this.nextTime);
    this.band.fade(this.levelGain(stretch), 0.25, this.nextTime);
    this.band.trim('lead', stretch ? STRETCH_LEAD : 1, this.nextTime);
  }

  private fillIndex(): number | null {
    return this.holdName ? null : this.passes.get(this.sectionName()) ?? 0;
  }

  private scheduleStep(): void {
    const sec = this.section();
    const step = this.stepInSection;
    const t0 = this.nextTime + (step % 2 === 1 ? this.song.swing * this.stepDur : 0);
    const human = (amount: number): number => Math.max(0, t0 + (this.rng.next() - 0.5) * amount);
    const chord = sec.chords[step] ?? sec.chords[0];
    if (!chord) return;
    const g = this.lanes;
    g.stepDur = this.stepDur;
    g.semis = this.semis;
    if (step === 0) {
      this.starts.push({ section: sec.name, at: this.nextTime });
      if (this.starts.length > 12) this.starts.shift();
      g.band.section(g.time(this.nextTime), this.stepDur * 16, sec.gainDb, sec.shape);
      this.shapeLevel = sectionEnd(sec.gainDb, sec.shape);
    }
    if (this.nextTime >= this.drumsUntil - 1e-6) {
      const kit = { kit: g.band.drums, swing: this.song.swing, building: this.building, time: g.time };
      this.drumsUntil = drumBar({ ...g, ...kit }, sec, step, this.nextTime, this.crashNext);
      this.crashNext = false;
    }
    bassStep(g, sec, step, human(0.003), chord);
    for (const lane of CHORD_LANES) chordStep(g, lane, sec, step, human(0.006), chord);
    leadStep(g, 'lead', sec, step, human(0.004));
    leadStep(g, 'lead2', sec, step, human(0.004));
  }

  private tok(sec: CompiledSection, lane: LaneName, step: number): string | null {
    const t = tokenAt(sec, lane, step, this.intensity, this.fillIndex());
    return t && t !== '.' && t !== '-' ? t : null;
  }

  private len(sec: CompiledSection, lane: LaneName, step: number): number {
    return tiedLength(sec, lane, step, this.intensity, this.fillIndex());
  }

  private vel(c: string): number {
    return (VEL[c] ?? 0.8) * (0.94 + this.rng.next() * 0.12);
  }
}
