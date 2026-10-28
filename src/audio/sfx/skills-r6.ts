// r6 skill sounds (SPEC §24): every r6 skill has a sound of its own — a cast 'skill.<id>', a
// 'skill.<id>.hit' for the ones that hit a rider, a 'skill.<id>.end' where the end is an event (a
// bubble that pops, a time stop that unwinds) — and every element reaction has a sting of its own
// ('react.<reaction>'). The voice is the game's: short, punchy, cartoon. Long effects get a short
// cast plus a tail, never a drone.
import { call, fm, hiss, ring, span, tone, type S, type SfxFn } from './kit';

/** Shared tuning: the loudness of a reaction (a highlight, louder than a skill hit, below the KO
 *  boom), the duck army's chorus, the sad violin's four notes and the reaction's sting levels. */
const TUNING = {
  /** Peaks of the reaction stings (the KO boom is 1.6: a reaction never reaches it). */
  react: { steam: 0.7, sizzle: 0.62, ice: 0.62, zap: 0.4, shatter: 0.72, boom: 0.85, swirl: 0.95 },
  /** The duck army: five quacks, a fifth apart, walking across the stereo field. */
  ducks: [0, 0.09, 0.17, 0.25, 0.33],
  duckPitch: 640,
  /** The hamster's sad phrase: D minor, four notes down. */
  violin: [587, 523, 466, 415],
} as const;

/** One duck quack: a nasal call with a falling contour. */
function quack(s: S, at: number, f: number, pan = 0): number {
  return call(s, {
    at, pan, type: 'sawtooth', f: [f, f * 0.86, f * 0.7], times: [0, 0.05, 0.13],
    vowels: [[660, 1150, 2450], [610, 1250, 2500], [520, 1000, 2200]], peak: 0.15, breath: 0.18, q: 5,
  });
}

/** A short bright chord (the pop-up ad's jingle, the war song's fanfare). */
function chord(s: S, at: number, freqs: number[], d: number, peak: number, type: OscillatorType = 'triangle'): number {
  return span(...freqs.map((f, i) => tone(s, { type, f, at: at + i * 0.07, a: 0.008, d, peak, filt: { type: 'lowpass', f: 3000, q: 1 } })));
}

/** ---------------------------------------------------------------- fire */
const fire: Record<string, SfxFn> = {
  // 喷火: a roaring breath of flame (pink noise through a low-pass that opens up) with the crackle on top.
  'skill.pool.firebreath': (s) => span(
    hiss(s, { kind: 'pink', a: 0.05, d: 0.5, peak: 0.6, filt: { type: 'lowpass', f: 320, to: 2800 } }),
    hiss(s, { kind: 'crackle', a: 0.08, d: 0.42, peak: 0.3, filt: { type: 'bandpass', f: 1500, q: 0.7 } }),
    tone(s, { type: 'sawtooth', f: 85, to: 55, a: 0.06, d: 0.4, peak: 0.16, filt: { type: 'lowpass', f: 500 } }),
  ),
  'skill.pool.firebreath.hit': (s) => span(
    hiss(s, { a: 0.002, d: 0.2, peak: 0.5, filt: { type: 'bandpass', f: 1200, to: 2600, q: 0.8 } }),
    tone(s, { f: 180, to: 70, d: 0.15, peak: 0.3 }),
  ),
  // 窜天猴: the rocket under the saddle lights, then whistles away.
  'skill.pool.rocket': (s) => span(
    hiss(s, { kind: 'crackle', a: 0.005, d: 0.22, peak: 0.7, filt: { type: 'highpass', f: 1600 } }),
    tone(s, { f: 260, to: 1700, a: 0.05, d: 0.4, peak: 0.3, vib: [11, 70] }),
    hiss(s, { kind: 'pink', a: 0.08, d: 0.45, peak: 0.6, filt: { type: 'bandpass', f: 500, to: 2400, q: 1.2 } }),
  ),
  'skill.pool.rocket.hit': (s) => span(
    hiss(s, { kind: 'crackle', a: 0.002, d: 0.25, peak: 0.65, filt: { type: 'bandpass', f: 900, q: 0.7 } }),
    tone(s, { f: 140, to: 60, d: 0.18, peak: 0.42 }),
  ),
  // 二踢脚: the fuse hisses; the bang is a string of pops.
  'skill.pool.firecracker': (s) => span(
    hiss(s, { kind: 'crackle', a: 0.02, d: 0.55, peak: 0.9, filt: { type: 'bandpass', f: 2800, q: 1.4 } }),
    ...[0.05, 0.15, 0.26, 0.4].map((at) => tone(s, { type: 'square', f: 3400, at, a: 0.001, d: 0.01, peak: 0.16, filt: { type: 'bandpass', f: 3400, q: 2 } })),
  ),
  'skill.pool.firecracker.hit': (s) => span(...[0, 0.08, 0.15, 0.23, 0.3].map((at, i) => span(
    hiss(s, { kind: 'crackle', at, a: 0.001, d: 0.06, peak: 0.8 - i * 0.09, filt: { type: 'bandpass', f: 1800, q: 0.8 } }),
    tone(s, { f: 210, to: 70, at, d: 0.1, peak: 0.4 }),
  ))),
};

/** ---------------------------------------------------------------- ice */
const ice: Record<string, SfxFn> = {
  // 冰锥: a glassy shimmer as the lance leaves the hand.
  'skill.pool.icelance': (s) => span(
    ...[0, 0.05, 0.1].map((at, i) => fm(s, { f: 1700 + i * 600, to: 2500 + i * 800, ratio: 2, index: [1.3, 0.1], at, d: 0.24, peak: 0.2 })),
    hiss(s, { a: 0.01, d: 0.18, peak: 0.25, filt: { type: 'highpass', f: 4500 } }),
  ),
  'skill.pool.icelance.hit': (s) => span(
    tone(s, { f: 2600, to: 1000, d: 0.12, peak: 0.24 }),
    hiss(s, { a: 0.001, d: 0.05, peak: 0.6, filt: { type: 'highpass', f: 5200 } }),
    ring(s, { f: 3400, partials: [[1, 1, 0.14], [2.6, 0.45, 0.09]], at: 0.01, peak: 0.12 }),
  ),
  // 大雪球: a soft whump of a ball leaving the hand.
  'skill.pool.snowball': (s) => span(
    tone(s, { f: 160, to: 85, a: 0.02, d: 0.25, peak: 0.5 }),
    hiss(s, { kind: 'brown', a: 0.02, d: 0.3, peak: 0.34, filt: { type: 'lowpass', f: 480 } }),
  ),
  'skill.pool.snowball.hit': (s) => span(
    hiss(s, { kind: 'crackle', a: 0.002, d: 0.28, peak: 0.6, filt: { type: 'bandpass', f: 1100, q: 0.7 } }),
    tone(s, { f: 110, to: 52, d: 0.22, peak: 0.5 }),
  ),
};

/** ------------------------------------------------------------ thunder */
const thunder: Record<string, SfxFn> = {
  // 天打雷劈: a sharp crack, then the rumble that rolls on.
  'skill.pool.thunder': (s) => span(
    hiss(s, { a: 0.0008, d: 0.06, peak: 0.8, filt: { type: 'highpass', f: 2200 } }),
    tone(s, { f: 320, to: 55, d: 0.28, peak: 0.28 }),
    hiss(s, { kind: 'brown', at: 0.04, a: 0.05, d: 0.95, peak: 0.65, filt: { type: 'lowpass', f: 300 } }),
  ),
  'skill.pool.thunder.hit': (s) => span(
    tone(s, { f: 200, to: 60, d: 0.2, peak: 0.3 }),
    hiss(s, { kind: 'brown', a: 0.02, d: 0.4, peak: 0.4, filt: { type: 'lowpass', f: 500 } }),
  ),
};

/** -------------------------------------------------------------- water */
const water: Record<string, SfxFn> = {
  // 滋水枪: a jet of water (band-passed noise) that burbles.
  'skill.pool.watergun': (s) => span(
    hiss(s, { a: 0.01, d: 0.32, peak: 1.0, filt: { type: 'bandpass', f: 900, to: 2500, q: 1.7 } }),
    ...[0.04, 0.11, 0.18, 0.25].map((at, i) => fm(s, { f: 680 + i * 150, to: 1050 + i * 190, ratio: 3, index: [2.2, 0.4], at, d: 0.1, peak: 0.18 })),
  ),
  'skill.pool.watergun.hit': (s) => span(
    hiss(s, { a: 0.002, d: 0.22, peak: 0.6, filt: { type: 'bandpass', f: 1400, to: 2600, q: 1.2 } }),
    tone(s, { f: 420, to: 180, d: 0.1, peak: 0.24 }),
  ),
  // 泡泡护盾: a bubble is blown.
  'skill.pool.bubble': (s) => span(
    fm(s, { f: 480, to: 1050, ratio: 2, index: [1.6, 0.2], d: 0.22, peak: 0.34 }),
    hiss(s, { a: 0.008, d: 0.2, peak: 0.36, filt: { type: 'bandpass', f: 1100, to: 2400, q: 2 } }),
  ),
  'skill.pool.bubble.hit': (s) => span(
    hiss(s, { a: 0.002, d: 0.18, peak: 0.5, filt: { type: 'bandpass', f: 1600, to: 600, q: 1 } }),
    tone(s, { f: 500, to: 200, d: 0.1, peak: 0.26 }),
  ),
  // the shield is gone: the bubble pops.
  'skill.pool.bubble.end': (s) => span(
    tone(s, { f: 1500, to: 420, d: 0.11, peak: 0.38 }),
    hiss(s, { a: 0.001, d: 0.09, peak: 0.55, filt: { type: 'bandpass', f: 2200, to: 700, q: 1.1 } }),
  ),
};

/** --------------------------------------------------------------- wind */
const wind: Record<string, SfxFn> = {
  // 龙卷风: a swirl that rises as it spins.
  'skill.pool.tornado': (s) => span(
    hiss(s, { kind: 'pink', a: 0.18, d: 0.7, peak: 0.72, filt: { type: 'bandpass', f: 280, to: 2200, q: 2.4 } }),
    tone(s, { type: 'sawtooth', f: 55, to: 190, a: 0.18, d: 0.65, peak: 0.16, vib: [9, 70], filt: { type: 'lowpass', f: 1100 } }),
  ),
  'skill.pool.tornado.hit': (s) => span(
    tone(s, { f: 130, to: 60, d: 0.18, peak: 0.38 }),
    hiss(s, { kind: 'pink', a: 0.01, d: 0.25, peak: 0.45, filt: { type: 'bandpass', f: 700, to: 1800, q: 1.6 } }),
  ),
};

/** ---------------------------------------------------------------- gags */
const gag: Record<string, SfxFn> = {
  // 回旋咸鱼: a whoop on the way out, a whoop on the way home.
  'skill.pool.boomerang': (s) => span(
    tone(s, { type: 'triangle', f: 700, to: 1500, a: 0.02, d: 0.14, peak: 0.24, vib: [22, 90] }),
    tone(s, { type: 'triangle', f: 1500, to: 650, at: 0.34, a: 0.02, d: 0.16, peak: 0.22, vib: [22, 90] }),
    hiss(s, { kind: 'pink', a: 0.02, d: 0.4, peak: 0.35, filt: { type: 'bandpass', f: 1200, to: 2600, q: 1.4 } }),
  ),
  'skill.pool.boomerang.hit': (s) => span(
    tone(s, { f: 320, to: 120, d: 0.12, peak: 0.45 }),
    hiss(s, { a: 0.002, d: 0.08, peak: 0.6, filt: { type: 'lowpass', f: 3200 } }),
  ),
  // 画大饼: a pie leaves the hand…
  'skill.pool.pie': (s) => span(
    hiss(s, { kind: 'pink', a: 0.02, d: 0.3, peak: 0.7, filt: { type: 'bandpass', f: 700, to: 1600, q: 1.2 } }),
    tone(s, { f: 180, to: 260, a: 0.03, d: 0.2, peak: 0.3 }),
  ),
  // …and lands: a wet splat.
  'skill.pool.pie.hit': (s) => span(
    hiss(s, { a: 0.002, d: 0.16, peak: 0.6, filt: { type: 'bandpass', f: 1000, to: 260, q: 0.9 } }),
    tone(s, { f: 240, to: 90, d: 0.14, peak: 0.36 }),
    tone(s, { f: 90, to: 45, at: 0.02, d: 0.12, peak: 0.26 }),
  ),
  // 左右脑互搏: a cartoon boing and a wobble in the head.
  'skill.pool.brainfight': (s) => span(
    fm(s, { f: 300, to: 900, ratio: 1, index: [3, 0.6], a: 0.02, d: 0.28, peak: 0.28 }),
    ...[0.1, 0.2, 0.3].map((at) => tone(s, { f: 700, to: 380, at, a: 0.004, d: 0.07, peak: 0.22, vib: [30, 160] })),
  ),
  // 闪现: a zap and a blip.
  'skill.pool.blink': (s) => span(
    fm(s, { f: 2400, to: 700, ratio: 3, index: [3, 0.3], d: 0.16, peak: 0.24 }),
    tone(s, { f: 1200, to: 320, at: 0.02, d: 0.1, peak: 0.2 }),
    hiss(s, { a: 0.001, d: 0.06, peak: 0.4, filt: { type: 'highpass', f: 3000 } }),
  ),
  // 枸杞保温杯: the cap comes off, a sip, a content sigh.
  'skill.pool.thermos': (s) => span(
    ring(s, { f: 1200, partials: [[1, 1, 0.08], [2.7, 0.4, 0.05]], peak: 0.24 }),
    tone(s, { f: 260, to: 700, a: 0.05, d: 0.3, peak: 0.22, filt: { type: 'bandpass', f: 900, q: 3 } }),
    tone(s, { type: 'triangle', f: 420, to: 300, a: 0.12, d: 0.35, peak: 0.24, vib: [5, 30] }),
  ),
  // 鸭鸭大军: a quack chorus (five ducks, a fifth apart).
  'skill.pool.ducks': (s) => span(
    ...TUNING.ducks.map((at, i) => quack(s, at, TUNING.duckPitch - i * 45, -0.6 + i * 0.3)),
  ),
  'skill.pool.ducks.hit': (s) => span(
    quack(s, 0, 700, 0.3),
    tone(s, { f: 200, to: 90, d: 0.1, peak: 0.36 }),
  ),
  // 开屏广告: a cheesy jingle ding.
  'skill.pool.popup': (s) => span(
    chord(s, 0, [1047, 1319, 1568], 0.3, 0.2),
    tone(s, { f: 2093, at: 0.22, d: 0.35, peak: 0.16 }),
  ),
  'skill.pool.popup.hit': (s) => span(
    tone(s, { f: 1800, to: 600, d: 0.1, peak: 0.3 }),
    hiss(s, { a: 0.002, d: 0.1, peak: 0.36, filt: { type: 'bandpass', f: 2400, to: 900, q: 1.2 } }),
  ),
  // 战歌起: a short horn fanfare and the drum that starts it.
  'skill.pool.warsong': (s) => span(
    chord(s, 0, [392, 523, 659], 0.16, 0.2, 'sawtooth'),
    tone(s, { f: 150, to: 55, at: 0.4, d: 0.22, peak: 0.5 }),
    hiss(s, { kind: 'crackle', at: 0.4, a: 0.002, d: 0.12, peak: 0.4, filt: { type: 'bandpass', f: 1200, q: 0.8 } }),
  ),
  'skill.pool.warsong.hit': (s) => span(
    tone(s, { f: 200, to: 90, d: 0.12, peak: 0.34 }),
    tone(s, { type: 'triangle', f: 300, to: 180, at: 0.02, d: 0.14, peak: 0.14 }),
  ),
};

/** ------------------------------------------------------- meme signatures */
const meme: Record<string, SfxFn> = {
  // 香蕉皮: the peel comes off the banana, squishy.
  'skill.bananacat.peel': (s) => span(
    hiss(s, { a: 0.004, d: 0.22, peak: 0.6, filt: { type: 'bandpass', f: 600, to: 1600, q: 1.1 } }),
    tone(s, { f: 300, to: 120, a: 0.01, d: 0.18, peak: 0.3 }),
  ),
  // …and the rider who hits it skids: a slip whistle.
  'skill.bananacat.peel.hit': (s) => span(
    tone(s, { f: 1500, to: 2600, a: 0.02, d: 0.3, peak: 0.22, vib: [26, 120] }),
    hiss(s, { a: 0.01, d: 0.35, peak: 0.38, filt: { type: 'bandpass', f: 1800, to: 3200, q: 3 } }),
  ),
  // 泪如雨下: a sad wail (the meow pitched down, a slow vibrato) and the rain on the road.
  'skill.cryingcat.tears': (s) => span(
    call(s, {
      type: 'sawtooth', f: [520, 380, 300, 260], times: [0, 0.18, 0.45, 0.7],
      vowels: [[400, 1200, 2600], [380, 1300, 2700], [340, 1100, 2500], [320, 1000, 2400]],
      peak: 0.13, q: 6, breath: 0.2,
    }),
    tone(s, { type: 'triangle', f: 300, to: 220, a: 0.1, d: 0.8, peak: 0.06, vib: [5, 40] }),
    hiss(s, { kind: 'white', a: 0.1, d: 0.9, peak: 0.2, filt: { type: 'bandpass', f: 3500, to: 2000, q: 0.9 } }),
  ),
  // the rain lands on the head.
  'skill.cryingcat.tears.hit': (s) => span(
    hiss(s, { kind: 'white', a: 0.002, d: 0.12, peak: 0.4, filt: { type: 'bandpass', f: 2600, to: 1200, q: 1.1 } }),
    tone(s, { f: 900, to: 400, d: 0.09, peak: 0.18 }),
  ),
  // 五秒真香: the vacuum that sucks every pickup in.
  'skill.xinxian.fresh': (s) => span(
    hiss(s, { kind: 'pink', a: 0.05, d: 0.7, peak: 0.7, filt: { type: 'bandpass', f: 2600, to: 500, q: 2.6 } }),
    tone(s, { type: 'sine', f: 900, to: 200, a: 0.05, d: 0.7, peak: 0.24 }),
  ),
  // every bite it swallows is a munch.
  'skill.xinxian.fresh.hit': (s) => span(
    tone(s, { f: 220, to: 120, a: 0.005, d: 0.09, peak: 0.4 }),
    tone(s, { f: 260, to: 150, at: 0.08, d: 0.09, peak: 0.34 }),
    hiss(s, { a: 0.002, d: 0.07, peak: 0.3, filt: { type: 'bandpass', f: 1500, q: 1.4 } }),
  ),
  // Q弹冲击: the big boing up.
  'skill.moodeng.bounce': (s) => span(
    tone(s, { f: 130, to: 620, a: 0.02, d: 0.42, peak: 0.3, vib: [7, 40] }),
    fm(s, { f: 300, to: 900, ratio: 1, index: [1.5, 0.2], at: 0.02, d: 0.4, peak: 0.12 }),
  ),
  // …and the landing: a heavy thud.
  'skill.moodeng.bounce.hit': (s) => span(
    tone(s, { f: 120, to: 45, d: 0.3, peak: 0.65 }),
    hiss(s, { kind: 'brown', a: 0.005, d: 0.35, peak: 0.55, filt: { type: 'lowpass', f: 400 } }),
  ),
  // 垃圾桶盲盒: a bin rummage, then a happy little tune.
  'skill.pedro.trash': (s) => span(
    ...[0, 0.07, 0.13, 0.2, 0.27].map((at, i) => ring(s, { f: 700 + i * 130, partials: [[1, 1, 0.09], [2.6, 0.5, 0.06]], at, peak: 0.2 })),
    chord(s, 0.34, [523, 659, 784], 0.14, 0.22),
  ),
  'skill.pedro.trash.hit': (s) => span(
    tone(s, { f: 260, to: 110, d: 0.12, peak: 0.36 }),
    hiss(s, { a: 0.002, d: 0.1, peak: 0.36, filt: { type: 'bandpass', f: 1200, q: 1 } }),
  ),
  // 悲伤小提琴: four notes down in D minor on a bowed string.
  'skill.hamster.violin': (s) => span(
    ...TUNING.violin.map((f, i) => span(
      tone(s, { type: 'sawtooth', f, at: i * 0.28, a: 0.03, d: 0.3, peak: 0.18, vib: [5.5, 20], filt: { type: 'lowpass', f: 2200, q: 1.2 } }),
      fm(s, { f: f * 2, ratio: 3, index: [1.6, 0.3], at: i * 0.28, d: 0.3, peak: 0.07 }),
    )),
    tone(s, { type: 'sawtooth', f: 147, a: 0.05, d: 1.1, peak: 0.1, filt: { type: 'lowpass', f: 700 } }),
  ),
  // the sadness lands.
  'skill.hamster.violin.hit': (s) => span(
    tone(s, { type: 'sawtooth', f: 415, to: 330, a: 0.02, d: 0.4, peak: 0.16, vib: [6, 24], filt: { type: 'lowpass', f: 1800, q: 1.2 } }),
    tone(s, { f: 220, to: 140, at: 0.02, d: 0.2, peak: 0.24 }),
  ),
};

/** ----------------------------------------------------------- shared ults */
const ult: Record<string, SfxFn> = {
  // 陨石雨: a deep whistle coming down out of the sky.
  'skill.ult.meteor': (s) => span(
    tone(s, { type: 'sawtooth', f: 1600, to: 260, a: 0.06, d: 0.55, peak: 0.28, filt: { type: 'lowpass', f: 2600 } }),
    hiss(s, { kind: 'pink', a: 0.2, d: 0.6, peak: 0.5, filt: { type: 'bandpass', f: 700, to: 300, q: 1.4 } }),
  ),
  'skill.ult.meteor.hit': (s) => span(
    tone(s, { f: 110, to: 40, d: 0.5, peak: 0.65 }),
    hiss(s, { kind: 'brown', a: 0.005, d: 0.5, peak: 0.6, filt: { type: 'lowpass', f: 500 } }),
  ),
  'skill.ult.meteor.impact': (s) => span(
    tone(s, { f: 90, to: 32, d: 0.9, peak: 0.9 }),
    hiss(s, { kind: 'brown', a: 0.01, d: 0.9, peak: 0.8, filt: { type: 'lowpass', f: 420 } }),
    hiss(s, { d: 0.1, peak: 0.3, filt: { type: 'highpass', f: 2500 } }),
  ),
  // 雷暴: a rolling thunder bed with the rain on it.
  'skill.ult.storm': (s) => span(
    hiss(s, { kind: 'brown', a: 0.12, d: 1.2, peak: 0.55, filt: { type: 'lowpass', f: 260 } }),
    ...[0.1, 0.45, 0.8].map((at) => hiss(s, { kind: 'brown', at, a: 0.03, d: 0.5, peak: 0.4, filt: { type: 'lowpass', f: 400 } })),
    hiss(s, { kind: 'white', a: 0.1, d: 1.1, peak: 0.16, filt: { type: 'bandpass', f: 3200, to: 1800, q: 0.8 } }),
  ),
  'skill.ult.storm.hit': (s) => span(
    hiss(s, { a: 0.0008, d: 0.07, peak: 0.7, filt: { type: 'highpass', f: 2000 } }),
    tone(s, { f: 300, to: 60, d: 0.25, peak: 0.25 }),
  ),
  'skill.ult.storm.impact': (s) => span(
    hiss(s, { a: 0.0008, d: 0.08, peak: 0.8, filt: { type: 'highpass', f: 1800 } }),
    tone(s, { f: 120, to: 42, d: 0.7, peak: 0.7 }),
    hiss(s, { kind: 'brown', a: 0.01, d: 0.8, peak: 0.6, filt: { type: 'lowpass', f: 380 } }),
  ),
  // 时间暂停: a clock that ticks and slows to a stop, then the tape winds off.
  'skill.ult.timestop': (s) => span(
    ...[0, 0.14, 0.28, 0.42].map((at, i) => tone(s, { type: 'square', f: 1800 - i * 120, at, a: 0.001, d: 0.02, peak: 0.09, filt: { type: 'bandpass', f: 2000, q: 2 } })),
    tone(s, { f: 900, to: 120, a: 0.2, d: 0.9, peak: 0.16, filt: { type: 'lowpass', f: 3000 } }),
  ),
  // the freeze is over: the tape spins back up.
  'skill.ult.timestop.end': (s) => span(
    tone(s, { f: 140, to: 900, a: 0.15, d: 0.6, peak: 0.14, filt: { type: 'lowpass', f: 2600 } }),
    hiss(s, { a: 0.2, d: 0.5, peak: 0.12, filt: { type: 'bandpass', f: 600, to: 2400, q: 1.2 } }),
  ),
};

/** --------------------------------------------------------- element reactions
 *  A reaction is a highlight: louder than a skill hit, never as loud as the KO boom. */
const react: Record<string, SfxFn> = {
  // 蒸发: a burst of steam.
  'react.vaporize': (s) => span(
    hiss(s, { a: 0.005, d: 0.5, peak: TUNING.react.steam, filt: { type: 'highpass', f: 1800, to: 5000 } }),
    hiss(s, { kind: 'brown', a: 0.02, d: 0.3, peak: 0.3, filt: { type: 'lowpass', f: 900 } }),
    tone(s, { f: 900, to: 300, d: 0.2, peak: 0.14 }),
  ),
  // 融化: a sizzle and a drip.
  'react.melt': (s) => span(
    hiss(s, { kind: 'crackle', a: 0.004, d: 0.45, peak: TUNING.react.sizzle, filt: { type: 'bandpass', f: 2600, to: 900, q: 0.7 } }),
    ...[0.18, 0.34].map((at, i) => tone(s, { f: 700 - i * 120, to: 240, at, a: 0.002, d: 0.1, peak: 0.22 })),
  ),
  // 冻结: the ice crystallises.
  'react.freeze': (s) => span(
    hiss(s, { a: 0.001, d: 0.08, peak: TUNING.react.ice, filt: { type: 'highpass', f: 4000 } }),
    ring(s, { f: 2800, partials: [[1, 1, 0.3], [2.7, 0.6, 0.2], [4.3, 0.3, 0.12]], peak: 0.12 }),
    tone(s, { f: 1400, to: 420, at: 0.02, d: 0.25, peak: 0.16 }),
  ),
  // 感电: a buzz that stutters from rider to rider.
  'react.electro': (s) => span(
    ...[0, 0.05, 0.1, 0.16, 0.21].map((at, i) => fm(s, { f: 1500 - i * 90, to: 2600, ratio: 5, index: [6, 0.5], at, d: 0.05, peak: 0.16 })),
    hiss(s, { a: 0.001, d: 0.05, peak: TUNING.react.zap, filt: { type: 'highpass', f: 3000 } }),
    tone(s, { f: 200, to: 70, d: 0.2, peak: 0.25 }),
  ),
  // 超导: the shield shatters and the current freezes it.
  'react.superconduct': (s) => span(
    hiss(s, { kind: 'crackle', a: 0.001, d: 0.2, peak: TUNING.react.shatter, filt: { type: 'highpass', f: 2600 } }),
    ring(s, { f: 3600, partials: [[1, 1, 0.2], [2.4, 0.6, 0.14]], peak: 0.18 }),
    fm(s, { f: 2200, to: 900, ratio: 3, index: [3, 0.4], at: 0.04, d: 0.25, peak: 0.2 }),
    tone(s, { f: 160, to: 60, d: 0.25, peak: 0.4 }),
  ),
  // 超载: it blows up.
  'react.overload': (s) => span(
    tone(s, { f: 130, to: 40, d: 0.55, peak: TUNING.react.boom }),
    hiss(s, { kind: 'brown', a: 0.005, d: 0.6, peak: 0.7, filt: { type: 'lowpass', f: 500 } }),
    hiss(s, { d: 0.08, peak: 0.35, filt: { type: 'highpass', f: 3000 } }),
  ),
  // 扩散: the aura swirls out to the riders around.
  'react.swirl': (s) => span(
    hiss(s, { kind: 'pink', a: 0.06, d: 0.55, peak: TUNING.react.swirl, filt: { type: 'bandpass', f: 400, to: 2600, q: 2.4 } }),
    tone(s, { type: 'sine', f: 200, to: 700, a: 0.06, d: 0.5, peak: 0.18 }),
  ),
};

/** Every r6 skill sound, keyed 'skill.<id>' (+ '.hit' / '.end'). */
export const SKILL_R6_SFX: Record<string, SfxFn> = {
  ...fire, ...ice, ...thunder, ...water, ...wind, ...gag, ...meme, ...ult,
};

/** The sting of every element reaction, keyed 'react.<reaction>'. */
export const REACT_SFX: Record<string, SfxFn> = react;
