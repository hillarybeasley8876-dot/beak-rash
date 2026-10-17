// Click-free envelope helpers. Every envelope starts from 0 and returns to exactly 0 through ramps,
// exponential ramps never target 0 (they stop at FLOOR, then a 4 ms linear tail closes the gap),
// and all automation events are scheduled in time order with values computed analytically.

export const FLOOR = 0.0001;
const TAIL = 0.004;

/** Start an envelope at t: from 0 for a fresh node, or from the in-flight value for a reused voice. */
function begin(p: AudioParam, t: number, retrigger: boolean): void {
  if (retrigger) holdAt(p, t);
  else p.setValueAtTime(0, t);
}

/**
 * Attack (linear) then exponential decay to silence. Returns the time the envelope reaches 0.
 * `retrigger` = persistent voice: ramp from whatever level the previous hit left.
 */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number, retrigger = false): number {
  const a = Math.max(0.001, attack);
  begin(p, t, retrigger);
  if (peak <= FLOOR) {
    p.linearRampToValueAtTime(0, t + a + decay);
    return t + a + decay;
  }
  p.linearRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(FLOOR, t + a + Math.max(0.005, decay));
  p.linearRampToValueAtTime(0, t + a + decay + TAIL);
  return t + a + decay + TAIL;
}

/**
 * ADSR over a note of length `dur` (release starts at t + dur). `sus` is a fraction of `peak`.
 * Returns the time the envelope reaches 0 (stop sources there or later).
 */
export function adsr(
  p: AudioParam, t: number, dur: number, peak: number,
  a: number, d: number, sus: number, r: number, retrigger = false,
): number {
  const att = Math.max(0.001, a);
  const dec = Math.max(0.002, d);
  const rel = Math.max(0.006, r);
  const top = Math.max(FLOOR * 2, peak);
  const s = Math.max(FLOOR * 1.5, top * sus);
  const off = t + Math.max(dur, att);
  begin(p, t, retrigger);
  p.linearRampToValueAtTime(top, t + att);
  let level: number;
  if (off >= t + att + dec) {
    p.exponentialRampToValueAtTime(s, t + att + dec);
    p.setValueAtTime(s, off);
    level = s;
  } else {
    level = top * Math.pow(s / top, (off - t - att) / dec);
    p.exponentialRampToValueAtTime(level, off);
  }
  if (level > FLOOR) p.exponentialRampToValueAtTime(FLOOR, off + rel);
  else p.linearRampToValueAtTime(FLOOR, off + rel);
  p.linearRampToValueAtTime(0, off + rel + TAIL);
  return off + rel + TAIL;
}

/** Smoothly move a live parameter toward `value` (cancels pending automation first). */
export function steer(p: AudioParam, now: number, value: number, tau = 0.05): void {
  holdAt(p, now);
  p.setTargetAtTime(value, now, Math.max(0.001, tau));
}

/** Drop automation after t but keep the value it would have at t (no jump = no click). */
export function holdAt(p: AudioParam, t: number): void {
  if (typeof p.cancelAndHoldAtTime === 'function') {
    p.cancelAndHoldAtTime(t);
  } else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
}

/**
 * Biquad with k-rate parameters: envelopes on cutoff update once per 128-frame quantum instead
 * of recomputing coefficients every sample (a large CPU saving for per-note filters).
 */
export function filter(ctx: BaseAudioContext, opts: BiquadFilterOptions): BiquadFilterNode {
  const f = new BiquadFilterNode(ctx, opts);
  f.frequency.automationRate = 'k-rate';
  f.Q.automationRate = 'k-rate';
  f.gain.automationRate = 'k-rate';
  f.detune.automationRate = 'k-rate';
  return f;
}
