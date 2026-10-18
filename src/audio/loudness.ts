// Loudness and band-energy analysis for offline renders (audio-check): ITU-R BS.1770 / EBU R128
// integrated loudness (K-weighting, 400 ms blocks, absolute + relative gating) and the energy
// share of a frequency band (cascaded 2nd-order Butterworth high-pass / low-pass).

type Coeffs = [number, number, number, number, number]; // b0 b1 b2 a1 a2 (a0 = 1)

function biquad(x: Float32Array, [b0, b1, b2, a1, a2]: Coeffs): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i] ?? 0;
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    y[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return y;
}

/** BS.1770 stage 1 (high shelf, +4 dB above ~1.7 kHz) and stage 2 (RLB high-pass ~38 Hz), any rate. */
function kWeights(fs: number): [Coeffs, Coeffs] {
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Coeffs = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const hp: Coeffs = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0];
  return [shelf, hp];
}

/** Integrated loudness (LUFS) of a (stereo) buffer, skipping the first `skip` seconds. */
export function lufs(buf: AudioBuffer, skip = 0): number {
  const fs = buf.sampleRate;
  const [shelf, hp] = kWeights(fs);
  const from = Math.floor(skip * fs);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => biquad(biquad(buf.getChannelData(c).subarray(from), shelf), hp));
  const block = Math.floor(0.4 * fs);
  const hop = Math.floor(0.1 * fs);
  const powers: number[] = [];
  for (let i = 0; i + block <= (chans[0]?.length ?? 0); i += hop) {
    let z = 0;
    for (const ch of chans) {
      let s = 0;
      for (let j = i; j < i + block; j++) s += (ch[j] ?? 0) * (ch[j] ?? 0);
      z += s / block;
    }
    powers.push(z);
  }
  const loud = (p: number): number => -0.691 + 10 * Math.log10(p || 1e-12);
  const abs = powers.filter((p) => loud(p) > -70);
  if (!abs.length) return -70;
  const rel = loud(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((p) => loud(p) > rel);
  return +loud(gated.reduce((a, b) => a + b, 0) / (gated.length || 1)).toFixed(2);
}

function butter(fs: number, f: number, type: 'lp' | 'hp'): Coeffs {
  const K = Math.tan((Math.PI * f) / fs);
  const Q = Math.SQRT1_2;
  const a0 = 1 + K / Q + K * K;
  const a1 = (2 * (K * K - 1)) / a0;
  const a2 = (1 - K / Q + K * K) / a0;
  return type === 'lp' ? [(K * K) / a0, (2 * K * K) / a0, (K * K) / a0, a1, a2] : [1 / a0, -2 / a0, 1 / a0, a1, a2];
}

/** Mono mix of a buffer (from `skip` s on). */
export function mono(buf: AudioBuffer, skip = 0): Float32Array {
  const from = Math.floor(skip * buf.sampleRate);
  const out = new Float32Array(buf.length - from);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) + (d[i + from] ?? 0) / buf.numberOfChannels;
  }
  return out;
}

/** Energy of `x` between lo and hi Hz (4th-order band: two HP + two LP sections). */
export function bandEnergy(x: Float32Array, fs: number, lo: number, hi: number): number {
  const hp = butter(fs, lo, 'hp');
  const lp = butter(fs, hi, 'lp');
  const y = biquad(biquad(biquad(biquad(x, hp), hp), lp), lp);
  let s = 0;
  for (const v of y) s += v * v;
  return s;
}

/** In-place iterative radix-2 FFT (re / im of length 2^k). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const xr = (re[b] ?? 0) * wr - (im[b] ?? 0) * wi;
        const xi = (re[b] ?? 0) * wi + (im[b] ?? 0) * wr;
        re[b] = (re[a] ?? 0) - xr; im[b] = (im[a] ?? 0) - xi;
        re[a] = (re[a] ?? 0) + xr; im[a] = (im[a] ?? 0) + xi;
      }
    }
  }
}

/** Energy share (0..1) of each [lo, hi) band in `x`: averaged Hann-windowed 8192-point spectra. */
export function bandShares(x: Float32Array, fs: number, bands: Array<[number, number]>): number[] {
  const n = 8192;
  const spec = new Float64Array(n / 2 + 1);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i + n <= x.length; i += n / 2) {
    for (let k = 0; k < n; k++) {
      re[k] = (x[i + k] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1)));
      im[k] = 0;
    }
    fft(re, im);
    for (let k = 0; k <= n / 2; k++) spec[k] = (spec[k] ?? 0) + (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
  }
  const total = spec.reduce((s, v) => s + v, 0) || 1;
  return bands.map(([lo, hi]) => {
    let s = 0;
    for (let k = 0; k <= n / 2; k++) {
      const f = (k * fs) / n;
      if (f >= lo && f < hi) s += spec[k] ?? 0;
    }
    return s / total;
  });
}

/**
 * EBU R128 / Tech 3342 loudness range (LU) of a buffer: short-term loudness (3 s windows, 1 s hop,
 * K-weighted), absolute gate −70 LUFS, relative gate −20 LU, then the 10th → 95th percentile spread.
 */
export function lra(buf: AudioBuffer, skip = 0): number {
  const fs = buf.sampleRate;
  const [shelf, hp] = kWeights(fs);
  const from = Math.floor(skip * fs);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => biquad(biquad(buf.getChannelData(c).subarray(from), shelf), hp));
  const win = 3 * fs;
  const loud: number[] = [];
  for (let i = 0; i + win <= (chans[0]?.length ?? 0); i += fs) {
    let z = 0;
    for (const ch of chans) {
      let s = 0;
      for (let j = i; j < i + win; j++) s += (ch[j] ?? 0) * (ch[j] ?? 0);
      z += s / win;
    }
    loud.push(-0.691 + 10 * Math.log10(z || 1e-12));
  }
  const abs = loud.filter((l) => l > -70);
  if (abs.length < 2) return 0;
  const mean = 10 * Math.log10(abs.reduce((a, l) => a + Math.pow(10, l / 10), 0) / abs.length);
  const gated = abs.filter((l) => l > mean - 20).sort((a, b) => a - b);
  const at = (p: number): number => gated[Math.min(gated.length - 1, Math.floor(p * (gated.length - 1)))] ?? 0;
  return +(at(0.95) - at(0.1)).toFixed(2);
}
