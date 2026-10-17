// World sounds: traffic horns and pass-bys, police whistle / siren blip / BUSTED, obstacle
// impacts by kind, and the KO slow-motion whooshes.
import { hiss, ring, span, tone, type S, type SfxFn } from './kit';

/** Car-style horn: detuned square/saw pair a major third apart, slightly wobbly. */
function horn(s: S, f1: number, f2: number, dur: number, type: OscillatorType, cutoff: number): number {
  return span(...[f1, f2].map((f) => tone(s, {
    type, f, to: f * 0.985, a: 0.015, d: dur, peak: 0.26, vib: [5.5, 8], filt: { type: 'lowpass', f: cutoff },
  })));
}

export const WORLD_SFX: Record<string, SfxFn> = {
  'traffic.horn.car': (s) => horn(s, 415, 523, 0.35, 'square', 2200),
  'traffic.horn.van': (s) => horn(s, 330, 415, 0.4, 'square', 1900),
  'traffic.horn.truck': (s) => span(horn(s, 165, 208, 0.65, 'sawtooth', 1500), tone(s, { type: 'sawtooth', f: 247, to: 236, a: 0.02, d: 0.65, peak: 0.2, filt: { type: 'lowpass', f: 1500 } })),
  'traffic.horn.bus': (s) => horn(s, 233, 294, 0.5, 'sawtooth', 1600),
  'traffic.horn.police': (s) => span(...[0, 0.18].map((at) => tone(s, { type: 'square', f: 880, to: 660, at, a: 0.01, d: 0.15, peak: 0.2, filt: { type: 'lowpass', f: 2500 } }))),
  'traffic.whoosh': (s) => span(
    hiss(s, { kind: 'pink', a: 0.15, d: 0.35, peak: 0.35, filt: { type: 'bandpass', f: 1300, to: 350, q: 1.1 } }),
    tone(s, { type: 'sawtooth', f: 98, to: 68, a: 0.12, d: 0.45, peak: 0.12, filt: { type: 'lowpass', f: 500 } }),
  ),
  'police.whistle': (s) => span(...[0, 0.28].map((at, i) => span(
    tone(s, { f: 2950, at, a: 0.015, d: i ? 0.4 : 0.18, peak: 0.16, vib: [30, 120] }),
    hiss(s, { at, a: 0.015, d: i ? 0.4 : 0.18, peak: 0.08, filt: { type: 'bandpass', f: 3000, q: 2 } }),
  ))),
  'police.busted': (s) => span(
    tone(s, { type: 'square', f: 960, d: 0.25, peak: 0.08, filt: { type: 'lowpass', f: 2500 } }),
    tone(s, { type: 'square', f: 770, at: 0.27, d: 0.25, peak: 0.08, filt: { type: 'lowpass', f: 2500 } }),
    hiss(s, { at: 0.5, d: 0.08, peak: 0.4, filt: { type: 'lowpass', f: 1500 } }),
  ),
  'police.lost': (s) => span(
    tone(s, { type: 'square', f: 770, to: 520, a: 0.01, d: 0.45, peak: 0.08, filt: { type: 'lowpass', f: 2000 } }),
    tone(s, { type: 'square', f: 960, to: 640, at: 0.02, a: 0.01, d: 0.4, peak: 0.06, filt: { type: 'lowpass', f: 2000 } }),
  ),
  'obstacle.cone': (s) => span(
    tone(s, { f: 520, to: 300, d: 0.12, peak: 0.35 }),
    hiss(s, { d: 0.05, peak: 0.25, filt: { type: 'bandpass', f: 1400, q: 1.5 } }),
  ),
  'obstacle.crate': (s) => span(
    hiss(s, { kind: 'crackle', d: 0.3, peak: 1.4, filt: { type: 'bandpass', f: 1200, q: 0.8 } }),
    tone(s, { type: 'triangle', f: 160, to: 90, d: 0.15, peak: 0.5 }),
  ),
  'obstacle.barrel': (s) => span(
    ring(s, { f: 260, partials: [[1, 1, 0.7], [2.1, 0.6, 0.5], [3.7, 0.3, 0.3], [5.2, 0.15, 0.2]], peak: 0.2 }),
    tone(s, { f: 120, to: 60, d: 0.15, peak: 0.45 }),
  ),
  'obstacle.car': (s) => span(
    tone(s, { f: 90, to: 40, d: 0.35, peak: 0.8 }),
    ring(s, { f: 520, partials: [[1, 1, 0.3], [1.9, 0.7, 0.25], [3.3, 0.4, 0.2]], peak: 0.16 }),
    hiss(s, { kind: 'crackle', at: 0.02, d: 0.4, peak: 1.2, filt: { type: 'highpass', f: 2500 } }),
    hiss(s, { d: 0.2, peak: 0.4, filt: { type: 'lowpass', f: 1200 } }),
  ),
  'obstacle.hit': (s) => span(tone(s, { f: 140, to: 70, d: 0.12, peak: 0.5 }), hiss(s, { d: 0.06, peak: 0.25, filt: { type: 'bandpass', f: 1000, q: 1 } })),
  // KO cinematic start: the crack and air only — the KO boom (combat:ko) owns the sub.
  'cine.impact': (s) => span(
    hiss(s, { a: 0.003, d: 0.3, peak: 0.42, filt: { type: 'highpass', f: 2000, to: 8000 } }),
    hiss(s, { kind: 'pink', a: 0.002, d: 0.12, peak: 0.5, filt: { type: 'bandpass', f: 900, q: 0.8 } }),
  ),
  /** A projectile that missed everything: a dull thud where it landed. */
  'projectile.miss': (s) => span(
    tone(s, { f: 190, to: 95, d: 0.09, peak: 0.32 }),
    hiss(s, { kind: 'pink', d: 0.1, peak: 0.35, filt: { type: 'bandpass', f: 700, q: 1 } }),
  ),
  'cine.whoosh': (s) => span(
    hiss(s, { kind: 'pink', a: 0.25, d: 0.2, peak: 0.4, filt: { type: 'bandpass', f: 200, to: 3200, q: 1 } }),
    tone(s, { type: 'sawtooth', f: 60, to: 240, a: 0.3, d: 0.15, peak: 0.12, filt: { type: 'lowpass', f: 1200 } }),
  ),
};
