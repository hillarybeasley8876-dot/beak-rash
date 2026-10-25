// Loop-level tone, image and dynamics analysis for tools/audio-check.mjs: one full pass of a song's
// loop rendered through the real graph (glue compressor on, as in the game). Octave balance
// relative to the 125 Hz octave, stereo width (side / mid energy, L/R correlation), EBU loudness
// range, per-section levels and the breakdown / build shape of section D.
import { AUDIO_RATE, Engine } from './engine';
import { DEFAULT_VOLUMES } from './check';
import { bandEnergy, bandShares, lra } from './loudness';
import { Conductor } from './music/conductor';
import { SONGS } from './music/songs';

export const OCTAVES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 14000];

export interface ToneReport {
  id: string;
  seconds: number;
  /** dB per octave centre relative to the 125 Hz octave. */
  octaves: Record<string, number>;
  /** Side / mid energy (dB) and L/R correlation over the loop; also above 200 Hz (the low end is mono by design). */
  sideMid: number;
  corr: number;
  sideMidHigh: number;
  /** EBU R128 loudness range (LU). */
  lra: number;
  sections: Array<{ name: string; db: number }>;
  /** Section D: its first 4 bars vs B2 (dB), and the level of each build bar (5–8). */
  breakdown: { dropDb: number; build: number[] } | null;
}

const db = (power: number): number => +(10 * Math.log10(power || 1e-12)).toFixed(1);

/** Mean power of the mid signal between two times (s). */
function power(l: Float32Array, r: Float32Array, a: number, b: number): number {
  const i0 = Math.max(0, Math.floor(a * AUDIO_RATE));
  const i1 = Math.min(l.length, Math.floor(b * AUDIO_RATE));
  let s = 0;
  for (let i = i0; i < i1; i++) s += (((l[i] ?? 0) + (r[i] ?? 0)) / 2) ** 2;
  return s / Math.max(1, i1 - i0);
}

/**
 * Render one pass of the loop (form index loopFrom → end) and analyse it. `stretch`: the final-stretch
 * form instead (intensity 2 from the loop start: one bar, the build bar, then the stretch sections,
 * analysed from the stretch's first bar; no section / breakdown shape).
 */
export async function tone(id: string, stretch = false): Promise<ToneReport> {
  const song = SONGS[id];
  if (!song) throw new Error(`[audio] unknown song ${id}`);
  const bar = (60 / song.bpm) * 4;
  const form = stretch ? [] : song.form.slice(song.loopFrom);
  const bars = form.map((name) => song.sections[name]?.bars ?? 0);
  const lifted = (song.stretch ?? []).reduce((a, name) => a + (song.sections[name]?.bars ?? 0), 0) * (bar / (song.lift?.tempo ?? 1));
  const skip = stretch ? 2 * bar : 0;
  const seconds = stretch ? skip + lifted : bars.reduce((a, b) => a + b, 0) * bar;
  const ctx = new OfflineAudioContext(2, Math.floor(AUDIO_RATE * (seconds + 0.5)), AUDIO_RATE);
  const c = new Conductor(new Engine(ctx, DEFAULT_VOLUMES));
  c.play(id, 0.02, { at: 0, section: song.loopFrom });
  if (stretch) c.setIntensity(2);
  c.schedule(0.8);
  for (let t = 0.5; t < seconds; t += 0.5) {
    void ctx.suspend(t).then(() => {
      c.schedule(t + 0.8);
      return ctx.resume();
    });
  }
  const all = await ctx.startRendering();
  const buf = new AudioBuffer({ length: all.length - Math.floor(skip * AUDIO_RATE), numberOfChannels: 2, sampleRate: AUDIO_RATE });
  for (let ch = 0; ch < 2; ch++) buf.copyToChannel(all.getChannelData(ch).subarray(Math.floor(skip * AUDIO_RATE)), ch);
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  const mid = new Float32Array(l.length);
  const side = new Float32Array(l.length);
  let mm = 0, ss = 0, lr = 0, ll = 0, rr = 0;
  for (let i = 0; i < l.length; i++) {
    const a = l[i] ?? 0, b = r[i] ?? 0;
    mid[i] = (a + b) / 2;
    side[i] = (a - b) / 2;
    mm += ((a + b) / 2) ** 2;
    ss += ((a - b) / 2) ** 2;
    lr += a * b; ll += a * a; rr += b * b;
  }
  const shares = bandShares(mid, AUDIO_RATE, OCTAVES.map((f) => [f / Math.SQRT2, Math.min(f * Math.SQRT2, AUDIO_RATE / 2 - 1)]));
  const ref = shares[OCTAVES.indexOf(125)] ?? 1;
  const octaves: Record<string, number> = {};
  OCTAVES.forEach((f, k) => { octaves[String(f)] = db((shares[k] ?? 0) / ref); });
  const starts: number[] = [];
  bars.reduce((t, n) => { starts.push(t); return t + n * bar; }, 0);
  const sections = form.map((name, k) => ({ name, db: db(power(l, r, starts[k] ?? 0, (starts[k] ?? 0) + (bars[k] ?? 0) * bar)) }));
  const d = form.indexOf('D');
  const b2 = form.indexOf('B2');
  let breakdown: ToneReport['breakdown'] = null;
  if (d >= 0 && b2 >= 0) {
    const t0 = starts[d] ?? 0;
    const tB = starts[b2] ?? 0;
    const drop = db(power(l, r, t0, t0 + 4 * bar) / power(l, r, tB, tB + (bars[b2] ?? 8) * bar));
    const build = [4, 5, 6, 7].map((k) => db(power(l, r, t0 + k * bar, t0 + (k + 1) * bar)));
    breakdown = { dropDb: drop, build };
  }
  return {
    id, seconds: +seconds.toFixed(1), octaves,
    sideMid: db(ss / (mm || 1e-12)), corr: +(lr / Math.sqrt(ll * rr || 1e-12)).toFixed(2),
    sideMidHigh: db(bandEnergy(side, AUDIO_RATE, 200, 15000) / (bandEnergy(mid, AUDIO_RATE, 200, 15000) || 1e-12)),
    lra: lra(buf, 0), sections, breakdown,
  };
}
