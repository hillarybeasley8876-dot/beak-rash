// Offline render analysis for tools/audio-check.mjs and the sandbox: renders songs, stingers and
// sfx through the real mixing graph in an OfflineAudioContext and measures level, clipping,
// discontinuities, dropouts, low-end share and render cost (≈ audio-thread CPU).
import { AUDIO_RATE, Engine, type Volumes } from './engine';
import { Conductor } from './music/conductor';
import { SONGS } from './music/songs';
import { SFX, SfxPlayer } from './sfx/bank';
import type { StingerId } from './music/stingers';
import type { Channel } from './music/types';

export interface RenderStats {
  id: string;
  seconds: number;
  peakDb: number;
  rmsDb: number;
  clipped: number;      // samples at/above 0 dBFS
  clicks: number;       // isolated 2nd-difference spikes (discontinuities), see countClicks
  maxStep: number;
  dropouts: number;     // 100 ms windows below −55 dBFS after the first second
  lowShare: number;     // energy share below ~150 Hz (kick + bass balance)
  renderMs: number;
  cpuPct: number;       // render time / audio time × 100 (raw, includes offline suspend overhead)
  cpuNet: number;       // cpuPct minus an empty render with the same suspend pattern ≈ realtime audio cost
}

/** Same rate the game's realtime context uses (see engine.ts AUDIO_RATE). */
const SR = AUDIO_RATE;
export const DEFAULT_VOLUMES: Volumes = { master: 0.9, music: 0.7, sfx: 0.9, voice: 0.9 };

const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -120);

/**
 * Click detector: a discontinuity is an isolated spike in the 2nd difference far above the local
 * (±10 ms) 2nd-difference RMS. Noise bursts and filtered oscillator edges raise the local RMS
 * along with their spikes, so musical content does not trigger it.
 */
export function countClicks(mono: Float32Array, sr: number): number {
  const n = mono.length;
  const half = Math.floor(sr * 0.01);
  const d2 = new Float32Array(n);
  for (let i = 2; i < n; i++) d2[i] = (mono[i] ?? 0) - 2 * (mono[i - 1] ?? 0) + (mono[i - 2] ?? 0);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = (pre[i] ?? 0) + (d2[i] ?? 0) * (d2[i] ?? 0);
  let clicks = 0;
  let last = -sr;
  for (let i = half; i < n - half; i++) {
    const a = Math.abs(d2[i] ?? 0);
    if (a < 0.03) continue;
    const rms = Math.sqrt(((pre[i + half + 1] ?? 0) - (pre[i - half] ?? 0)) / (2 * half + 1));
    if (a > 25 * rms && i - last > sr * 0.005) {
      clicks++;
      last = i;
    }
  }
  return clicks;
}

export function analyse(id: string, buf: AudioBuffer, renderMs: number, skipStart = 1): RenderStats {
  const len = buf.length;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const monoBuf = new Float32Array(len);
  let peak = 0, sum = 0, clipped = 0, maxStep = 0, low = 0, lp = 0, dropouts = 0;
  const a = 1 - Math.exp((-2 * Math.PI * 150) / buf.sampleRate);
  const win = Math.floor(buf.sampleRate * 0.1);
  let winSum = 0;
  for (let i = 0; i < len; i++) {
    let mono = 0;
    for (const d of chans) {
      const x = d[i] ?? 0;
      const ax = Math.abs(x);
      if (ax > peak) peak = ax;
      if (ax >= 1) clipped++;
      const step = Math.abs(x - (d[i - 1] ?? 0));
      if (i > 0 && step > maxStep) maxStep = step;
      mono += x / chans.length;
    }
    monoBuf[i] = mono;
    sum += mono * mono;
    lp += a * (mono - lp);
    low += lp * lp;
    winSum += mono * mono;
    if ((i + 1) % win === 0) {
      if (i / buf.sampleRate > skipStart && Math.sqrt(winSum / win) < 0.0018) dropouts++;
      winSum = 0;
    }
  }
  const seconds = len / buf.sampleRate;
  return {
    id, seconds, peakDb: +db(peak).toFixed(2), rmsDb: +db(Math.sqrt(sum / len)).toFixed(2), clipped,
    clicks: countClicks(monoBuf, buf.sampleRate),
    maxStep: +maxStep.toFixed(3), dropouts, lowShare: +(low / (sum || 1)).toFixed(3),
    renderMs: Math.round(renderMs), cpuPct: +((renderMs / (seconds * 1000)) * 100).toFixed(2), cpuNet: 0,
  };
}

/**
 * Render with the realtime lookahead pattern: suspend every 100 ms and schedule only the next
 * 250 ms, so the graph holds as many live nodes as it would in the game (cost ≈ audio CPU).
 */
async function renderOnce(
  seconds: number, setup: (engine: Engine) => ((until: number) => void) | void,
): Promise<{ buf: AudioBuffer; ms: number }> {
  const ctx = new OfflineAudioContext(2, Math.floor(SR * seconds), SR);
  const engine = new Engine(ctx, DEFAULT_VOLUMES);
  const pump = setup(engine);
  if (pump) {
    pump(0.25);
    for (let t = 0.1; t < seconds - 0.05; t += 0.1) {
      void ctx.suspend(t).then(() => {
        pump(t + 0.25);
        return ctx.resume();
      });
    }
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return { buf, ms: performance.now() - t0 };
}

const baselines = new Map<number, number>();

/** Cost of an empty graph with the same suspend/resume pattern (min of 3), cached per length. */
async function baselineMs(seconds: number): Promise<number> {
  const hit = baselines.get(seconds);
  if (hit !== undefined) return hit;
  let best = Infinity;
  for (let k = 0; k < 3; k++) best = Math.min(best, (await renderOnce(seconds, () => () => undefined)).ms);
  baselines.set(seconds, best);
  return best;
}

/** Render (best of `runs` for timing, the machine is shared) and analyse. */
async function render(
  id: string, seconds: number, setup: (engine: Engine) => ((until: number) => void) | void, skipStart = 1, runs = 1,
): Promise<RenderStats> {
  let best: { buf: AudioBuffer; ms: number } | null = null;
  for (let k = 0; k < runs; k++) {
    const r = await renderOnce(seconds, setup);
    if (!best || r.ms < best.ms) best = r;
  }
  if (!best) throw new Error('[audio] render produced nothing');
  const stats = analyse(id, best.buf, best.ms, skipStart);
  stats.cpuNet = +Math.max(0, ((best.ms - (await baselineMs(seconds))) / (seconds * 1000)) * 100).toFixed(2);
  return stats;
}

/** Render `seconds` of a song from section `section` (default: start of the form). */
export function renderSong(id: string, seconds: number, opts: { section?: number; intensity?: number } = {}): Promise<RenderStats> {
  if (!SONGS[id]) throw new Error(`[audio] unknown song ${id}`);
  return render(`${id}${opts.section ? `@${opts.section}` : ''}${opts.intensity ? `+i${opts.intensity}` : ''}`, seconds, (engine) => {
    const c = new Conductor(engine);
    c.play(id, 0.02, { at: 0, section: opts.section });
    if (opts.intensity) c.setIntensity(opts.intensity);
    return (until: number) => c.schedule(until);
  }, 1, 3);
}

/** Seconds from the start of form index `from` to the end of the form (for loop-seam renders). */
export function formSeconds(id: string, from: number): number {
  const song = SONGS[id];
  if (!song) return 0;
  const bars = song.form.slice(from).reduce((s, name) => s + (song.sections[name]?.bars ?? 0), 0);
  return (bars * 4 * 60) / song.bpm;
}

export function renderStinger(id: StingerId): Promise<RenderStats> {
  return render(`sting.${id}`, 3, (engine) => {
    new Conductor(engine).stinger(id, 0.3);
  }, 9);
}

export function songInfo(id: string): { formLength: number; loopFrom: number; adaptive: boolean; bpm: number; form: string[] } {
  const song = SONGS[id];
  if (!song) throw new Error(`[audio] unknown song ${id}`);
  const adaptive = Boolean(song.stretch || song.layers || Object.values(song.sections).some((s) => s.layers));
  return { formLength: song.form.length, loopFrom: song.loopFrom, adaptive, bpm: song.bpm, form: song.form };
}

/** Render one sfx (centred, default volume) for `seconds` through the full graph. */
export function renderSfx(id: string, seconds = 2.5): Promise<RenderStats> {
  return render(`sfx.${id}`, seconds, (engine) => {
    new SfxPlayer(engine).play(id);
  }, seconds);
}

/** Every registered sfx, in order (for tools/audio-check.mjs). */
export async function renderAllSfx(): Promise<RenderStats[]> {
  const out: RenderStats[] = [];
  for (const id of Object.keys(SFX)) out.push(await renderSfx(id, id.startsWith('skill.capybara') || id.startsWith('skill.penguin') ? 3 : 2.5));
  return out;
}

/** The raw render of a song (the window analysis below needs the samples, not the stats). */
export async function renderSongBuffer(
  id: string, seconds: number, opts: { section?: number; intensity?: number; mix?: Partial<Record<Channel, number>> } = {},
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.floor(SR * seconds), SR);
  const engine = new Engine(ctx, DEFAULT_VOLUMES);
  const c = new Conductor(engine);
  c.play(id, 0.02, { at: 0, section: opts.section, mix: opts.mix });
  if (opts.intensity) c.setIntensity(opts.intensity);
  c.schedule(0.25);
  for (let t = 0.1; t < seconds - 0.05; t += 0.1) {
    void ctx.suspend(t).then(() => {
      c.schedule(t + 0.25);
      return ctx.resume();
    });
  }
  return ctx.startRendering();
}

/** The RMS (dB) of every 100 ms window of a song render: where a section goes quiet. */
export async function songWindows(
  id: string, seconds: number, opts: { section?: number; intensity?: number; mix?: Partial<Record<Channel, number>> } = {},
): Promise<number[]> {
  const buf = await renderSongBuffer(id, seconds, opts);
  const win = Math.floor(SR * 0.1);
  const out: number[] = [];
  for (let i = 0; i + win <= buf.length; i += win) {
    // The mono mix, like the dropout check (check.ts analyse): a decorrelated pair is quieter.
    let e = 0;
    for (let j = i; j < i + win; j++) {
      const l = buf.getChannelData(0)[j] ?? 0;
      const r = buf.getChannelData(1)[j] ?? 0;
      e += ((l + r) / 2) ** 2;
    }
    out.push(+(10 * Math.log10(e / win + 1e-12)).toFixed(1));
  }
  return out;
}
