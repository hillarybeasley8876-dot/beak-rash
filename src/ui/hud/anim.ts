// Motion helpers shared by every HUD piece: envelopes, P5 slams, reduced-motion switch.
// All HUD motion runs on real time (dtReal) so it stays deterministic under manual stepping.
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, lerp } from '../../core/math';
import { reducedMotion as coreReducedMotion } from '../../core/motion';

/** True when 设置 › 动态效果 (or, on 跟随系统, the OS) asks for reduced motion: no jitter, no big scale slams. */
export const reducedMotion = (): boolean => coreReducedMotion();

/** 0 before a, ramps to 1 by b, holds, ramps back to 0 from c to d. */
export function envelope(t: number, a: number, b: number, c: number, d: number): number {
  if (t <= a || t >= d) return 0;
  if (t < b) return easeOutCubic((t - a) / Math.max(1e-6, b - a));
  if (t <= c) return 1;
  return 1 - easeInCubic((t - c) / Math.max(1e-6, d - c));
}

/** P5 slam: scale `from` → 1 with an overshoot, over `dur` seconds. */
export function slam(t: number, dur = 0.16, from = 1.4): number {
  if (coreReducedMotion()) return 1;
  if (t <= 0) return from;
  return lerp(from, 1, easeOutBack(clamp01(t / dur), 2.4));
}

/** Entrance motion 0..1 (ease-out) starting at `delay`; 1 at once under reduced motion. */
export const enter = (t: number, dur: number, delay = 0): number =>
  coreReducedMotion() ? 1 : easeOutCubic(clamp01((t - delay) / Math.max(1e-6, dur)));

/** Exit motion 0..1 (ease-in) over the last `dur` s of `life`; 0 under reduced motion (callers still fade). */
export const exit = (t: number, life: number, dur: number): number =>
  coreReducedMotion() ? 0 : easeInCubic(clamp01((t - (life - dur)) / Math.max(1e-6, dur)));

/** Snap-out 0..1 (ease-out: most of the way in the first frames) over the last `dur` s of `life`, for
 *  lettering that must clear the frame at once; 0 under reduced motion (callers still fade). */
export const snapOut = (t: number, life: number, dur: number): number =>
  coreReducedMotion() ? 0 : easeOutCubic(clamp01((t - (life - dur)) / Math.max(1e-6, dur)));

/** Opacity 1 → 0 over the last `dur` s of `life` (kept with reduced motion). */
export const fadeOut = (t: number, life: number, dur: number): number =>
  1 - clamp01((t - (life - dur)) / Math.max(1e-6, dur));

/** Overshooting pop 0..1 (star bursts); 1 at once under reduced motion. */
export const pop = (t: number, dur: number, k = 2.2): number => (coreReducedMotion() ? 1 : easeOutBack(clamp01(t / dur), k));

/** Short decaying shake offset in px (denied skill, damage), deterministic in t. */
export function shake(t: number, dur: number, amp: number): number {
  if (t >= dur || coreReducedMotion()) return 0;
  const k = 1 - t / dur;
  return Math.sin(t * 90) * amp * k * k;
}

/** Cheap hash noise in [-1, 1] for 12 fps idle jitter (cosmetic only). */
export function jitter(tick: number, salt: number): number {
  if (coreReducedMotion()) return 0;
  let h = (tick * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h & 0xffff) / 0x8000) - 1;
}
