// The drum lanes of one step, played on the band's kit, a whole bar of them recorded into one
// pre-mixed buffer (drumBar), and the build bar into the final stretch.
import type { CompiledSection } from './compile';
import type { DrumKit } from './instruments/drums';
import type { LaneName } from './types';

/** What the drum lanes need from the song player. */
export interface GrooveSource {
  readonly kit: DrumKit;
  readonly stepDur: number;
  readonly swing: number;
  /** Audio time → the kit's band clock (a bar render starts at 0). */
  time(t: number): number;
  /** The one-bar build into the final stretch is playing (it replaces snare and toms). */
  readonly building: boolean;
  tok(sec: CompiledSection, lane: LaneName, step: number): string | null;
  vel(token: string): number;
  random(): number;
}

/** Every drum lane at `step` (time `t`). */
export function drumStep(g: GrooveSource, sec: CompiledSection, step: number, t: number): void {
  const d = g.kit;
  const k = g.tok(sec, 'kick', step);
  if (k) d.kick(t, g.vel(k));
  const s = g.building ? null : g.tok(sec, 'snare', step);
  if (s === 'r') d.rim(t, g.vel('x'));
  else if (s) d.snare(t, g.vel(s), s === 'g');
  const c = g.tok(sec, 'clap', step);
  if (c) d.clap(t, g.vel(c));
  const h = g.tok(sec, 'hat', step);
  if (h) d.hat(t, h === 'O' ? 0.85 : g.vel(h), h === 'O');
  const p = g.tok(sec, 'perc', step);
  if (p === 's' || p === 'S') d.shaker(t, g.vel(p));
  else if (p === 't' || p === 'T') d.tambourine(t, g.vel(p));
  else if (p === 'b' || p === 'B') d.cowbell(t, g.vel(p));
  const tm = g.building ? null : g.tok(sec, 'tom', step);
  if (tm === '1' || tm === '2' || tm === '3') d.tom(t, 0.75 + g.random() * 0.2, Number(tm) as 1 | 2 | 3);
  const cy = g.tok(sec, 'cym', step);
  if (cy === 'C') d.crash(t, 0.9);
  else if (cy === 'R') d.ride(t, g.vel('x'));
  else if (cy === 'W') d.swell(t, (16 - (step % 16)) * g.stepDur, 1);
}

/** The bar before the final stretch: a swelling riser and a 16th snare roll into the crash. */
export function buildStep(g: GrooveSource, step: number, t: number): void {
  const d = g.kit;
  if (step === 0) d.riser(t, g.stepDur * 16, 1);
  d.snare(t, 0.25 + 0.75 * (step / 15), step < 8 && step % 2 === 1);
  if (step >= 12) d.tom(t, 0.7 + 0.08 * (step - 12), step < 14 ? 1 : 3);
}

/**
 * The drums from step `from` to the end of its bar (from audio time `start`), pre-mixed into one
 * buffer (drum-mix.ts); `crash` adds a crash on the first step. Returns the audio time the mix covers to.
 */
export function drumBar(g: GrooveSource, sec: CompiledSection, from: number, start: number, crash: boolean): number {
  const d = g.kit;
  const end = Math.min(sec.steps, (Math.floor(from / 16) + 1) * 16);
  d.record(g.time(start));
  if (crash && g.tok(sec, 'cym', from) !== 'C') d.crash(g.time(start), 0.9);
  for (let s = from; s < end; s++) {
    const t = g.time(start + (s - from) * g.stepDur + (s % 2 === 1 ? g.swing * g.stepDur : 0));
    if (g.building) buildStep(g, s % 16, t);
    drumStep(g, sec, s, t);
  }
  d.flush();
  return start + (end - from) * g.stepDur;
}
