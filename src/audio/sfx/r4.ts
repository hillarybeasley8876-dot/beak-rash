// The r4 sounds (SPEC §14–§21): the police 2.0 cues (a rising wind-up tell, the baton swing, the
// roadblock, the corgi going down, the bribe), the r4 combat cues (the parry CLANG, a thrown
// weapon, the player's grunt), the air-trick and STYLE cues, the rival drama (nemesis, alliance)
// and the track events (a PA chime, a truck skid, a goose chorus, a jackhammer).
// All synthesized from the kit: no samples, no external files.
import { honk } from './animals';
import { call, fm, hiss, ring, span, tone, type S, type SfxFn } from './kit';

/** A short wood / sawhorse knock (the roadblock barriers, the corgi's bike). */
function knock(s: S, at: number, f: number, peak: number): number {
  return span(
    tone(s, { type: 'triangle', f, to: f * 0.6, at, a: 0.001, d: 0.07, peak }),
    hiss(s, { at, a: 0.0008, d: 0.05, peak: peak * 0.5, filt: { type: 'bandpass', f: f * 3, q: 1.4 } }),
  );
}

/** A short radio squelch (the corgi's shoulder radio). */
function radio(s: S, at: number): number {
  return span(
    tone(s, { type: 'square', f: 1800, to: 1500, at, a: 0.003, d: 0.05, peak: 0.1, filt: { type: 'lowpass', f: 3200 } }),
    hiss(s, { at, a: 0.002, d: 0.07, peak: 0.1, filt: { type: 'bandpass', f: 2400, q: 1.2 } }),
  );
}

export const R4_SFX: Record<string, SfxFn> = {
  // ---------------------------------------------------------------- police 2.0
  /** The wind-up tell: a rising whistle over 0.45 s — the player's cue to parry. */
  'police.windup': (s) => span(
    tone(s, { type: 'triangle', f: 760, to: 2200, a: 0.05, d: 0.42, peak: 0.3, vib: [9, 110] }),
    hiss(s, { a: 0.07, d: 0.4, peak: 0.13, filt: { type: 'bandpass', f: 1700, to: 3400, q: 3 } }),
    tone(s, { type: 'sine', f: 1500, to: 2400, a: 0.1, d: 0.34, peak: 0.1 }),
  ),
  /** The baton swing: a heavy whoosh that falls away. */
  'police.swing': (s) => span(
    hiss(s, { kind: 'pink', a: 0.05, d: 0.22, peak: 0.5, filt: { type: 'bandpass', f: 2200, to: 420, q: 1.1 } }),
    tone(s, { type: 'sawtooth', f: 210, to: 90, a: 0.04, d: 0.2, peak: 0.14, filt: { type: 'lowpass', f: 900 } }),
  ),
  /** A new wanted star: one siren chirp. */
  'police.wanted': (s) => span(...[0, 0.16].map((at, i) => tone(s, {
    type: 'square', f: i ? 720 : 980, to: i ? 980 : 720, at, a: 0.008, d: 0.14, peak: 0.16, filt: { type: 'lowpass', f: 2600 },
  }))),
  /** ★3: an alarm stinger — a fast warble that says "this is serious". */
  'police.wanted3': (s) => span(...[0, 0.13, 0.26, 0.39].map((at, i) => tone(s, {
    type: 'sawtooth', f: 900 + (i % 2) * 260, to: 1400, at, a: 0.01, d: 0.11, peak: 0.15, filt: { type: 'lowpass', f: 3000 },
  }))),
  /** The roadblock goes up: a radio blip and the sawhorse being dragged into place. */
  'police.roadblock': (s) => span(
    radio(s, 0),
    knock(s, 0.16, 320, 0.32),
    knock(s, 0.26, 240, 0.26),
    knock(s, 0.4, 380, 0.22),
    hiss(s, { kind: 'crackle', at: 0.14, d: 0.32, peak: 0.5, filt: { type: 'bandpass', f: 1800, q: 0.8 } }),
  ),
  /** The corgi goes down: a cartoon bonk, a slide whistle and its bike clattering away. */
  'police.down': (s) => span(
    tone(s, { type: 'triangle', f: 420, to: 110, a: 0.002, d: 0.16, peak: 0.5 }),
    hiss(s, { a: 0.001, d: 0.09, peak: 0.4, filt: { type: 'lowpass', f: 2600 } }),
    tone(s, { type: 'sine', f: 2400, to: 380, a: 0.02, d: 0.55, peak: 0.22, vib: [12, 180] }),
    knock(s, 0.42, 300, 0.2),
    knock(s, 0.56, 210, 0.16),
  ),
  /** A bribe accepted: the cash register. */
  'police.bribe.ok': (s) => span(
    ring(s, { f: 2100, partials: [[1, 1, 0.5], [2.4, 0.5, 0.35], [3.9, 0.25, 0.2]], peak: 0.16 }),
    ...[0.09, 0.16, 0.23].map((at, i) => ring(s, { f: 2600 - i * 180, partials: [[1, 1, 0.14], [2.7, 0.4, 0.08]], at, peak: 0.1 - i * 0.02 })),
  ),
  /** A bribe refused: the buzzer. */
  'police.bribe.no': (s) => span(
    tone(s, { type: 'square', f: 138, to: 118, a: 0.004, d: 0.38, peak: 0.22, filt: { type: 'lowpass', f: 900 } }),
    tone(s, { type: 'square', f: 92, a: 0.004, d: 0.4, peak: 0.14, filt: { type: 'lowpass', f: 600 } }),
  ),
  /** The corgi is hit: a yelp and a patter of paws. */
  'police.hurt': (s) => span(
    tone(s, { type: 'square', f: 720, to: 380, a: 0.004, d: 0.11, peak: 0.16, filt: { type: 'bandpass', f: 1400, q: 2 } }),
    tone(s, { f: 210, to: 120, a: 0.002, d: 0.09, peak: 0.2 }),
  ),

  // ---------------------------------------------------------------- r4 combat
  /** The parry: a big metallic CLANG (当！) — the ring must be heard over the music. */
  'combat.parry': (s) => span(
    ring(s, { f: 880, partials: [[1, 1, 1.1], [2.37, 0.7, 0.8], [3.91, 0.45, 0.55], [5.63, 0.28, 0.35], [7.2, 0.15, 0.2]], peak: 0.5 }),
    ring(s, { f: 1320, partials: [[1, 1, 0.7], [2.1, 0.5, 0.4], [4.3, 0.2, 0.25]], peak: 0.22 }),
    hiss(s, { a: 0.001, d: 0.06, peak: 0.55, filt: { type: 'highpass', f: 2600, to: 9000 } }),
    tone(s, { f: 300, to: 150, a: 0.002, d: 0.12, peak: 0.3 }),
  ),
  /** A thrown weapon leaving the hand: a whoosh (the pitch is set per weapon). */
  'combat.throw': (s) => span(
    hiss(s, { kind: 'pink', a: 0.05, d: 0.2, peak: 0.34, filt: { type: 'bandpass', f: 700, to: 2600, q: 1 } }),
    tone(s, { type: 'sawtooth', f: 320, to: 620, a: 0.05, d: 0.18, peak: 0.08, filt: { type: 'lowpass', f: 1400 } }),
  ),
  /** The player's own grunt: a hit taken (the baton's). */
  'combat.hurt': (s) => span(
    tone(s, { type: 'sawtooth', f: 190, to: 120, a: 0.006, d: 0.16, peak: 0.3, filt: { type: 'bandpass', f: 700, q: 1.6 } }),
    hiss(s, { a: 0.01, d: 0.14, peak: 0.14, filt: { type: 'bandpass', f: 1100, q: 1.4 } }),
  ),

  // ---------------------------------------------------------------- air tricks & STYLE
  /** A trick starts: air over the rider as it spins. */
  'trick.start': (s) => span(
    hiss(s, { kind: 'pink', a: 0.08, d: 0.28, peak: 0.3, filt: { type: 'bandpass', f: 500, to: 2400, q: 1 } }),
    tone(s, { type: 'sine', f: 320, to: 900, a: 0.09, d: 0.26, peak: 0.09 }),
  ),
  /** A trick lands: a bright chime (the pitch climbs with the trick count). */
  'trick.land': (s) => span(
    fm(s, { f: 1046, ratio: 2, index: [0.6, 0.05], d: 0.4, peak: 0.16 }),
    fm(s, { f: 1568, ratio: 2, index: [0.5, 0.05], at: 0.05, d: 0.35, peak: 0.1 }),
  ),
  /** The STYLE chain ticks up (the pitch rises with the chain). */
  'style.chain': (s) => span(
    tone(s, { type: 'square', f: 2100, a: 0.001, d: 0.03, peak: 0.09, filt: { type: 'bandpass', f: 2600, q: 2 } }),
    tone(s, { type: 'sine', f: 1400, to: 2100, a: 0.001, d: 0.05, peak: 0.05 }),
  ),
  /** The chain banks: a cash-register arpeggio. */
  'style.bank': (s) => span(...[1046, 1318, 1568, 2093].map((f, i) => fm(s, {
    f, ratio: 2, index: [0.7, 0.05], at: i * 0.055, d: 0.35, peak: 0.11,
  }))),
  /** The chain breaks: the wah-wah. */
  'style.broken': (s) => span(...[0, 0.16].map((at, i) => tone(s, {
    type: 'sawtooth', f: i ? 165 : 220, to: i ? 110 : 150, at, a: 0.02, d: 0.16, peak: 0.16,
    filt: { type: 'bandpass', f: i ? 620 : 900, q: 2.4 },
  }))),

  // ---------------------------------------------------------------- rival drama
  /** The nemesis appears: a low brass stab and a sour note above it. */
  'race.nemesis': (s) => span(
    tone(s, { type: 'sawtooth', f: 98, to: 92, a: 0.02, d: 0.5, peak: 0.24, filt: { type: 'lowpass', f: 900, to: 500, q: 1.2 } }),
    tone(s, { type: 'sawtooth', f: 208, to: 196, at: 0.22, a: 0.02, d: 0.45, peak: 0.14, filt: { type: 'lowpass', f: 1800, q: 1.2 } }),
    tone(s, { type: 'sawtooth', f: 220, at: 0.22, a: 0.02, d: 0.4, peak: 0.1, filt: { type: 'lowpass', f: 2000 } }),
    hiss(s, { at: 0.2, a: 0.02, d: 0.5, peak: 0.14, filt: { type: 'highpass', f: 4000, to: 9000 } }),
  ),
  /** The nemesis is down: a bright major stab. */
  'race.nemesisDown': (s) => span(
    ...[523, 659, 784, 1046].map((f, i) => tone(s, {
      type: 'triangle', f, at: i * 0.05, a: 0.005, d: 0.45 - i * 0.05, peak: 0.13,
      filt: { type: 'lowpass', f: 5000 },
    })),
    hiss(s, { a: 0.002, d: 0.3, peak: 0.16, filt: { type: 'highpass', f: 4000, to: 9000 } }),
  ),
  /** The alliance forms: an ominous brass cluster (a minor second grinding). */
  'race.alliance': (s) => span(
    tone(s, { type: 'sawtooth', f: 116, a: 0.03, d: 0.8, peak: 0.2, filt: { type: 'lowpass', f: 1100, q: 1.4 } }),
    tone(s, { type: 'sawtooth', f: 123, a: 0.03, d: 0.8, peak: 0.16, filt: { type: 'lowpass', f: 1200, q: 1.4 } }),
    tone(s, { type: 'sawtooth', f: 233, a: 0.05, d: 0.7, peak: 0.1, filt: { type: 'lowpass', f: 2000, q: 1.4 } }),
    hiss(s, { a: 0.05, d: 0.7, peak: 0.1, filt: { type: 'bandpass', f: 900, q: 0.8 } }),
  ),
  /** The alliance breaks: the record scratch. */
  'race.allianceBreak': (s) => span(
    ...[0, 0.045, 0.075, 0.095].map((at, i) => hiss(s, {
      at, a: 0.001, d: 0.04, peak: 0.22 - i * 0.03, filt: { type: 'bandpass', f: 3200 - i * 500, q: 2.5 },
    })),
    tone(s, { type: 'square', f: 1800, to: 300, a: 0.002, d: 0.2, peak: 0.1, filt: { type: 'lowpass', f: 3000 } }),
  ),

  // ---------------------------------------------------------------- track events
  /** The PA chime that warns of an event (ding-dong). */
  'race.event.warn': (s) => span(
    ring(s, { f: 1046, partials: [[1, 1, 0.5], [2.4, 0.4, 0.3]], peak: 0.18 }),
    ring(s, { f: 784, partials: [[1, 1, 0.7], [2.4, 0.4, 0.4]], at: 0.22, peak: 0.18 }),
  ),
  /** A fish truck tips over: a long skid, a crash and the fish flopping. */
  'race.event.fishSpill': (s) => span(
    hiss(s, { kind: 'brown', a: 0.2, d: 0.7, peak: 0.4, filt: { type: 'bandpass', f: 900, to: 2600, q: 1.1 } }),
    tone(s, { type: 'sawtooth', f: 130, to: 70, a: 0.3, d: 0.6, peak: 0.16, filt: { type: 'lowpass', f: 700 } }),
    ring(s, { f: 620, partials: [[1, 1, 0.5], [1.9, 0.6, 0.35], [3.3, 0.3, 0.2]], at: 0.62, peak: 0.16 }),
    hiss(s, { kind: 'crackle', at: 0.62, d: 0.45, peak: 0.5, filt: { type: 'bandpass', f: 2400, q: 0.8 } }),
    ...[0.95, 1.12, 1.3].map((at, i) => tone(s, {
      type: 'sine', f: 420 - i * 60, to: 200, at, a: 0.004, d: 0.09, peak: 0.16,
    })),
  ),
  /** A flock of geese crosses: a honk chorus. */
  'race.event.geese': (s) => span(
    honk(s, 0, 0.9),
    honk(s, 0.22, 1.05),
    honk(s, 0.4, 0.95),
    honk(s, 0.66, 1.12),
    honk(s, 0.86, 0.88),
  ),
  /** The roadworks: a jackhammer burst. */
  'race.event.roadworks': (s) => span(
    ...[0, 0.14, 0.28, 0.42].map((at) => span(
      tone(s, { type: 'square', f: 165, to: 120, at, a: 0.002, d: 0.09, peak: 0.2, filt: { type: 'lowpass', f: 1800 } }),
      hiss(s, { kind: 'crackle', at, a: 0.001, d: 0.08, peak: 0.3, filt: { type: 'bandpass', f: 2000, q: 0.8 } }),
    )),
  ),
  /** A market stall: the owner's chatter (a murmuring vendor). */
  'race.event.stalls': (s) => span(
    ...[0, 0.11, 0.24, 0.35].map((at, i) => tone(s, {
      type: 'sawtooth', f: 210 + i * 26, to: 180 + i * 20, at, a: 0.01, d: 0.09, peak: 0.11,
      filt: { type: 'bandpass', f: 640 + i * 90, q: 3 },
    })),
    hiss(s, { a: 0.02, d: 0.4, peak: 0.06, filt: { type: 'bandpass', f: 800, q: 1.2 } }),
  ),

  // ---------------------------------------------------------------- easter eggs
  /** An easter egg is found: a magic chime. */
  'secret.found': (s) => span(...[1046, 1318, 1568, 2093, 2637].map((f, i) => fm(s, {
    f, ratio: 3, index: [0.8, 0.05], at: i * 0.06, d: 0.6 - i * 0.06, peak: 0.09,
  }))),
  /** The rubber duck: a nasal quack. */
  'secret.quack': (s) => call(s, {
    type: 'sawtooth', f: [430, 300, 360, 320], times: [0, 0.05, 0.13, 0.2],
    vowels: [[520, 1250, 2500], [460, 1150, 2400], [540, 1300, 2550], [480, 1200, 2450]],
    peak: 0.3, q: 4, breath: 0.2,
  }),
};
