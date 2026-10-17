// Compiles Song data into per-step lookups: chord per step, lane tokens (base, fill, layers),
// tie-aware durations. Pure functions over the data model; cached per song.
import { degreeOffset, noteToMidi, parseChord, type Chord } from './theory';
import type { LaneName, Lanes, LeadVoice, Section, Song } from './types';

export type LaneSteps = Partial<Record<LaneName, string[]>>;

export interface CompiledSection {
  name: string;
  bars: number;
  voice: LeadVoice | undefined;
  steps: number;
  chords: Chord[];
  base: LaneSteps;
  /** Last-bar fill variants (rotating). */
  fills: LaneSteps[];
  layers: { 1: LaneSteps; 2: LaneSteps };
}

export interface CompiledSong {
  song: Song;
  sections: Map<string, CompiledSection>;
}

/** Bass token: degree, octave marks (, down ' up), articulations (^ pop, > accent, ~ slide). */
export const BASS_TOKEN = /^([#bM]?\d+)([,']*)([\^>~]*)$/;

const ALLOWED: Partial<Record<LaneName, string>> = {
  kick: 'Xxog.-', snare: 'Xxogr.-', clap: 'Xxog.-', hat: 'XxogO.-', perc: 'sStTbB.-', tom: '123.-', cym: 'CRW.-',
  keys: 'Xxs.-', pad: 'Xxs.-', clav: 'Xxsg.-', brass: 'Xxsfr.-',
};

/** Throws on any malformed token so bad song data fails loudly in audio-check, not mid-race. */
function validate(songId: string, lane: LaneName, tokens: string[], chord: Chord): void {
  const allowed = ALLOWED[lane];
  for (const tok of tokens) {
    if (tok === '.' || tok === '-') continue;
    let ok = true;
    if (allowed) ok = allowed.includes(tok);
    else if (lane === 'bass') ok = tok === 'x' || (BASS_TOKEN.test(tok) && degreeOffset(BASS_TOKEN.exec(tok)?.[1] ?? '', chord) !== null);
    else noteToMidi(tok.endsWith('~') ? tok.slice(0, -1) : tok);
    if (!ok) throw new Error(`[audio] song ${songId}: bad ${lane} token "${tok}"`);
  }
}

const CHAR_LANES = new Set<LaneName>(['kick', 'snare', 'clap', 'hat', 'perc', 'tom', 'cym', 'keys', 'clav', 'brass', 'pad']);

function steps(lane: LaneName, text: string): string[] {
  if (CHAR_LANES.has(lane)) return Array.from(text.replace(/[|\s]/g, ''));
  return text.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
}

const LANES: LaneName[] = ['kick', 'snare', 'clap', 'hat', 'perc', 'tom', 'cym', 'bass', 'keys', 'clav', 'brass', 'lead', 'lead2', 'pad'];

function laneSteps(lanes: Lanes | undefined): LaneSteps {
  const out: LaneSteps = {};
  if (!lanes) return out;
  for (const key of LANES) {
    const text = lanes[key];
    if (typeof text === 'string' && text.trim()) out[key] = steps(key, text);
  }
  return out;
}

function chordSteps(text: string | undefined, bars: number, songId: string): Chord[] {
  if (!text) throw new Error(`[audio] song ${songId}: section without chords`);
  const barTexts = text.split('|').map((b) => b.trim()).filter(Boolean);
  const out: Chord[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const symbols = (barTexts[bar % barTexts.length] ?? '').split(/\s+/).filter(Boolean);
    const per = 16 / symbols.length;
    for (let s = 0; s < 16; s++) out.push(parseChord(symbols[Math.min(symbols.length - 1, Math.floor(s / per))] ?? 'C'));
  }
  return out;
}

function compileSection(song: Song, name: string, sec: Section): CompiledSection {
  const chords = chordSteps(sec.chords, sec.bars, song.id);
  const fills = sec.fill === undefined ? [] : Array.isArray(sec.fill) ? sec.fill : [sec.fill];
  for (const lanes of [sec, ...fills, sec.layers?.[1], sec.layers?.[2], song.layers?.[1], song.layers?.[2]]) {
    const parsed = laneSteps(lanes);
    for (const lane of Object.keys(parsed) as LaneName[]) {
      const steps = parsed[lane] ?? [];
      if (steps.length % 16 !== 0) throw new Error(`[audio] song ${song.id} ${name}: ${lane} has ${steps.length} steps (not whole bars)`);
      validate(song.id, lane, steps, chords[0] as Chord);
    }
  }
  return {
    name,
    bars: sec.bars,
    voice: sec.voice,
    steps: sec.bars * 16,
    chords,
    base: laneSteps(sec),
    fills: fills.map(laneSteps),
    layers: {
      1: { ...laneSteps(song.layers?.[1]), ...laneSteps(sec.layers?.[1]) },
      2: { ...laneSteps(song.layers?.[2]), ...laneSteps(sec.layers?.[2]) },
    },
  };
}

const cache = new WeakMap<Song, CompiledSong>();

export function compileSong(song: Song): CompiledSong {
  const hit = cache.get(song);
  if (hit) return hit;
  const sections = new Map<string, CompiledSection>();
  for (const [name, sec] of Object.entries(song.sections)) sections.set(name, compileSection(song, name, sec));
  for (const name of [...song.form, ...(song.stretch ?? []), ...(song.vamp ? [song.vamp] : [])]) {
    if (!sections.has(name)) throw new Error(`[audio] song ${song.id}: form references missing section "${name}"`);
  }
  const compiled = { song, sections };
  cache.set(song, compiled);
  return compiled;
}

/**
 * Token for a lane at a step, honouring the last-bar fill (variant `fill`, null = no fill) and
 * the active adaptive layers.
 */
export function tokenAt(sec: CompiledSection, lane: LaneName, step: number, intensity: number, fill: number | null = 0): string | undefined {
  const fillStart = sec.steps - 16;
  const variant = fill === null || !sec.fills.length ? undefined : sec.fills[fill % sec.fills.length];
  const f = variant?.[lane];
  if (f && step >= fillStart) return f[(step - fillStart) % f.length];
  const src = (intensity >= 2 ? sec.layers[2][lane] : undefined)
    ?? (intensity >= 1 ? sec.layers[1][lane] : undefined)
    ?? sec.base[lane];
  return src ? src[step % src.length] : undefined;
}

/** Length in steps of the note starting at `step` (following '-' ties, never past the section end). */
export function tiedLength(sec: CompiledSection, lane: LaneName, step: number, intensity: number, fill: number | null = 0): number {
  let j = step + 1;
  while (j < sec.steps && tokenAt(sec, lane, j, intensity, fill) === '-') j++;
  return j - step;
}
