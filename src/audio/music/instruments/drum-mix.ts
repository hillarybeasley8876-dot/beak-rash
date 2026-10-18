// Pre-mixes a bar of drum hits into one stereo buffer: one buffer source per bar instead of one
// source + gain per hit (graph changes are what cost the realtime audio thread). Same samples,
// takes, levels and pan law as the per-hit path: StereoPannerNode's equal-power law for mono and
// stereo inputs, centred mono hits on both channels at full level (how WebAudio up-mixes them).
import { drumSample, type DrumSample } from './drum-samples';

export interface BarHit {
  kind: DrumSample;
  take: number;
  /** Audio time of the hit. */
  at: number;
  level: number;
  pan: number;
  /** An open hat closed by the next hat (8 ms fade from this time). */
  chokeAt?: number;
}

const CHOKE = 0.008;

/** Output gains [inL→L, inR→L, inL→R, inR→R] of a hit at `pan` (mono hits use the inL column). */
function panMatrix(pan: number, stereo: boolean): [number, number, number, number] {
  if (pan === 0) return stereo ? [1, 0, 0, 1] : [1, 0, 1, 0];
  if (!stereo) {
    const x = ((pan + 1) / 2) * (Math.PI / 2);
    return [Math.cos(x), 0, Math.sin(x), 0];
  }
  const x = (pan <= 0 ? pan + 1 : pan) * (Math.PI / 2);
  return pan <= 0 ? [1, Math.cos(x), 0, Math.sin(x)] : [Math.cos(x), 0, Math.sin(x), 1];
}

/** Mix `hits` into a stereo buffer that starts at audio time `start` (null when there are none). */
export function mixBar(ctx: BaseAudioContext, hits: BarHit[], start: number): AudioBuffer | null {
  if (!hits.length) return null;
  const sr = ctx.sampleRate;
  const sources = hits.map((h) => drumSample(ctx, h.kind, h.take));
  let len = 1;
  hits.forEach((h, i) => {
    len = Math.max(len, Math.max(0, Math.round((h.at - start) * sr)) + (sources[i]?.length ?? 0));
  });
  const out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: sr });
  const left = out.getChannelData(0);
  const right = out.getChannelData(1);
  hits.forEach((h, i) => {
    const buf = sources[i];
    if (!buf) return;
    const stereo = buf.numberOfChannels > 1;
    const in0 = buf.getChannelData(0);
    const in1 = stereo ? buf.getChannelData(1) : in0;
    const [ll, rl, lr, rr] = panMatrix(h.pan, stereo);
    const off = Math.max(0, Math.round((h.at - start) * sr));
    const fadeFrom = h.chokeAt === undefined ? Infinity : Math.max(0, Math.round((h.chokeAt - h.at) * sr));
    const fadeLen = Math.max(1, Math.round(CHOKE * sr));
    const n = Math.min(buf.length, len - off, fadeFrom + fadeLen);
    for (let j = 0; j < n; j++) {
      const g = j < fadeFrom ? h.level : h.level * (1 - (j - fadeFrom) / fadeLen);
      const a = (in0[j] ?? 0) * g;
      const b = (in1[j] ?? 0) * g;
      left[off + j] = (left[off + j] ?? 0) + a * ll + b * rl;
      right[off + j] = (right[off + j] ?? 0) + a * lr + b * rr;
    }
  });
  return out;
}
