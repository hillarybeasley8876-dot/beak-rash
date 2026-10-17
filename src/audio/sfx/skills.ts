// Skill sounds: every cast / hit / end in SPEC §7 (pelican torpedo, gulp, wing, SHOWTIME; rivals'
// signature skills), keyed 'skill.<id>' + optional '.hit' / '.end', plus generic fallbacks.
import { bark, coo, gullCry, honk, meow } from './animals';
import { COMBAT_SFX } from './combat';
import { fm, hiss, ring, span, tone, type S, type SfxFn } from './kit';

const hit = (id: string, s: S): number => COMBAT_SFX[id]?.(s) ?? 0;

const tweets = (s: S, at: number): number => span(...[0, 0.11, 0.2].map((dt) => fm(s, { f: 2400, to: 3100, ratio: 2, index: [0.6, 0.1], at: at + dt, d: 0.07, peak: 0.07 })));

export const SKILL_SFX: Record<string, SfxFn> = {
  'skill.pelican.torpedo': (s) => span(
    tone(s, { f: 220, to: 540, d: 0.07, peak: 0.64 }),
    hiss(s, { kind: 'pink', a: 0.02, d: 0.4, peak: 0.56, filt: { type: 'bandpass', f: 600, to: 2200, q: 1.4 } }),
  ),
  'skill.pelican.torpedo.hit': (s) => span(hit('hit.saltfish', s), tweets(s, 0.12)),
  'skill.pelican.gulp': (s) => span(
    tone(s, { type: 'sawtooth', f: 70, to: 150, a: 0.12, d: 1.0, peak: 0.3, vib: [7, 45], filt: { type: 'lowpass', f: 380, to: 950 } }),
    hiss(s, { kind: 'pink', a: 0.3, d: 0.8, peak: 0.12, filt: { type: 'lowpass', f: 600 } }),
  ),
  'skill.pelican.gulp.hit': (s) => span(
    tone(s, { f: 260, to: 85, d: 0.2, peak: 0.55 }),
    hiss(s, { at: 0.02, d: 0.12, peak: 0.25, filt: { type: 'bandpass', f: 500, q: 3 } }),
  ),
  'skill.pelican.gulp.end': (s) => span(
    hiss(s, { kind: 'pink', a: 0.01, d: 0.3, peak: 0.45, filt: { type: 'bandpass', f: 900, to: 300, q: 1.5 } }),
    tone(s, { f: 520, to: 150, d: 0.16, peak: 0.3 }),
  ),
  'skill.pelican.wing': (s) => span(
    hiss(s, { kind: 'pink', a: 0.1, d: 0.6, peak: 0.45, filt: { type: 'bandpass', f: 300, to: 1600, q: 1.1 } }),
    ...[0, 0.09, 0.18].map((at) => hiss(s, { at, a: 0.005, d: 0.06, peak: 0.3, filt: { type: 'lowpass', f: 800 } })),
  ),
  'skill.pelican.ult': (s) => span(
    hiss(s, { a: 1.0, d: 0.2, peak: 0.4, filt: { type: 'bandpass', f: 400, to: 5000, q: 1 } }),
    tone(s, { type: 'sawtooth', f: 110, to: 440, a: 0.9, d: 0.2, peak: 0.18, filt: { type: 'lowpass', f: 2000 } }),
  ),
  'skill.pelican.ult.impact': (s) => span(
    hit('ko.boom', s),
    hiss(s, { kind: 'pink', a: 0.01, d: 0.9, peak: 0.5, filt: { type: 'bandpass', f: 2200, to: 200, q: 0.9 } }),
  ),
  'skill.goose.honk': (s) => span(honk(s, 0, 1.05), honk(s, 0.3, 1.18), tone(s, { f: 120, d: 0.5, peak: 0.25, vib: [9, 120] })),
  'skill.capybara.chill': (s) => span(
    ...[1047, 1319, 1568, 1976].map((f, i) => fm(s, { f, ratio: 1, index: [1.2, 0.05], at: i * 0.09, d: 1.4, peak: 0.07 })),
    tone(s, { f: 110, a: 0.3, d: 1.8, peak: 0.12 }),
  ),
  'skill.cat.spin': (s) => span(
    meow(s, 0, -0.6), meow(s, 0.38, 0.6),
    ...[0, 0.2, 0.4, 0.6].map((at, i) => hiss(s, { at, a: 0.05, d: 0.12, peak: 0.2, pan: i % 2 ? 0.7 : -0.7, filt: { type: 'bandpass', f: 800, to: 2000, q: 1.5 } })),
  ),
  'skill.shiba.doge': (s) => span(
    tone(s, { f: 330, to: 660, a: 0.05, d: 0.5, peak: 0.3, vib: [6, 25] }),
    fm(s, { f: 1320, ratio: 1.5, index: [2, 0.1], at: 0.1, d: 0.6, peak: 0.08 }),
    bark(s, 0.05, 520),
  ),
  'skill.shiba.doge.hit': (s) => span(
    tone(s, { f: 2600, to: 1800, d: 0.25, peak: 0.18 }),
    hiss(s, { d: 0.05, peak: 0.25, filt: { type: 'highpass', f: 3000 } }),
  ),
  'skill.pigeon.ghost': (s) => span(hiss(s, { kind: 'pink', a: 0.01, d: 0.4, peak: 0.45, filt: { type: 'lowpass', f: 2000, to: 300 } }), coo(s, 0.05)),
  'skill.pigeon.ghost.end': (s) => span(tone(s, { f: 400, to: 1100, d: 0.07, peak: 0.3 }), coo(s, 0.08)),
  'skill.penguin.slide': (s) => span(
    hiss(s, { a: 0.05, d: 1.5, peak: 0.57, filt: { type: 'bandpass', f: 2500, to: 900, q: 2 } }),
    tone(s, { f: 1800, to: 2600, at: 0.04, d: 0.1, peak: 0.152 }),
  ),
  'skill.seagull.steal': (s) => span(
    gullCry(s),
    hiss(s, { at: 0.15, a: 0.02, d: 0.18, peak: 0.3, filt: { type: 'bandpass', f: 1500, to: 3500, q: 1.5 } }),
    ring(s, { f: 2000, partials: [[1, 1, 0.3], [1.3, 0.7, 0.35]], at: 0.38, peak: 0.12 }),
  ),
  'skill.sloth.flash': (s) => span(
    hiss(s, { a: 0.001, d: 0.15, peak: 0.6, filt: { type: 'highpass', f: 1500 } }),
    fm(s, { f: 400, to: 2000, ratio: 3.3, index: [8, 1], d: 0.25, peak: 0.12 }),
    hiss(s, { kind: 'brown', at: 0.05, a: 0.05, d: 1.2, peak: 0.6, filt: { type: 'lowpass', f: 300 } }),
  ),
  'skill.corgi.whistle': (s) => span(...[0, 0.3].map((at) => span(
    tone(s, { f: 2900, at, a: 0.02, d: 0.22, peak: 0.16, vib: [28, 110] }),
    hiss(s, { at, a: 0.02, d: 0.22, peak: 0.08, filt: { type: 'bandpass', f: 3000, q: 2 } }),
  ))),
  'skill.cast': (s) => span(
    hiss(s, { a: 0.04, d: 0.3, peak: 0.75, filt: { type: 'bandpass', f: 500, to: 3000, q: 1.2 } }),
    fm(s, { f: 880, to: 1760, ratio: 2, index: [2, 0.2], d: 0.3, peak: 0.175 }),
  ),
  'skill.hit': (s) => span(tone(s, { f: 180, to: 70, d: 0.15, peak: 0.5 }), hiss(s, { d: 0.06, peak: 0.3, filt: { type: 'bandpass', f: 1400, q: 1 } })),
};
