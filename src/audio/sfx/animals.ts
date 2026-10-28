// Animal calls (formant synthesis, all original): pelican bill clatter, goose honk, capybara
// squeak, cat meow, shiba "wan", pigeon coo, penguin bray, gull cry, sloth yawn, corgi yip, and
// the r6 meme roster's six (banana cat, crying cat, stray cat, pygmy hippo, raccoon, hamster).
// Used for taunts / KOs / skill barks when no TTS line exists, and inside skill sounds.
import { pulseWave } from '../dsp/curves';
import { call, hiss, span, tone, type S, type SfxFn } from './kit';

type V = [number, number, number];
const A_: V = [780, 1250, 2600];
const O_: V = [500, 900, 2400];
const I_: V = [320, 2300, 3000];
const E_: V = [550, 1800, 2600];
const U_: V = [350, 800, 2300];

/** One goose honk; `lift` raises the pitch (angry second honk). */
export function honk(s: S, at = 0, lift = 1): number {
  return call(s, {
    at, wave: pulseWave(s.ctx, 0.18), f: [360 * lift, 520 * lift, 470 * lift, 430 * lift], times: [0, 0.07, 0.22, 0.3],
    vowels: [[600, 1050, 2400], [760, 1300, 2650], [700, 1200, 2550], [620, 1100, 2450]], peak: 0.42, q: 5, breath: 0.25,
  });
}

export function meow(s: S, at = 0, pan = 0): number {
  return call(s, { at, pan, f: [620, 780, 760, 520], times: [0, 0.1, 0.3, 0.5], vowels: [I_, A_, A_, O_], peak: 0.13, q: 7 });
}

export function gullCry(s: S, at = 0): number {
  return span(
    call(s, { at, wave: pulseWave(s.ctx, 0.25), f: [1300, 1650, 900], times: [0, 0.06, 0.28], vowels: [E_, [650, 1600, 2800], O_], peak: 0.3, q: 8, breath: 0.2 }),
    call(s, { at: at + 0.32, wave: pulseWave(s.ctx, 0.25), f: [1250, 1500, 1000], times: [0, 0.05, 0.18], vowels: [E_, A_, O_], peak: 0.24, q: 8 }),
  );
}

export function coo(s: S, at = 0): number {
  return span(...[0, 0.42].map((dt) => call(s, {
    at: at + dt, type: 'triangle', f: [300, 360, 300, 330, 280], times: [0, 0.08, 0.2, 0.28, 0.38],
    vowels: [U_, U_, U_, U_, U_], peak: 0.11, q: 4,
  })));
}

export function bark(s: S, at = 0, f = 440): number {
  return span(
    call(s, { at, wave: pulseWave(s.ctx, 0.3), f: [f, f * 1.45, f * 0.85], times: [0, 0.04, 0.14], vowels: [[700, 1200, 2500], A_, [600, 1000, 2400]], peak: 0.22, breath: 0.35, q: 5 }),
    tone(s, { f: 180, to: 90, at, d: 0.06, peak: 0.2 }),
  );
}

export const ANIMAL_SFX: Record<string, SfxFn> = {
  'animal.pelican': (s) => span(...[0, 0.06, 0.11, 0.16, 0.2].map((at) => span(
    tone(s, { type: 'triangle', f: 950, at, a: 0.001, d: 0.025, peak: 0.25 }),
    hiss(s, { at, d: 0.02, peak: 0.15, filt: { type: 'bandpass', f: 1800, q: 2 } }),
  ))),
  'animal.goose': (s) => span(honk(s), honk(s, 0.34, 1.12)),
  'animal.capybara': (s) => call(s, {
    type: 'triangle', f: [900, 1350, 1100], times: [0, 0.08, 0.2], peak: 1.5, vowels: [[350, 2200, 3000], [400, 2300, 3100], [450, 2000, 2900]],
  }),
  'animal.cat': (s) => meow(s),
  'animal.shiba': (s) => span(bark(s, 0, 420), bark(s, 0.2, 470)),
  'animal.pigeon': (s) => coo(s),
  'animal.penguin': (s) => span(...[0, 0.13, 0.26].map((at, i) => call(s, {
    at, wave: pulseWave(s.ctx, 0.2), f: [300 + i * 20, 450 + i * 30, 380], times: [0, 0.05, 0.11], vowels: [A_, A_, O_], peak: 0.21, q: 5,
  }))),
  'animal.seagull': (s) => gullCry(s),
  'animal.sloth': (s) => call(s, {
    f: [210, 250, 170], times: [0, 0.35, 1.0], vowels: [A_, [720, 1150, 2450], O_], peak: 0.15, q: 5, breath: 0.3,
  }),
  'animal.corgi': (s) => span(bark(s, 0, 700), bark(s, 0.16, 760)),
  // The r6 meme roster (SPEC §23): each call is its own animal, none of them a reused voice.
  // 香蕉猫 — a whiny rising "huh?" meow that breaks into a sob halfway up.
  'animal.bananacat': (s) => span(
    call(s, { f: [380, 520, 650, 790, 700], times: [0, 0.1, 0.22, 0.38, 0.5], vowels: [U_, O_, A_, E_, A_], peak: 0.16, q: 7, breath: 0.22 }),
    call(s, { at: 0.54, f: [640, 430], times: [0, 0.13], vowels: [A_, O_], peak: 0.12, q: 6, breath: 0.3 }),
  ),
  // 泪眼猫猫 — a wet sob-meow that wobbles on every breath and ends in a sniff.
  'animal.cryingcat': (s) => span(
    call(s, {
      f: [540, 640, 510, 620, 490, 590, 450], times: [0, 0.07, 0.13, 0.2, 0.26, 0.33, 0.44],
      vowels: [A_, E_, A_, E_, A_, E_, O_], peak: 0.15, q: 7, breath: 0.3,
    }),
    hiss(s, { at: 0.48, a: 0.01, d: 0.14, peak: 0.22, filt: { type: 'bandpass', f: 1400, to: 2700, q: 3 } }),
  ),
  // 新鲜哥 — a hungry chirp then a street-cat meow: lower and quicker than `animal.cat`.
  'animal.xinxian': (s) => span(
    call(s, { f: [720, 1000, 840], times: [0, 0.03, 0.07], vowels: [I_, E_, I_], peak: 0.4, q: 8 }),
    call(s, { at: 0.09, f: [470, 610, 590, 420], times: [0, 0.05, 0.15, 0.27], vowels: [I_, A_, A_, O_], peak: 0.14, q: 7 }),
  ),
  // 弹跳猪 — a pygmy hippo, not a pig: a squeaky nasal snort dropping into a short wet grunt.
  'animal.moodeng': (s) => span(
    hiss(s, { d: 0.11, peak: 0.34, filt: { type: 'bandpass', f: 900, to: 2500, q: 3 } }),
    tone(s, { type: 'triangle', f: 1150, to: 1850, glide: 0.09, d: 0.1, peak: 0.2 }),
    call(s, { at: 0.15, f: [180, 220, 150], times: [0, 0.06, 0.21], vowels: [U_, O_, U_], peak: 0.2, q: 4, breath: 0.35 }),
  ),
  // 佩德罗 — a raccoon: three fast chittering trills (a trill is the pitch flipping per 25 ms).
  'animal.pedro': (s) => span(...[0, 0.16, 0.32].map((at) => call(s, {
    at, wave: pulseWave(s.ctx, 0.15), f: [950, 1350, 1000, 1400, 1050], times: [0, 0.025, 0.05, 0.075, 0.1],
    vowels: [I_, E_, I_, E_, I_], peak: 0.5, q: 9,
  }))),
  // 悲伤仓鼠 — three tiny squeaks, each one sagging: the sadness is the falling pitch.
  'animal.hamster': (s) => span(...[0, 0.16, 0.32].map((at, i) => call(s, {
    at, type: 'triangle', f: [2150 - i * 260, 2550 - i * 300, 1900 - i * 260], times: [0, 0.03, 0.1],
    vowels: [[700, 2300, 3300], [800, 2500, 3400], [650, 2100, 3100]], peak: 0.4, q: 8,
  }))),
};
