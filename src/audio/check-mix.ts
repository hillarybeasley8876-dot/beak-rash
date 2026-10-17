// Offline mix analysis for tools/audio-check.mjs: stem loudness against the full mix (solo renders,
// glue compressor bypassed so stems add up), low-end / upper-mid energy shares, and whether a
// song's hook clears the rest of the music plus the player's bike at race speed.
import { AUDIO_RATE, Engine } from './engine';
import { DEFAULT_VOLUMES } from './check';
import { bandEnergy, bandShares, lufs, mono } from './loudness';
import { Conductor } from './music/conductor';
import { BikeLoops } from './sfx/loops';
import type { Channel } from './music/types';

export const STEMS: Channel[] = ['drums', 'bass', 'keys', 'clav', 'brass', 'lead', 'pad'];
const MUTE = 1e-6;

interface MixOpts { section?: number; intensity?: number; mix?: Partial<Record<Channel, number>>; bike?: number }

/** Render `seconds` of a song through the real graph (no glue comp), optionally with the bike loops at `bike` m/s. */
async function renderMix(id: string, seconds: number, opts: MixOpts): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.floor(AUDIO_RATE * seconds), AUDIO_RATE);
  const engine = new Engine(ctx, DEFAULT_VOLUMES, { glue: false });
  const c = new Conductor(engine);
  c.play(id, 0.02, { at: 0, section: opts.section, mix: opts.mix });
  if (opts.intensity) c.setIntensity(opts.intensity);
  if (opts.bike !== undefined) {
    new BikeLoops(engine).update({ speed: opts.bike, pedal: 1, surface: 'road', drift: 0, boost: false, airborne: false, active: true, timeScale: 1 });
  }
  c.schedule(0.25);
  for (let t = 0.1; t < seconds - 0.05; t += 0.1) {
    void ctx.suspend(t).then(() => {
      c.schedule(t + 0.25);
      return ctx.resume();
    });
  }
  return ctx.startRendering();
}

const solo = (ch: Channel): Partial<Record<Channel, number>> =>
  Object.fromEntries([...STEMS, 'fx'].map((c) => [c, c === ch ? 1 : MUTE])) as Partial<Record<Channel, number>>;

export interface StemReport {
  id: string;
  fullLufs: number;
  /** Stem loudness relative to the full mix (LU). */
  stems: Partial<Record<Channel, number>>;
  /** Energy shares of the full mix (0..1). */
  low: number;
  upmid: number;
}

/** Stem balance of `seconds` from form index `section`. */
export async function stems(id: string, seconds: number, opts: MixOpts = {}): Promise<StemReport> {
  const full = await renderMix(id, seconds, opts);
  const fullLufs = lufs(full, 1);
  const out: StemReport = { id, fullLufs, stems: {}, low: 0, upmid: 0 };
  for (const ch of STEMS) {
    const buf = await renderMix(id, seconds, { ...opts, mix: solo(ch) });
    const l = lufs(buf, 1);
    out.stems[ch] = l <= -69 ? -99 : +(l - fullLufs).toFixed(1);
  }
  const [low, upmid] = bandShares(mono(full, 1), AUDIO_RATE, [[60, 150], [1000, 2500]]);
  out.low = +(low ?? 0).toFixed(3);
  out.upmid = +(upmid ?? 0).toFixed(3);
  return out;
}

/**
 * Hook vs everything else (rest of the band + the bike at `speed` m/s) in the hook's bands, over
 * the 50 ms windows where the lead sounds. Returns dB per band (positive = the hook is on top).
 */
export async function hookMask(id: string, section: number, seconds: number, speed = 20): Promise<Record<string, number>> {
  const lead = mono(await renderMix(id, seconds, { section, mix: solo('lead') }), 0.5);
  const rest = mono(await renderMix(id, seconds, { section, mix: { lead: MUTE }, bike: speed }), 0.5);
  const win = Math.floor(AUDIO_RATE * 0.05);
  const wins: number[] = [];
  let peak = 0;
  const env: number[] = [];
  for (let i = 0; i + win <= lead.length; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += (lead[j] ?? 0) ** 2;
    env.push(e);
    peak = Math.max(peak, e);
  }
  env.forEach((e, k) => e > peak * 0.01 && wins.push(k));
  const pick = (x: Float32Array): Float32Array => {
    const out = new Float32Array(wins.length * win);
    wins.forEach((k, n) => out.set(x.subarray(k * win, (k + 1) * win), n * win));
    return out;
  };
  const a = pick(lead);
  const b = pick(rest);
  const res: Record<string, number> = {};
  for (const [lo, hi] of [[500, 1200], [1200, 3000]] as const) {
    res[`${lo}-${hi}`] = +(10 * Math.log10(bandEnergy(a, AUDIO_RATE, lo, hi) / (bandEnergy(b, AUDIO_RATE, lo, hi) || 1e-12))).toFixed(1);
  }
  return res;
}
