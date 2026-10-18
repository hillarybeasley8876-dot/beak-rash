// Retrigger / fade regressions for tools/audio-check.mjs (fix round 2, B1). Reused voices must
// stay silent until their note: every persistent instrument plays two notes and the 150 ms before
// the second must be silent (dry strip, < −60 dBFS); stingers after 5 s idle likewise (full
// graph); and a song stop's 0.8 s fade-out must still be near full level 100 ms in (measured
// against an identical render without the stop, so the ratio is the fade gain itself).
import { AUDIO_RATE, Engine } from './engine';
import { DEFAULT_VOLUMES } from './check';
import { Band } from './music/band';
import { Conductor } from './music/conductor';
import type { StingerId } from './music/stingers';
import type { Channel } from './music/types';

const SR = AUDIO_RATE;
const PRE = 0.15;
const FIRST = 0.2;

export interface OnsetStat { id: string; preDb: number; hitDb: number }

/** `second` = the retriggered note (other pitch / chord, so a stale pitch would show). */
type Play = (b: Band, t: number, second: boolean) => void;

const bassNote = (midi: number, pop: boolean) => ({ midi, dur: 0.2, vel: 1, pop, accent: !pop, slide: false });

/** [id, channel, gap (s) between the notes, play]. Gaps leave each instrument's tail room to end. */
const CASES: Array<[string, Channel, number, Play]> = [
  ['kick', 'drums', 0.6, (b, t) => b.drums.kick(t, 1)],
  ['snare', 'drums', 0.6, (b, t, s) => b.drums.snare(t, 1, s)],
  ['rim', 'drums', 0.6, (b, t) => b.drums.rim(t, 1)],
  ['clap', 'drums', 0.6, (b, t) => b.drums.clap(t, 1)],
  ['hat', 'drums', 0.6, (b, t) => b.drums.hat(t, 1, false)],
  ['hat.open', 'drums', 0.8, (b, t) => b.drums.hat(t, 1, true)],
  ['shaker', 'drums', 0.6, (b, t) => b.drums.shaker(t, 1)],
  ['tambourine', 'drums', 0.6, (b, t) => b.drums.tambourine(t, 1)],
  ['ride', 'drums', 0.9, (b, t) => b.drums.ride(t, 1)],
  ['tom', 'drums', 0.8, (b, t, s) => b.drums.tom(t, 1, s ? 3 : 1)],
  ['cowbell', 'drums', 0.6, (b, t) => b.drums.cowbell(t, 1)],
  ['bass', 'bass', 0.6, (b, t, s) => b.bass.note(t, bassNote(s ? 40 : 45, s))],
  ['bass.dead', 'bass', 0.6, (b, t, s) => b.bass.dead(t, s ? 52 : 57, 0.9)],
  ['keys', 'keys', 1.0, (b, t, s) => b.keys.chord(t, s ? [54, 58, 61, 64] : [57, 60, 64, 67], 0.25, 0.9)],
  ['clav', 'clav', 0.6, (b, t, s) => b.clav.hit(t, s ? [61, 64, 68] : [60, 64, 67], 0.2, 1)],
  ['clav.mute', 'clav', 0.6, (b, t) => b.clav.mute(t, 1)],
  ['pad', 'pad', 1.8, (b, t, s) => b.pad.chord(t, s ? [54, 58, 61, 64] : [57, 60, 64, 67], 0.3, 1)],
  ['brass', 'brass', 0.8, (b, t, s) => b.brass.stab(t, s ? [61, 65, 68] : [60, 64, 67], 0.2, 1)],
  ['brass.fall', 'brass', 1.0, (b, t, s) => b.brass.stab(t, s ? [61, 65, 68] : [60, 64, 67], 0.2, 1, 'fall')],
  ['lead.wah', 'lead', 0.8, (b, t, s) => b.lead('wah').note(t, s ? 76 : 69, 0.3, 1, false)],
  ['lead.synth', 'lead', 0.8, (b, t, s) => b.lead('synth').note(t, s ? 76 : 69, 0.3, 1, s)],
  ['lead.flute', 'lead', 0.9, (b, t, s) => b.lead('flute').note(t, s ? 76 : 69, 0.3, 1, false)],
];

const dbOf = (x: number): number => +(x > 0 ? 20 * Math.log10(x) : -200).toFixed(1);

/** Peak (linear) over every channel in [from, to) seconds. */
function peak(buf: AudioBuffer, from: number, to: number): number {
  let p = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = Math.max(0, Math.floor(from * SR)); i < Math.min(d.length, Math.floor(to * SR)); i++) p = Math.max(p, Math.abs(d[i] ?? 0));
  }
  return p;
}

/** RMS (linear) over every channel in [from, to) seconds. */
function rms(buf: AudioBuffer, from: number, to: number): number {
  let sum = 0;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = Math.floor(from * SR); i < Math.min(d.length, Math.floor(to * SR)); i++, n++) sum += (d[i] ?? 0) ** 2;
  }
  return Math.sqrt(sum / Math.max(1, n));
}

/** Each instrument twice through a fresh band; only the dry channel strip is recorded. */
export async function retriggerChecks(): Promise<OnsetStat[]> {
  const out: OnsetStat[] = [];
  for (const [id, ch, gap, play] of CASES) {
    const second = FIRST + gap;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * (second + 0.5)), SR);
    const engine = new Engine(ctx, DEFAULT_VOLUMES, { glue: false });
    engine.output.disconnect();
    const band = new Band(engine, 120, {}, new GainNode(ctx));
    band.input(ch).connect(ctx.destination);
    play(band, FIRST, false);
    play(band, second, true);
    const buf = await ctx.startRendering();
    out.push({ id, preDb: dbOf(peak(buf, second - PRE, second - 0.002)), hitDb: dbOf(peak(buf, second, second + 0.12)) });
  }
  return out;
}

/** Every stinger, 5 s apart (the stinger band idles in between), through the full graph. */
export async function stingerIdleChecks(): Promise<OnsetStat[]> {
  const ids: StingerId[] = ['finish', 'finishLow', 'onemore', 'ko', 'busted', 'showtime', 'wrecked', 'go', 'count'];
  const at = (i: number): number => 0.3 + i * 5;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * (at(ids.length - 1) + 3)), SR);
  const engine = new Engine(ctx, DEFAULT_VOLUMES, { glue: false });
  const c = new Conductor(engine);
  ids.forEach((id, i) => c.stinger(id, at(i)));
  const buf = await ctx.startRendering();
  return ids.slice(1).map((id, k) => {
    const t = at(k + 1);
    return { id: `sting.${id}`, preDb: dbOf(peak(buf, t - PRE, t - 0.002)), hitDb: dbOf(peak(buf, t, t + 0.4)) };
  });
}

/** Render `id` from the top for `seconds`; with `stopAt`, the song is stopped there (0.8 s fade). */
async function renderStop(id: string, seconds: number, stopAt: number | null): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const engine = new Engine(ctx, DEFAULT_VOLUMES, { glue: false });
  const c = new Conductor(engine);
  c.play(id, 0.02, { at: 0 });
  c.schedule(0.25);
  for (let k = 1; k / 10 < seconds - 0.05; k++) {
    const t = k / 10;
    void ctx.suspend(t).then(() => {
      if (stopAt !== null && Math.abs(t - stopAt) < 1e-6) c.play(null, 0.8);
      c.schedule(t + 0.25);
      return ctx.resume();
    });
  }
  return ctx.startRendering();
}

/** Fade-out gain (dB vs the unstopped render) 100 ms and 400 ms into a 0.8 s song stop. */
export async function fadeOutCheck(id = 'race-coast', stopAt = 4): Promise<{ id: string; at100: number; at400: number }> {
  const ref = await renderStop(id, stopAt + 1.2, null);
  const cut = await renderStop(id, stopAt + 1.2, stopAt);
  const ratio = (from: number): number => dbOf(rms(cut, from, from + 0.05) / (rms(ref, from, from + 0.05) || 1e-9));
  return { id, at100: ratio(stopAt + 0.075), at400: ratio(stopAt + 0.375) };
}
