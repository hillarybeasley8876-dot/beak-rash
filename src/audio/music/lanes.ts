// The pitched lanes of one step — slap bass, the comping chords (keys, clav, brass, pad) and the
// lead lines — played on a band: the song's live band, or a bar render's (SongPlayer.scheduleStep;
// the drum lanes are in groove.ts).
import { BASS_TOKEN, type CompiledSection } from './compile';
import { degreeOffset, noteToMidi, voiceChord, type Chord } from './theory';
import type { Band } from './band';
import type { LaneName, LeadVoice } from './types';

export const CHORD_LANES = ['keys', 'clav', 'brass', 'pad'] as const;
export type ChordLane = (typeof CHORD_LANES)[number];
const CENTER: Record<ChordLane, number> = { keys: 63, clav: 68, brass: 71, pad: 60 };
const LEAD_VEL = 0.9;
const LEAD2_VEL = 0.62; // the harmony / octave line under the hook
const NOTE_LANES: LaneName[] = ['bass', 'keys', 'clav', 'brass', 'pad', 'lead', 'lead2'];

/** What the lanes need from the song player (it refreshes band / base / stepDur / semis every step). */
export interface LaneSource {
  /** The band this step plays on, its clock's origin (audio time) and audio time → that clock (≥ 0). */
  band: Band;
  base: number;
  time(t: number): number;
  stepDur: number;
  /** Transposition (the final-stretch lift). */
  semis: number;
  readonly lead: LeadVoice;
  tok(sec: CompiledSection, lane: LaneName, step: number): string | null;
  len(sec: CompiledSection, lane: LaneName, step: number): number;
  vel(token: string): number;
  random(): number;
  /** Each chord lane's last voicing (voice leading). */
  readonly voicings: Partial<Record<ChordLane, number[]>>;
  /** The last note of each lead voice (audio time): legato continues across bar renders. */
  readonly leads: Map<string, { midi: number; end: number }>;
}

export function bassStep(g: LaneSource, sec: CompiledSection, step: number, t: number, chord: Chord): void {
  const tok = g.tok(sec, 'bass', step);
  if (!tok) return;
  const root = 28 + ((chord.bass - 4 + 12) % 12) + g.semis;
  if (tok === 'x') {
    g.band.bass.dead(g.time(t), root + 12, 0.85);
    return;
  }
  const m = BASS_TOKEN.exec(tok);
  const off = m?.[1] ? degreeOffset(m[1], chord) : null;
  if (!m || off === null) return;
  let midi = root + off;
  for (const ch of m[2] ?? '') midi += ch === ',' ? -12 : 12;
  const art = m[3] ?? '';
  g.band.bass.note(g.time(t), {
    midi, dur: Math.max(0.05, g.len(sec, 'bass', step) * g.stepDur * 0.9), vel: 0.86 + g.random() * 0.12,
    pop: art.includes('^'), accent: art.includes('>'), slide: art.includes('~'),
  });
}

export function chordStep(g: LaneSource, lane: ChordLane, sec: CompiledSection, step: number, t: number, chord: Chord): void {
  const tok = g.tok(sec, lane, step);
  if (!tok) return;
  const b = g.band;
  if (lane === 'clav' && tok === 'g') {
    b.clav.mute(g.time(t), 0.8);
    return;
  }
  const voiced = voiceChord(chord, CENTER[lane], g.voicings[lane] ?? null, lane === 'pad');
  g.voicings[lane] = voiced;
  const notes = g.semis ? voiced.map((n) => n + g.semis) : voiced;
  const len = tok === 's' ? 1 : g.len(sec, lane, step);
  const dur = len * g.stepDur * (tok === 's' ? 0.55 : 0.94);
  const vel = g.vel(tok);
  const at = g.time(t);
  if (lane === 'keys') b.keys.chord(at, notes, dur, vel);
  else if (lane === 'pad') b.pad.chord(at, notes, dur, vel);
  else if (lane === 'clav') b.clav.hit(at, notes.slice(0, 2), dur, vel);
  else b.brass.stab(at, notes, dur, vel, tok === 'f' ? 'fall' : tok === 'r' ? 'rip' : 'hit');
}

/** The lead2 note at this step is the lead's own note an octave down, of the same length. */
function doubled(g: LaneSource, sec: CompiledSection, step: number): boolean {
  const a = g.tok(sec, 'lead', step);
  const b = g.tok(sec, 'lead2', step);
  if (!a || !b) return false;
  const pitch = (x: string): number => noteToMidi(x.endsWith('~') ? x.slice(0, -1) : x);
  return pitch(b) === pitch(a) - 12 && g.len(sec, 'lead2', step) === g.len(sec, 'lead', step);
}

export function leadStep(g: LaneSource, lane: 'lead' | 'lead2', sec: CompiledSection, step: number, t: number): void {
  const tok = g.tok(sec, lane, step);
  if (!tok) return;
  // A lead2 note shadowing the lead an octave down sounds inside the lead voice (one oscillator more).
  const double = doubled(g, sec, step);
  if (lane === 'lead2' && double) return;
  const scoop = tok.endsWith('~');
  const midi = noteToMidi(scoop ? tok.slice(0, -1) : tok) + g.semis;
  const dur = g.len(sec, lane, step) * g.stepDur * 0.9;
  const kind = sec.voice ?? g.lead;
  const key = `${kind}${lane === 'lead' ? 0 : 1}`;
  const prev = g.leads.get(key);
  const voice = g.band.lead(kind, lane === 'lead' ? 0 : 1, prev && { midi: prev.midi, end: prev.end - g.base });
  const vel = lane === 'lead' ? LEAD_VEL : LEAD2_VEL;
  voice.note(g.time(t), midi, dur, vel * (0.9 + g.random() * 0.15), scoop, lane === 'lead' && double ? LEAD2_VEL / LEAD_VEL : 0);
  g.leads.set(key, { midi, end: t + dur });
}

/** Steps from `from` (a bar's first step) to the end of the longest note starting in that bar, ties included (≥ 16). */
export function noteSpan(g: LaneSource, sec: CompiledSection, from: number): number {
  let end = 16;
  for (const lane of NOTE_LANES) {
    for (let s = from; s < Math.min(from + 16, sec.steps); s++) {
      if (g.tok(sec, lane, s)) end = Math.max(end, s - from + g.len(sec, lane, s));
    }
  }
  return end;
}
