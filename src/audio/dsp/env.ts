// Click-free envelope helpers. Every envelope starts from 0 and returns to exactly 0 through ramps,
// exponential-looking falls are linear segments that stop at FLOOR (a 4 ms linear tail closes the gap),
// and all automation events are scheduled in time order with values computed analytically.
// Reused (persistent) voices are pinned to their note time: see anchor().

export const FLOOR = 0.0001;
const TAIL = 0.004;

/** Where each envelope-driven parameter's scheduled automation ends, and the value it holds then. */
const settled = new WeakMap<AudioParam, { at: number; value: number }>();

/** Record that `p`'s scheduled automation ends at `at`, holding `value` from then on. */
export function settle(p: AudioParam, at: number, value: number): void {
  settled.set(p, { at, value });
}

/**
 * Give `p` an automation event at `t` holding the value it has then, so the next ramp starts at t.
 * cancelAndHoldAtTime alone inserts nothing once the last ramp has finished before t: the next
 * ramp would then run from that old event (a reused voice fading in up to the scheduling
 * lookahead early). Mid-envelope = cancel and hold (the in-flight ramp is cut at t); after the
 * last envelope = an explicit setValueAtTime of the value it settled at. Params that have never
 * been automated hold their intrinsic value. Only for params automated through these helpers.
 */
export function anchor(p: AudioParam, t: number): void {
  const s = settled.get(p);
  if (s && t < s.at) holdAt(p, t);
  else p.setValueAtTime(s ? s.value : p.value, t);
}

/** Knots (fractions of the span) of the piecewise-linear exponential fall (denser at the top). */
const KNOTS = [0.05, 0.12, 0.22, 0.36, 0.56, 1];

/**
 * An exponential-looking fall from `from` at t0 to `to` at t1 as linear segments through exact
 * exponential knots (≤ 2 dB off above −30 dB). Exponential ramps cost the realtime audio thread
 * a pow() per sample (≈ +80 % for an enveloped voice); linear segments cost next to nothing.
 * Stops at `until` (≤ t1) and returns the value there.
 */
export function fall(p: AudioParam, t0: number, t1: number, from: number, to: number, until = t1): number {
  const span = Math.max(1e-4, t1 - t0);
  const at = (x: number): number => from * Math.pow(to / from, x);
  let prev = 0;
  for (const x of KNOTS) {
    const t = t0 + x * span;
    if (t >= until) {
      const u = (until - t0) / span;
      const v = at(prev) + ((at(x) - at(prev)) * (u - prev)) / (x - prev);
      p.linearRampToValueAtTime(v, until);
      return v;
    }
    p.linearRampToValueAtTime(at(x), t);
    prev = x;
  }
  return to;
}

/** Start an envelope at t: from 0 for a fresh node, or from the in-flight value for a reused voice. */
function begin(p: AudioParam, t: number, retrigger: boolean): void {
  if (retrigger) anchor(p, t);
  else p.setValueAtTime(0, t);
}

/**
 * Attack (linear) then an exponential-looking decay (see fall) to silence. Returns the time the
 * envelope reaches 0.
 * `retrigger` = persistent voice: ramp from whatever level the previous hit left.
 */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number, retrigger = false): number {
  const a = Math.max(0.001, attack);
  begin(p, t, retrigger);
  if (peak <= FLOOR) {
    p.linearRampToValueAtTime(0, t + a + decay);
    settle(p, t + a + decay, 0);
    return t + a + decay;
  }
  p.linearRampToValueAtTime(peak, t + a);
  fall(p, t + a, t + a + Math.max(0.005, decay), peak, FLOOR);
  p.linearRampToValueAtTime(0, t + a + decay + TAIL);
  settle(p, t + a + decay + TAIL, 0);
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
    fall(p, t + att, t + att + dec, top, s);
    // The sustain is a flat ramp, not a set: a retrigger inside it is then cut cleanly (anchor).
    p.linearRampToValueAtTime(s, off);
    level = s;
  } else {
    level = fall(p, t + att, t + att + dec, top, s, off);
  }
  if (level > FLOOR) fall(p, off, off + rel, level, FLOOR);
  else p.linearRampToValueAtTime(FLOOR, off + rel);
  p.linearRampToValueAtTime(0, off + rel + TAIL);
  settle(p, off + rel + TAIL, 0);
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
