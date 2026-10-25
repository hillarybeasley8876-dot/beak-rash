// Drum hits rendered once per context into sample buffers (JS synthesis from a fixed seed): the
// noise hits use the same filters and envelopes the live noise voices had; hats, ride and crash
// add an 808-style metallic layer (six band-limited squares at inharmonic ratios, band-passed)
// over their noise sizzle. Panned hits are stereo (decorrelated left / right, like the stereo
// noise the live voices used: same loudness, wider air). A hit is then one buffer source + gain,
// alive only while it sounds (no persistent filter chains).
import { Rng } from '../../../core/rng';
import { addSquare, biquad, glide, mixInto, percEnv, rms, shapeEnv, whiteNoise } from '../../dsp/render';

export type DrumSample =
  | 'kick' | 'tom1' | 'tom2' | 'tom3' | 'rim' | 'snare' | 'snareGhost' | 'clap' | 'shaker' | 'tamb' | 'hat' | 'hatOpen'
  | 'ride' | 'crash' | 'cowbell' | 'slapPop' | 'slapThumb' | 'slapDead' | 'clavMute';

/** The 808 cymbal oscillators (Hz); scaled per cymbal. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];

interface Recipe {
  seconds: number;
  stereo?: boolean;
  /** Takes with different noise / phases, rotated per hit so repeats never sound identical. */
  takes?: number;
  /** One channel of the hit at unit level (the live voice's VCA peak becomes the hit's gain). */
  build(sr: number, len: number, rng: Rng): Float32Array;
}

const noiseHit = (filters: Array<[Parameters<typeof biquad>[2], number, number, number?]>, attack: number, decay: number) =>
  (sr: number, len: number, rng: Rng): Float32Array => {
    const x = whiteNoise(len, rng);
    for (const [type, f, q, g] of filters) biquad(x, sr, type, f, q, g ?? 0);
    return percEnv(x, sr, attack, decay);
  };

/** Six squares at METAL × `scale` (random phases), band-passed around `f` Hz. */
function metal(sr: number, len: number, rng: Rng, scale: number, f: number, q: number): Float32Array {
  const x = new Float32Array(len);
  for (const m of METAL) addSquare(x, sr, m * scale, 1 / 6, rng.next());
  biquad(x, sr, 'bandpass', f, q);
  return biquad(x, sr, 'highpass', f * 0.62, 0.7);
}

/** Metal + noise cymbal, calibrated to the RMS the plain-noise version had over `win` s. */
function cymbal(
  sr: number, len: number, rng: Rng,
  o: { noise: Array<[Parameters<typeof biquad>[2], number, number, number?]>; scale: number; band: number; q: number; metal: number; attack: number; decay: number; win: number },
): Float32Array {
  const ref = noiseHit(o.noise, o.attack, o.decay)(sr, len, rng);
  const x = metal(sr, len, rng, o.scale, o.band, o.q);
  const sizzle = noiseHit(o.noise, o.attack, o.decay)(sr, len, rng);
  percEnv(x, sr, o.attack, o.decay * 0.8);
  const n = Math.min(len, Math.round(o.win * sr));
  const metalGain = o.metal / Math.max(1e-9, rms(x, 0, n));
  const blend = mixInto(x.map((v) => v * metalGain), sizzle, (1 - o.metal) / Math.max(1e-9, rms(sizzle, 0, n)));
  const k = rms(ref, 0, n) / Math.max(1e-9, rms(blend, 0, n));
  return blend.map((v) => v * k);
}

type NoiseHit = (sr: number, len: number, rng: Rng) => Float32Array;
const CLICK = noiseHit([['bandpass', 3200, 0.8]], 0.0008, 0.008);
const TOM_CLICK = noiseHit([['bandpass', 3200, 0.8]], 0.001, 0.02);
const WIRES = (decay: number): NoiseHit => noiseHit([['highpass', 1300, 0.7], ['peaking', 4200, 1.2, 3]], 0.0015, decay);

/** A pitched body (glide + envelope) plus a noise layer at `noise` × the body, all × `scale`. */
function drumBody(
  sr: number, len: number, rng: Rng, shape: 'sine' | 'triangle', pitch: Array<[number, number]>,
  attack: number, decay: number, layer: NoiseHit, noise: number, scale = 1,
): Float32Array {
  const x = mixInto(percEnv(glide(len, sr, shape, pitch), sr, attack, decay), layer(sr, len, rng), noise);
  return scale === 1 ? x : x.map((v) => v * scale);
}

const HAT_NOISE: Array<[Parameters<typeof biquad>[2], number, number, number?]> = [['highpass', 7200, 0.6], ['peaking', 10500, 0.9, 0]];
const CRASH_NOISE: Array<[Parameters<typeof biquad>[2], number, number, number?]> = [['highpass', 4200, 0.5], ['peaking', 7600, 0.7, 4]];

const RECIPES: Record<DrumSample, Recipe> = {
  // Kick: the body holds ~35 ms, then rings out over 0.4 s, so its 50–56 Hz fundamental lands (sub weight).
  kick: {
    seconds: 0.44,
    build: (sr, len, rng) => mixInto(
      shapeEnv(glide(len, sr, 'sine', [[0, 150], [0.05, 56], [0.3, 50], [0.42, 47]]), sr, [[0.002, 1, 'lin'], [0.035, 0.88, 'lin'], [0.42, 0.0001, 'exp'], [0.43, 0, 'lin']]),
      CLICK(sr, len, rng), 0.22 / 0.76,
    ),
  },
  tom1: { seconds: 0.36, build: (sr, len, rng) => drumBody(sr, len, rng, 'sine', [[0, 215], [0.18, 165]], 0.002, 0.34, TOM_CLICK, 0.1 / 0.62) },
  tom2: { seconds: 0.4, build: (sr, len, rng) => drumBody(sr, len, rng, 'sine', [[0, 160], [0.18, 122]], 0.002, 0.38, TOM_CLICK, 0.1 / 0.62) },
  tom3: { seconds: 0.44, build: (sr, len, rng) => drumBody(sr, len, rng, 'sine', [[0, 118], [0.18, 86]], 0.002, 0.42, TOM_CLICK, 0.1 / 0.62) },
  rim: { seconds: 0.04, build: (sr, len) => percEnv(glide(len, sr, 'triangle', [[0, 1750]]), sr, 0.0005, 0.03) },
  // Shell (triangle 240 → 180 Hz) + wires; the levels are relative to the wires (the hit's gain).
  snare: { seconds: 0.2, takes: 3, build: (sr, len, rng) => drumBody(sr, len, rng, 'triangle', [[0, 240], [0.04, 180]], 0.001, 0.11, WIRES(0.17), 0.9 / 0.8, 0.8) },
  snareGhost: { seconds: 0.07, takes: 3, build: (sr, len, rng) => drumBody(sr, len, rng, 'triangle', [[0, 240], [0.04, 180]], 0.001, 0.04, WIRES(0.06), 0.24 / 0.12, 0.12 / 0.24) },
  shaker: { seconds: 0.09, stereo: true, takes: 3, build: noiseHit([['bandpass', 5600, 1.4]], 0.012, 0.07) },
  clap: {
    seconds: 0.23, takes: 2,
    build: (sr, len, rng) => shapeEnv(biquad(whiteNoise(len, rng), sr, 'bandpass', 1500, 0.7), sr, [
      [0.001, 1, 'lin'], [0.009, 0.15, 'exp'], [0.012, 1, 'lin'], [0.02, 0.15, 'exp'], [0.023, 1, 'lin'], [0.031, 0.15, 'exp'],
      [0.034, 0.8, 'lin'], [0.22, 0.0001, 'exp'], [0.225, 0, 'lin'],
    ]),
  },
  tamb: {
    seconds: 0.18, stereo: true, takes: 3,
    build: (sr, len, rng) => shapeEnv(biquad(biquad(whiteNoise(len, rng), sr, 'highpass', 5200, 0.7), sr, 'peaking', 8800, 3, 5), sr, [
      [0.001, 1, 'lin'], [0.012, 0.3, 'exp'], [0.017, 0.78, 'lin'], [0.028, 0.3, 'exp'], [0.033, 0.56, 'lin'], [0.044, 0.3, 'exp'],
      [0.17, 0.0001, 'exp'], [0.175, 0, 'lin'],
    ]),
  },
  hat: { seconds: 0.08, stereo: true, takes: 4, build: (sr, len, rng) => cymbal(sr, len, rng, { noise: HAT_NOISE, scale: 1, band: 10000, q: 1.2, metal: 0.6, attack: 0.0012, decay: 0.055, win: 0.04 }) },
  hatOpen: { seconds: 0.34, stereo: true, takes: 2, build: (sr, len, rng) => cymbal(sr, len, rng, { noise: HAT_NOISE, scale: 1, band: 9500, q: 1, metal: 0.6, attack: 0.0012, decay: 0.3, win: 0.2 }) },
  ride: {
    seconds: 0.5, stereo: true, takes: 2,
    build: (sr, len, rng) => {
      const x = cymbal(sr, len, rng, { noise: [['highpass', 6500, 0.6]], scale: 1.9, band: 5200, q: 2.2, metal: 0.45, attack: 0.001, decay: 0.45, win: 0.25 });
      // Bell: three inharmonic partials (the old single 4.63 kHz sine was 27 % of the noise peak).
      for (const [f, level, decay] of [[4630, 0.27, 0.35], [3290, 0.12, 0.4], [6105, 0.1, 0.25]] as const) {
        const b = new Float32Array(len);
        const phase = rng.next() * 2 * Math.PI;
        for (let i = 0; i < len; i++) b[i] = Math.sin((2 * Math.PI * f * i) / sr + phase);
        mixInto(x, percEnv(b, sr, 0.001, decay), level);
      }
      return x;
    },
  },
  // Slap-bass string transients (pop / thumb / dead note), played into the bass channel.
  slapPop: { seconds: 0.02, takes: 2, build: noiseHit([['bandpass', 2700, 1.6]], 0.0008, 0.012) },
  slapThumb: { seconds: 0.02, takes: 2, build: noiseHit([['bandpass', 1400, 1.6]], 0.0008, 0.012) },
  slapDead: { seconds: 0.02, takes: 2, build: noiseHit([['bandpass', 900, 1.6]], 0.0008, 0.012) },
  // Muted clavinet "chicken scratch".
  clavMute: { seconds: 0.035, takes: 2, build: noiseHit([['bandpass', 1700, 1.8]], 0.001, 0.025) },
  // Two-square disco cowbell (lives in 0.5–3 kHz, cuts through a busy mix).
  cowbell: {
    seconds: 0.22,
    build: (sr, len, rng) => {
      const x = new Float32Array(len);
      addSquare(x, sr, 562, 1, rng.next());
      addSquare(x, sr, 845, 1, rng.next());
      return percEnv(biquad(x, sr, 'bandpass', 1700, 1.1), sr, 0.001, 0.2);
    },
  },
  crash: { seconds: 2.0, stereo: true, build: (sr, len, rng) => cymbal(sr, len, rng, { noise: CRASH_NOISE, scale: 1.6, band: 7000, q: 0.8, metal: 0.45, attack: 0.002, decay: 1.9, win: 0.3 }) },
};

/** Sample data and AudioBuffers per sample rate (synthesized once per page; a buffer plays in any
 *  context, so bar renders do not copy every sample again). */
const data = new Map<string, Float32Array[]>();
const buffers = new Map<string, AudioBuffer>();

/** FNV-1a: a stable seed per sample name. */
function seedOf(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function takesOf(kind: DrumSample): number {
  return RECIPES[kind].takes ?? 1;
}

function channels(sr: number, kind: DrumSample, take: number): Float32Array[] {
  const key = `${sr}:${kind}#${take}`;
  let chans = data.get(key);
  if (!chans) {
    const r = RECIPES[kind];
    const len = Math.ceil(r.seconds * sr);
    chans = Array.from({ length: r.stereo ? 2 : 1 }, (_, ch) => r.build(sr, len, new Rng(seedOf(`${kind}#${take}/${ch}`))));
    data.set(key, chans);
  }
  return chans;
}

/** Take `take` of the sample `kind` at this context's rate (built on first use, shared by every band). */
export function drumSample(ctx: BaseAudioContext, kind: DrumSample, take = 0): AudioBuffer {
  const n = take % takesOf(kind);
  const key = `${ctx.sampleRate}:${kind}#${n}`;
  let buf = buffers.get(key);
  if (!buf) {
    const chans = channels(ctx.sampleRate, kind, n);
    const b = new AudioBuffer({ length: chans[0]?.length ?? 1, numberOfChannels: chans.length, sampleRate: ctx.sampleRate });
    chans.forEach((c, ch) => b.getChannelData(ch).set(c));
    buffers.set(key, b);
    buf = b;
  }
  return buf;
}

/** One hit: a buffer source of `kind` (take `take`) → gain `level` → `dest`, from `t`. Returns the gain. */
export function playSample(ctx: BaseAudioContext, kind: DrumSample, take: number, t: number, level: number, dest: AudioNode): GainNode {
  const src = new AudioBufferSourceNode(ctx, { buffer: drumSample(ctx, kind, take) });
  const g = new GainNode(ctx, { gain: level });
  src.connect(g).connect(dest);
  src.start(t);
  return g;
}

/** Synthesize every take up front (boot), so the first hats / crash of a song cost no main-thread time. */
export function prepareDrumSamples(ctx: BaseAudioContext): void {
  for (const kind of Object.keys(RECIPES) as DrumSample[]) {
    for (let take = 0; take < takesOf(kind); take++) drumSample(ctx, kind, take);
  }
}
