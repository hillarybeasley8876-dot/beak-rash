// Pre-mixes notes from a note bank (bank.ts) into one stereo buffer, so a whole chord / stab plays
// as one buffer source: each note resampled to pitch (linear interpolation, as a buffer source
// would), panned (equal power, unity per channel at the centre like an up-mixed mono voice),
// started at its offset, and released at `off` over `release` s (the live voices' exponential-
// looking fall), optionally bending down during the release (brass falls). All-centred notes mix
// to a mono buffer (half the work downstream).
import { FLOOR } from '../../dsp/env';

export interface MixNote {
  buf: AudioBuffer;
  /** Playback rate: the bend from the zone's sample pitch to the note (detune included). Samples
   *  rendered at another rate (a low-passed pad at half rate) are resampled on top of it. */
  rate: number;
  gain: number;
  /** −1 (left) … 1 (right). */
  pan: number;
  /** Offset (s) from the start of the mix (rolled chords). */
  at?: number;
}

export interface MixOpts {
  /** Note-off (s from the start of the mix). */
  off: number;
  release: number;
  /** Semitones the notes fall over the release (0 = none). */
  fall?: number;
}

export function premix(notes: MixNote[], o: MixOpts, sampleRate: number): AudioBuffer {
  const sr = sampleRate;
  const len = Math.ceil((o.off + o.release + 0.01) * sr);
  const mono = notes.every((n) => n.pan === 0);
  const out = new AudioBuffer({ length: len, numberOfChannels: mono ? 1 : 2, sampleRate: sr });
  const left = out.getChannelData(0);
  const right = mono ? null : out.getChannelData(1);
  const off = o.off * sr;
  const rel = Math.max(1, o.release * sr);
  const k = Math.log(FLOOR);
  for (const n of notes) {
    const src = n.buf.getChannelData(0);
    const x = ((Math.max(-1, Math.min(1, n.pan)) + 1) / 2) * (Math.PI / 2);
    const gl = mono ? n.gain : Math.cos(x) * Math.SQRT2 * n.gain;
    const gr = Math.sin(x) * Math.SQRT2 * n.gain;
    const start = Math.max(0, Math.round((n.at ?? 0) * sr));
    const step = n.rate * (n.buf.sampleRate / sr);
    let pos = 0;
    for (let i = start; i < len; i++) {
      const u = i < off ? 0 : Math.min(1, (i - off) / rel);
      const p = Math.floor(pos);
      if (p + 1 >= src.length || u >= 1) break;
      const a = src[p] ?? 0;
      const v = (a + ((src[p + 1] ?? 0) - a) * (pos - p)) * (u === 0 ? 1 : Math.exp(k * u));
      left[i] = (left[i] ?? 0) + v * gl;
      if (right) right[i] = (right[i] ?? 0) + v * gr;
      pos += o.fall && u > 0 ? step * Math.pow(2, (-o.fall * u) / 12) : step;
    }
  }
  return out;
}
