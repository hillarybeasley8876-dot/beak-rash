// Combat sounds: swings, a distinct hit per weapon (fish slap, baguette thwack, pan BONG, slipper
// SLAP, keyboard clack…), crit / block layers, KO boom, weapon drop / pick / break, pickups.
import { fm, hiss, ring, span, tone, type SfxFn } from './kit';

const PAN_PARTIALS: Array<[number, number, number]> = [[1, 1, 1.3], [2.32, 0.6, 0.9], [4.25, 0.35, 0.6], [6.63, 0.2, 0.4]];

export const COMBAT_SFX: Record<string, SfxFn> = {
  'swing.light': (s) => hiss(s, { a: 0.03, d: 0.12, peak: 1.024, filt: { type: 'bandpass', f: 500, to: 2300, q: 1.6 } }),
  'swing.heavy': (s) => span(
    hiss(s, { kind: 'pink', a: 0.07, d: 0.2, peak: 0.42, filt: { type: 'bandpass', f: 250, to: 1500, q: 1.2 } }),
    tone(s, { f: 95, to: 60, a: 0.05, d: 0.2, peak: 0.25 }),
  ),
  'hit.none': (s) => span(
    hiss(s, { d: 0.07, peak: 0.45, filt: { type: 'bandpass', f: 1600, q: 0.8 } }),
    tone(s, { f: 150, to: 80, d: 0.09, peak: 0.45 }),
  ),
  'hit.saltfish': (s) => span(
    hiss(s, { a: 0.001, d: 0.06, peak: 0.6, filt: { type: 'lowpass', f: 3500 } }),
    tone(s, { f: 380, to: 120, d: 0.13, peak: 0.35 }),
    hiss(s, { at: 0.01, d: 0.1, peak: 0.3, filt: { type: 'bandpass', f: 900, to: 500, q: 3 } }),
  ),
  'hit.baguette': (s) => span(
    tone(s, { type: 'triangle', f: 235, to: 150, d: 0.08, peak: 0.5 }),
    hiss(s, { d: 0.1, peak: 0.4, filt: { type: 'bandpass', f: 1100, q: 1.5 } }),
    hiss(s, { kind: 'crackle', d: 0.12, peak: 1.2, filt: { type: 'highpass', f: 2500 } }),
  ),
  'hit.pan': (s) => span(
    ring(s, { f: 410, partials: PAN_PARTIALS, peak: 0.22 }),
    tone(s, { f: 410, d: 1.2, peak: 0.12, vib: [6, 35] }),
    hiss(s, { d: 0.03, peak: 0.45, filt: { type: 'lowpass', f: 2200 } }),
  ),
  'hit.leek': (s) => span(
    hiss(s, { d: 0.03, peak: 0.45, filt: { type: 'highpass', f: 3000 } }),
    hiss(s, { at: 0.005, d: 0.08, peak: 0.3, filt: { type: 'bandpass', f: 1500, q: 2 } }),
    tone(s, { f: 210, to: 120, d: 0.07, peak: 0.35 }),
  ),
  'hit.umbrella': (s) => span(
    hiss(s, { kind: 'pink', a: 0.01, d: 0.12, peak: 1.6, filt: { type: 'lowpass', f: 900 } }),
    ...[0.01, 0.03, 0.05, 0.075].map((at) => tone(s, { type: 'square', f: 2500, at, a: 0.001, d: 0.008, peak: 0.16 })),
  ),
  'hit.selfie': (s) => span(
    tone(s, { type: 'triangle', f: 2600, d: 0.05, peak: 0.2 }),
    tone(s, { f: 300, to: 160, d: 0.06, peak: 0.3 }),
    ...[0.07, 0.12].map((at) => hiss(s, { at, a: 0.0008, d: 0.015, peak: 0.4, filt: { type: 'bandpass', f: 4000, q: 2 } })),
  ),
  'hit.slipper': (s) => span(
    hiss(s, { a: 0.0005, d: 0.045, peak: 0.95, filt: { type: 'bandpass', f: 1100, q: 1.2 } }),
    hiss(s, { a: 0.0005, d: 0.02, peak: 0.5, filt: { type: 'highpass', f: 2500 } }),
    tone(s, { f: 170, to: 90, d: 0.06, peak: 0.3 }),
  ),
  'hit.keyboard': (s) => span(...[0, 0.035, 0.07, 0.1].map((at) => span(
    tone(s, { type: 'square', f: 3800, at, a: 0.0008, d: 0.012, peak: 0.12, filt: { type: 'bandpass', f: 4000, q: 1.5 } }),
    tone(s, { f: 700, to: 420, at, d: 0.03, peak: 0.3 }),
  ))),
  'hit.crit': (s) => span(
    tone(s, { f: 2500, d: 0.4, peak: 0.12 }),
    tone(s, { f: 3750, at: 0.01, d: 0.3, peak: 0.08 }),
    tone(s, { f: 95, to: 40, d: 0.32, peak: 0.55 }),
    hiss(s, { a: 0.02, d: 0.25, peak: 0.15, filt: { type: 'highpass', f: 5000, to: 9000 } }),
  ),
  'hit.block': (s) => span(
    ring(s, { f: 1800, partials: [[1, 1, 0.16], [2.7, 0.5, 0.1], [4.4, 0.25, 0.06]], peak: 0.2 }),
    tone(s, { f: 200, to: 120, d: 0.06, peak: 0.3 }),
  ),
  'ko.boom': (s) => span(
    tone(s, { f: 72, to: 28, d: 1.1, peak: 1.6 }),
    hiss(s, { kind: 'brown', a: 0.005, d: 0.8, peak: 0.7, filt: { type: 'lowpass', f: 700 } }),
    hiss(s, { d: 0.25, peak: 0.25, filt: { type: 'highpass', f: 3000 } }),
    ring(s, { f: 180, partials: [[1, 1, 0.6], [2.6, 0.4, 0.4]], peak: 0.12 }),
  ),
  'weapon.drop': (s) => span(...[0, 0.12, 0.21].map((at, i) => ring(s, {
    f: 900 - i * 60, partials: [[1, 1, 0.12], [2.5, 0.5, 0.08]], at, peak: 0.16 - i * 0.04,
  }))),
  'weapon.pick': (s) => span(
    hiss(s, { d: 0.04, peak: 0.9, filt: { type: 'bandpass', f: 2000, q: 1.5 } }),
    tone(s, { type: 'square', f: 1200, to: 1500, at: 0.03, d: 0.08, peak: 0.18, filt: { type: 'lowpass', f: 5000 } }),
  ),
  'weapon.break': (s) => span(
    hiss(s, { kind: 'crackle', d: 0.25, peak: 1.4, filt: { type: 'bandpass', f: 1500, q: 0.8 } }),
    tone(s, { f: 400, to: 100, d: 0.15, peak: 0.3 }),
  ),
  'pickup.coin': (s) => span(
    fm(s, { f: 1976, ratio: 2, index: [0.8, 0.1], d: 0.08, peak: 0.25 }),
    fm(s, { f: 2637, ratio: 2, index: [0.8, 0.1], at: 0.06, d: 0.25, peak: 0.25 }),
  ),
  'pickup.fish': (s) => span(
    tone(s, { f: 300, to: 120, d: 0.1, peak: 0.35 }),
    ...[1047, 1319, 1568].map((f, i) => fm(s, { f, ratio: 3, index: [1, 0.1], at: 0.08 + i * 0.05, d: 0.25, peak: 0.08 })),
  ),
  'pickup.crate': (s) => span(
    hiss(s, { d: 0.12, peak: 0.45, filt: { type: 'bandpass', f: 900, q: 1.2 } }),
    tone(s, { type: 'triangle', f: 180, to: 115, d: 0.1, peak: 0.45 }),
    hiss(s, { kind: 'crackle', d: 0.15, peak: 1, filt: { type: 'bandpass', f: 2000, q: 1 } }),
  ),
  'pickup.can': (s) => span(
    hiss(s, { a: 0.01, d: 0.25, peak: 0.3, filt: { type: 'highpass', f: 3000, to: 6000 } }),
    fm(s, { f: 1760, ratio: 2.5, index: [1.5, 0.1], at: 0.15, d: 0.35, peak: 0.08 }),
  ),
};
