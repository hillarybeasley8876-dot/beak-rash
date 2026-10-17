// Race count-in, played on the stinger band while the race song waits for GO: the song's
// opening chord swells on the pad, and each count step adds a bigger riser, the last one with an
// accelerating snare roll that lands on the GO downbeat. Non-metric on purpose: the countdown runs
// on game time (1 s steps), the groove starts exactly on GO.
import { voiceChord, type Chord } from './theory';
import type { Band } from './band';

const STEP_SWEEP: Record<number, [number, number, number]> = {
  3: [250, 900, 0.35], 2: [450, 2000, 0.55], 1: [800, 6000, 1],
};

/** One count step `n` (3, 2, 1) starting at `t`; GO is expected at `t + step`. */
export function countStep(b: Band, t: number, step: number, n: number, chord: Chord | null, first: boolean): void {
  if (first && chord) {
    // Hold the downbeat chord under the whole count (it resolves into the same chord on GO).
    b.pad.chord(t, voiceChord(chord, 60, null, true), n * step + 0.05, 0.9);
  }
  const [from, to, vel] = STEP_SWEEP[n] ?? [450, 2000, 0.55];
  b.drums.riser(t, step, vel, from, to);
  if (n !== 1) return;
  // 12 snare hits, gaps shrinking toward GO, crescendo.
  let at = t + step * 0.35;
  let gap = step * 0.11;
  for (let k = 0; k < 12 && at < t + step - 0.02; k++) {
    b.drums.snare(at, 0.25 + 0.06 * k, k < 3);
    at += gap;
    gap *= 0.86;
  }
}
