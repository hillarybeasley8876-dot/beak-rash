// SongPlayer: lookahead scheduler for one song. Walks the form bar by bar (loops seamlessly from
// `loopFrom`), applies swing + light humanisation, voice-leads chord instruments, rotates fills,
// follows the adaptive intensity (layers; the final stretch = a one-bar build, then the stretch
// form with a tempo / key lift), can hold a vamp and re-phase onto a downbeat (race start), and
// fades out on stop. Steps that fall behind the audio clock (main-thread stall) are skipped.
import { Rng } from '../../core/rng';
import { noise } from '../dsp/noise';
import { Band } from './band';
import { buildStep, drumStep, type GrooveSource } from './groove';
import { BASS_TOKEN, compileSong, tiedLength, tokenAt, type CompiledSection, type CompiledSong } from './compile';
import { degreeOffset, noteToMidi, parseKey, voiceChord, type Chord, type Tonality } from './theory';
import type { Engine } from '../engine';
import type { Channel, LaneName, Song } from './types';

const VEL: Record<string, number> = { X: 1, x: 0.8, o: 0.55, g: 0.3, S: 1, s: 0.7, T: 1, t: 0.7, B: 1, b: 0.75, r: 0.7, f: 0.9 };
const CHORD_LANES = ['keys', 'clav', 'brass', 'pad'] as const;
type ChordLane = (typeof CHORD_LANES)[number];
const CENTER: Record<ChordLane, number> = { keys: 63, clav: 68, brass: 71, pad: 60 };
const LATE = 0.03;   // s: a step this far behind the clock is skipped, not played late
const LEAD_VEL = 0.9;
const LEAD2_VEL = 0.62; // the harmony / octave line under the hook
const BUILD = 'build';

export interface PlayerOpts {
  section?: number;
  intensity?: number;
  fadeIn?: number;
  /** Start in the song's vamp (race intro); cue() re-phases out of it. */
  vamp?: boolean;
  /** Channel gain multipliers on top of the song's mix (analysis: solo / mute stems). */
  mix?: Partial<Record<Channel, number>>;
}

function mixOf(song: Song, extra: Partial<Record<Channel, number>> | undefined): Partial<Record<Channel, number>> {
  if (!extra) return song.mix ?? {};
  const out: Partial<Record<Channel, number>> = { ...song.mix };
  for (const ch of Object.keys(extra) as Channel[]) out[ch] = (out[ch] ?? 1) * (extra[ch] ?? 1);
  return out;
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
  private passes = new Map<string, number>();
  private voicings: Partial<Record<ChordLane, number[]>> = {};
  private rng: Rng;
  private stopAt = Infinity;
  private crackle: AudioBufferSourceNode | null = null;
  private readonly home: Tonality;
  /** Recent section starts (audio time): tests check that section A lands on the race GO. */
  readonly starts: Array<{ section: string; at: number }> = [];

  constructor(readonly engine: Engine, song: Song, start: number, opts: PlayerOpts = {}) {
    this.song = song;
    this.compiled = compileSong(song);
    this.home = parseKey(song.key);
    this.rng = new Rng(song.bpm * 7919 + song.id.length);
    this.band = new Band(engine, song.bpm, mixOf(song, opts.mix), engine.musicIn, this.rng.fork(0xba4d));
    this.band.fade(1, opts.fadeIn ?? 0.02, start);
    this.stepDur = 60 / song.bpm / 4;
    this.nextTime = start;
    this.form = song.form;
    this.loopFrom = song.loopFrom;
    this.formIndex = Math.min(opts.section ?? 0, this.form.length - 1);
    this.intensity = opts.intensity ?? 0;
    if (opts.vamp) this.holdName = song.vamp ?? this.form[0] ?? null;
    if (song.crackle) {
      const src = noise(engine.ctx, 'crackle', start, null, this.rng);
      src.connect(new GainNode(engine.ctx, { gain: song.crackle })).connect(this.band.input('fx'));
      this.crackle = src;
    }
  }

  get stopped(): boolean {
    return this.engine.ctx.currentTime > this.stopAt;
  }

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
   * Steps until then are skipped; a vamp hold ends.
   */
  cue(section: string, at: number): void {
    this.cutDrums(this.nextTime);
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
    this.band.fade(0, fade, at);
    this.stopAt = at + fade + 0.05;
    this.crackle?.stop(this.stopAt + 0.05);
    this.band.dispose(this.stopAt + 2.5);
  }

  /** Schedule every step that starts before `until` (seconds, audio clock). */
  schedule(until: number): void {
    const now = this.engine.ctx.currentTime;
    this.band.tick(now);
    // After a stall, resync to the clock instead of firing a burst of past notes.
    for (let guard = 0; this.nextTime < now - LATE && guard < 100000; guard++) this.advance();
    while (this.nextTime < until && this.nextTime < this.stopAt) {
      this.scheduleStep();
      this.advance();
    }
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
    this.stepDur = 60 / (this.song.bpm * lift.tempo) / 4;
    this.semis = lift.semis;
    this.band.setTempo(this.song.bpm * lift.tempo, this.nextTime);
    this.band.fade(this.levelGain(stretch), 0.25, this.nextTime);
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
    if (step === 0) {
      this.starts.push({ section: sec.name, at: this.nextTime });
      if (this.starts.length > 12) this.starts.shift();
      this.band.section(this.nextTime, this.stepDur * 16, sec.gainDb, sec.shape);
    }
    if (this.nextTime >= this.drumsUntil - 1e-6) this.drumBar(sec, step);
    this.bass(sec, step, human(0.003), chord);
    for (const lane of CHORD_LANES) this.chordLane(lane, sec, step, human(0.006), chord);
    this.leadLane('lead', sec, step, human(0.004), LEAD_VEL);
    this.leadLane('lead2', sec, step, human(0.004), LEAD2_VEL);
  }

  /** The drums from step `from` to the end of its bar, pre-mixed into one buffer (drum-mix.ts). */
  private drumBar(sec: CompiledSection, from: number): void {
    const d = this.band.drums;
    const start = this.nextTime;
    const end = Math.min(sec.steps, (Math.floor(from / 16) + 1) * 16);
    const g: GrooveSource = {
      kit: d, stepDur: this.stepDur, building: this.building,
      tok: (x, lane, step) => this.tok(x, lane, step), vel: (c) => this.vel(c), random: () => this.rng.next(),
    };
    d.record(start);
    if (this.crashNext) {
      this.crashNext = false;
      if (this.tok(sec, 'cym', from) !== 'C') d.crash(start, 0.9);
    }
    for (let s = from; s < end; s++) {
      const t = start + (s - from) * this.stepDur + (s % 2 === 1 ? this.song.swing * this.stepDur : 0);
      if (this.building) buildStep(g, s % 16, t);
      drumStep(g, sec, s, t);
    }
    d.flush();
    this.drumsUntil = start + (end - from) * this.stepDur;
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

  private bass(sec: CompiledSection, step: number, t: number, chord: Chord): void {
    const tok = this.tok(sec, 'bass', step);
    if (!tok) return;
    const root = 28 + ((chord.bass - 4 + 12) % 12) + this.semis;
    if (tok === 'x') {
      this.band.bass.dead(t, root + 12, 0.85);
      return;
    }
    const m = BASS_TOKEN.exec(tok);
    const off = m?.[1] ? degreeOffset(m[1], chord) : null;
    if (!m || off === null) return;
    let midi = root + off;
    for (const ch of m[2] ?? '') midi += ch === ',' ? -12 : 12;
    const art = m[3] ?? '';
    this.band.bass.note(t, {
      midi, dur: Math.max(0.05, this.len(sec, 'bass', step) * this.stepDur * 0.9), vel: 0.86 + this.rng.next() * 0.12,
      pop: art.includes('^'), accent: art.includes('>'), slide: art.includes('~'),
    });
  }

  private chordLane(lane: ChordLane, sec: CompiledSection, step: number, t: number, chord: Chord): void {
    const tok = this.tok(sec, lane, step);
    if (!tok) return;
    if (lane === 'clav' && tok === 'g') {
      this.band.clav.mute(t, 0.8);
      return;
    }
    const voiced = voiceChord(chord, CENTER[lane], this.voicings[lane] ?? null, lane === 'pad');
    this.voicings[lane] = voiced;
    const notes = this.semis ? voiced.map((n) => n + this.semis) : voiced;
    const len = tok === 's' ? 1 : this.len(sec, lane, step);
    const dur = len * this.stepDur * (tok === 's' ? 0.55 : 0.94);
    const vel = this.vel(tok);
    if (lane === 'keys') this.band.keys.chord(t, notes, dur, vel);
    else if (lane === 'pad') this.band.pad.chord(t, notes, dur, vel);
    else if (lane === 'clav') this.band.clav.hit(t, notes.slice(0, 2), dur, vel);
    else this.band.brass.stab(t, notes, dur, vel, tok === 'f' ? 'fall' : tok === 'r' ? 'rip' : 'hit');
  }

  private leadLane(lane: 'lead' | 'lead2', sec: CompiledSection, step: number, t: number, vel: number): void {
    const tok = this.tok(sec, lane, step);
    if (!tok) return;
    // A lead2 note shadowing the lead an octave down sounds inside the lead voice (one oscillator more).
    const doubled = this.doubled(sec, step);
    if (lane === 'lead2' && doubled) return;
    const scoop = tok.endsWith('~');
    const midi = noteToMidi(scoop ? tok.slice(0, -1) : tok) + this.semis;
    const dur = this.len(sec, lane, step) * this.stepDur * 0.9;
    const voice = this.band.lead(sec.voice ?? this.song.lead, lane === 'lead' ? 0 : 1);
    voice.note(t, midi, dur, vel * (0.9 + this.rng.next() * 0.15), scoop, lane === 'lead' && doubled ? LEAD2_VEL / LEAD_VEL : 0);
  }

  /** The lead2 note at this step is the lead's own note an octave down, of the same length. */
  private doubled(sec: CompiledSection, step: number): boolean {
    const a = this.tok(sec, 'lead', step);
    const b = this.tok(sec, 'lead2', step);
    if (!a || !b) return false;
    const pitch = (x: string): number => noteToMidi(x.endsWith('~') ? x.slice(0, -1) : x);
    return pitch(b) === pitch(a) - 12 && this.len(sec, 'lead2', step) === this.len(sec, 'lead', step);
  }
}
