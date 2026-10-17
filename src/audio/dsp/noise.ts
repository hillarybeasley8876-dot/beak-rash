// Shared noise / texture buffers, generated once per audio context (WeakMap cache) from a fixed
// seed. Sources start at an offset drawn from the caller's Rng (per player), so bursts differ
// while offline renders stay reproducible.
import { Rng } from '../../core/rng';

export type NoiseKind = 'white' | 'pink' | 'brown' | 'crackle';

const cache = new WeakMap<BaseAudioContext, Map<NoiseKind, AudioBuffer>>();

function build(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  const seconds = kind === 'crackle' ? 6 : 2.5;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const rng = new Rng(0x5eed + ch * 977 + kind.length * 31);
    const d = buf.getChannelData(ch);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = rng.next() * 2 - 1;
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = rng.next() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (rng.next() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
    } else {
      // Vinyl: soft filtered hiss + sparse dust clicks of random size + rare pops.
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.08 * ((rng.next() * 2 - 1) - lp);
        d[i] = lp * 0.05;
      }
      const clicks = Math.floor(seconds * 38);
      for (let k = 0; k < clicks; k++) {
        const at = rng.int(0, len - 64);
        const amp = (rng.chance(0.08) ? 0.6 : 0.18) * rng.range(0.3, 1) * (rng.chance(0.5) ? 1 : -1);
        const width = rng.int(3, rng.chance(0.1) ? 40 : 12);
        for (let j = 0; j < width; j++) d[at + j] = (d[at + j] ?? 0) + amp * Math.exp(-j / (width * 0.35));
      }
      // Seamless loop: fade both ends a little so the wrap point never clicks.
      const fade = Math.floor(ctx.sampleRate * 0.01);
      for (let i = 0; i < fade; i++) {
        const g = i / fade;
        d[i] = (d[i] ?? 0) * g;
        d[len - 1 - i] = (d[len - 1 - i] ?? 0) * g;
      }
    }
  }
  return buf;
}

export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let byKind = cache.get(ctx);
  if (!byKind) {
    byKind = new Map();
    cache.set(ctx, byKind);
  }
  let buf = byKind.get(kind);
  if (!buf) {
    buf = build(ctx, kind);
    byKind.set(kind, buf);
  }
  return buf;
}

/** A noise source started at `t` (buffer offset from `rng`). Loops when `dur` is null. */
export function noise(ctx: BaseAudioContext, kind: NoiseKind, t: number, dur: number | null, rng: Rng, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.playbackRate.value = rate;
  const offset = rng.next() * (src.buffer.duration - 0.6);
  if (dur === null) {
    src.loop = true;
    src.start(t, offset);
  } else {
    src.start(t, offset);
    src.stop(t + dur + 0.02);
  }
  return src;
}
