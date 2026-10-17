// UI sounds (menus, cut-ins, coins) and the bicycle's one-shots (bell, hops, landings, boosts,
// drift sparks, bumps, scrapes, splashes, crashes).
import { fm, hiss, ring, span, tone, type SfxFn } from './kit';

const BELL: Array<[number, number, number]> = [[1, 1, 0.9], [1.52, 0.5, 0.6], [2.73, 0.32, 0.4], [3.91, 0.18, 0.25]];

export const UI_SFX: Record<string, SfxFn> = {
  'ui.move': (s) => span(
    tone(s, { type: 'square', f: 1450, to: 1250, d: 0.03, peak: 0.224, filt: { type: 'lowpass', f: 4500 } }),
    hiss(s, { d: 0.015, peak: 0.16, filt: { type: 'bandpass', f: 5000, q: 2 } }),
  ),
  'ui.confirm': (s) => span(
    tone(s, { type: 'triangle', f: 880, d: 0.07, peak: 0.256 }),
    tone(s, { type: 'square', f: 1320, at: 0.05, d: 0.14, peak: 0.128, filt: { type: 'lowpass', f: 5000 } }),
    hiss(s, { at: 0.04, a: 0.01, d: 0.14, peak: 0.112, filt: { type: 'highpass', f: 5000, to: 9000 } }),
  ),
  'ui.back': (s) => span(
    tone(s, { type: 'square', f: 990, d: 0.05, peak: 0.168, filt: { type: 'lowpass', f: 3500 } }),
    tone(s, { type: 'square', f: 660, at: 0.055, d: 0.08, peak: 0.168, filt: { type: 'lowpass', f: 3000 } }),
  ),
  'ui.cutin': (s) => span(
    hiss(s, { a: 0.02, d: 0.2, peak: 0.32, filt: { type: 'bandpass', f: 700, to: 6500, q: 1.2 } }),
    tone(s, { f: 150, to: 55, at: 0.12, d: 0.22, peak: 0.45 }),
    fm(s, { f: 2200, ratio: 3.5, index: [3, 0.2], at: 0.12, d: 0.25, peak: 0.06 }),
  ),
  'ui.slash': (s) => hiss(s, { kind: 'pink', a: 0.03, d: 0.17, peak: 1.625, filt: { type: 'bandpass', f: 400, to: 5000, q: 1 } }),
  'ui.coin': (s) => span(
    tone(s, { type: 'square', f: 988, d: 0.06, peak: 0.175, filt: { type: 'lowpass', f: 6000 } }),
    tone(s, { type: 'square', f: 1319, at: 0.06, d: 0.28, peak: 0.175, filt: { type: 'lowpass', f: 6000 } }),
  ),
  'ui.count': (s) => tone(s, { type: 'square', f: 2200, d: 0.015, peak: 0.136, filt: { type: 'lowpass', f: 6000 } }),
  'ui.deny': (s) => span(
    tone(s, { type: 'square', f: 220, to: 180, d: 0.1, peak: 0.12, filt: { type: 'lowpass', f: 1200 } }),
    tone(s, { type: 'square', f: 200, to: 160, at: 0.11, d: 0.12, peak: 0.12, filt: { type: 'lowpass', f: 1100 } }),
  ),
  'ui.pause': (s) => tone(s, { type: 'sawtooth', f: 600, to: 110, d: 0.28, peak: 0.336, filt: { type: 'lowpass', f: 1800 } }),
  'ui.stamp': (s) => span(
    tone(s, { f: 130, to: 48, d: 0.24, peak: 0.6 }),
    hiss(s, { d: 0.08, peak: 0.35, filt: { type: 'lowpass', f: 1600 } }),
    hiss(s, { at: 0.005, d: 0.05, peak: 0.2, filt: { type: 'bandpass', f: 3000, q: 1.5 } }),
  ),
  'ui.incoming': (s) => span(...[0, 0.11].map((at, i) => tone(s, {
    type: 'square', f: i ? 1568 : 1976, at, a: 0.004, d: 0.08, peak: 0.12, filt: { type: 'lowpass', f: 5000 },
  }))),
  'ui.unlock': (s) => span(...[1047, 1319, 1568, 2093].map((f, i) => fm(s, { f, ratio: 4, index: [1.2, 0.1], at: i * 0.07, d: 0.4, peak: 0.12 }))),
};

export const BIKE_SFX: Record<string, SfxFn> = {
  'bike.bell': (s) => span(...[0, 0.13, 0.26].map((at, i) => ring(s, { f: 2950 * (i === 2 ? 1.01 : 1), partials: BELL, at, peak: 0.16 }))),
  'bike.hop': (s) => span(
    hiss(s, { kind: 'pink', a: 0.02, d: 0.1, peak: 1.125, filt: { type: 'bandpass', f: 600, to: 2400, q: 1.4 } }),
    ...[0.01, 0.03, 0.05].map((at) => tone(s, { type: 'square', f: 3100, at, a: 0.001, d: 0.01, peak: 0.135 })),
  ),
  'bike.land': (s) => span(
    tone(s, { f: 115, to: 52, d: 0.17, peak: 0.55 }),
    hiss(s, { d: 0.08, peak: 0.25, filt: { type: 'lowpass', f: 900 } }),
    ...[0.02, 0.05, 0.09].map((at) => tone(s, { type: 'square', f: 2700, at, a: 0.001, d: 0.012, peak: 0.035 })),
  ),
  'bike.land.hard': (s) => span(
    tone(s, { f: 100, to: 40, d: 0.28, peak: 0.75 }),
    hiss(s, { kind: 'brown', d: 0.18, peak: 0.5, filt: { type: 'lowpass', f: 700 } }),
    ring(s, { f: 640, partials: [[1, 1, 0.18], [2.76, 0.5, 0.12], [5.4, 0.25, 0.08]], at: 0.01, peak: 0.12 }),
  ),
  'bike.perfect': (s) => span(
    ...[1568, 2093, 2637, 3136].map((f, i) => fm(s, { f, ratio: 3, index: [1.5, 0.1], at: i * 0.055, d: 0.35, peak: 0.13 })),
    hiss(s, { a: 0.05, d: 0.25, peak: 0.156, filt: { type: 'highpass', f: 4000, to: 9000 } }),
  ),
  'bike.boost': (s) => span(
    hiss(s, { a: 0.06, d: 0.55, peak: 0.4, filt: { type: 'bandpass', f: 350, to: 3200, q: 1.1 } }),
    tone(s, { type: 'sawtooth', f: 85, to: 190, a: 0.05, d: 0.45, peak: 0.25, filt: { type: 'lowpass', f: 900 } }),
  ),
  'bike.miniturbo': (s) => span(
    fm(s, { f: 700, to: 2300, ratio: 2, index: [3, 0.4], d: 0.16, peak: 0.3 }),
    hiss(s, { a: 0.02, d: 0.35, peak: 0.875, filt: { type: 'bandpass', f: 500, to: 2600, q: 1.2 } }),
  ),
  'bike.drift.start': (s) => hiss(s, { a: 0.02, d: 0.28, peak: 0.748, filt: { type: 'bandpass', f: 1700, to: 2400, q: 4 } }),
  'bike.drift.level': (s) => span(
    tone(s, { type: 'triangle', f: 1320, d: 0.2, peak: 0.336 }),
    tone(s, { type: 'triangle', f: 1980, at: 0.04, d: 0.16, peak: 0.168 }),
    hiss(s, { kind: 'crackle', d: 0.15, peak: 1.68, filt: { type: 'highpass', f: 3000 } }),
  ),
  'bike.bump': (s) => span(
    tone(s, { f: 160, to: 85, d: 0.1, peak: 0.45 }),
    hiss(s, { d: 0.05, peak: 0.25, filt: { type: 'bandpass', f: 1200, q: 1.2 } }),
  ),
  /** Bouncing off a wall / guard rail: a thump, a metal ring and a short scrape. */
  'bike.wall': (s) => span(
    tone(s, { f: 150, to: 75, d: 0.12, peak: 0.5 }),
    ring(s, { f: 610, partials: [[1, 1, 0.35], [2.32, 0.6, 0.25], [3.9, 0.35, 0.18]], at: 0.004, peak: 0.13 }),
    hiss(s, { at: 0.02, a: 0.01, d: 0.18, peak: 0.5, filt: { type: 'bandpass', f: 2600, to: 2000, q: 4 } }),
  ),
  'bike.scrape': (s) => span(
    hiss(s, { a: 0.02, d: 0.35, peak: 0.84, filt: { type: 'bandpass', f: 2800, to: 2200, q: 5 } }),
    tone(s, { type: 'sawtooth', f: 1900, to: 1700, a: 0.03, d: 0.3, peak: 0.112, vib: [23, 60], filt: { type: 'lowpass', f: 3500 } }),
  ),
  'bike.splash': (s) => span(
    hiss(s, { a: 0.005, d: 0.5, peak: 0.5, filt: { type: 'lowpass', f: 3200, to: 500 } }),
    ...[0.03, 0.07, 0.12, 0.18, 0.26].map((at, i) => tone(s, { f: 380 + i * 90, to: 1150 + i * 120, at, a: 0.002, d: 0.04, peak: 0.12 })),
  ),
  'bike.crash': (s) => span(
    ...[0, 0.18, 0.37, 0.6].map((at, i) => tone(s, { f: 135 - i * 12, to: 55, at, d: 0.13, peak: 0.6 - i * 0.1 })),
    ring(s, { f: 740, partials: [[1, 1, 0.2], [2.4, 0.6, 0.15], [4.1, 0.3, 0.1]], at: 0.05, peak: 0.12 }),
    ring(s, { f: 980, partials: [[1, 1, 0.15], [2.9, 0.5, 0.1]], at: 0.31, peak: 0.1 }),
    hiss(s, { at: 0.1, a: 0.04, d: 0.6, peak: 0.25, filt: { type: 'bandpass', f: 1500, to: 900, q: 1.5 } }),
  ),
  'bike.respawn': (s) => span(
    tone(s, { f: 300, to: 900, d: 0.08, peak: 0.45 }),
    fm(s, { f: 1760, ratio: 2, index: [1, 0.1], at: 0.06, d: 0.3, peak: 0.144 }),
  ),
  'bike.nearmiss': (s) => hiss(s, { kind: 'pink', a: 0.12, d: 0.25, peak: 1.12, filt: { type: 'bandpass', f: 600, to: 2200, q: 1.3 } }),
  'bike.passby': (s) => hiss(s, { kind: 'pink', a: 0.1, d: 0.22, peak: 0.7, filt: { type: 'bandpass', f: 1600, to: 500, q: 1.2 } }),
  'bike.slingshot': (s) => span(
    hiss(s, { a: 0.15, d: 0.3, peak: 0.35, filt: { type: 'bandpass', f: 300, to: 2600, q: 1.2 } }),
    tone(s, { type: 'square', f: 200, to: 620, a: 0.1, d: 0.3, peak: 0.05, filt: { type: 'lowpass', f: 2000 } }),
  ),
  'bike.pad': (s) => span(
    fm(s, { f: 600, to: 1800, ratio: 3, index: [2, 0.3], d: 0.25, peak: 0.3 }),
    hiss(s, { a: 0.02, d: 0.3, peak: 0.625, filt: { type: 'bandpass', f: 800, to: 3000, q: 1.5 } }),
  ),
};
