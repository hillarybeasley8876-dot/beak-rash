// KO / ult cinematic timelines (real seconds) and the post look they drive.
import { clamp01, easeInCubic, easeOutCubic, smoothstep } from '../../core/math';
import type { CineState } from '../state';

export type CineKind = 'ko' | 'wrecked' | 'ult';

export interface Timeline {
  hitStop: number;   // sim freeze at the start (real s)
  slowAt: number;    // slow-mo + camera cut
  peakAt: number;    // `cine:ko peak` (UI splash)
  releaseAt: number; // whoosh back to full speed, camera blends home
  fadeOut: number;   // post look fade after release
  scale: number;     // slow-mo time scale
  rampIn: number;    // seconds to reach `scale`
  rampOut: number;   // seconds back to 1
  extend: number;    // added once when a chain KO lands inside the window
}

export const FULL: Timeline = {
  hitStop: 0.09, slowAt: 0.09, peakAt: 0.45, releaseAt: 1.3, fadeOut: 0.32, scale: 0.1, rampIn: 0.12, rampOut: 0.25, extend: 0.55,
};

/** Player wrecked: shorter, side camera, red tint. */
export const WRECKED: Timeline = {
  hitStop: 0.08, slowAt: 0.08, peakAt: 0.3, releaseAt: 0.9, fadeOut: 0.28, scale: 0.15, rampIn: 0.1, rampOut: 0.22, extend: 0.3,
};

/** SHOWTIME dive impact: wide shot, a touch longer at the peak. */
export const ULT_IMPACT: Timeline = {
  hitStop: 0.12, slowAt: 0.12, peakAt: 0.5, releaseAt: 1.25, fadeOut: 0.32, scale: 0.12, rampIn: 0.1, rampOut: 0.25, extend: 0.3,
};

/** settings.slowmo = 'off': no slow-mo or camera, just the beat for the splash and the sound. */
export const LITE: Timeline = {
  hitStop: 0.05, slowAt: 0.05, peakAt: 0.1, releaseAt: 0.7, fadeOut: 0.1, scale: 1, rampIn: 0, rampOut: 0, extend: 0.2,
};

/** The 60 % shorter variant (repeat KOs within 10 s, or settings.slowmo = 'short'). */
export function shortVariant(t: Timeline): Timeline {
  const f = 0.4;
  return {
    ...t,
    hitStop: Math.max(0.05, t.hitStop * 0.7), slowAt: Math.max(0.05, t.slowAt * 0.7),
    peakAt: Math.max(0.16, t.peakAt * f), releaseAt: Math.max(0.5, t.releaseAt * f),
    fadeOut: t.fadeOut * 0.8, rampOut: t.rampOut * 0.8, extend: t.extend * f,
  };
}

/**
 * Cinematic post look at real time `t`. `lastPeak` = time of the latest peak (chain KOs re-pulse).
 * `release` may move later than tl.releaseAt when a chain extends the window. `handedBack` = the
 * camera is back in the race (frames after the release): the subject-masked burst goes at once,
 * the comic look within 0.14 s; bars, grain and vignette ease out over tl.fadeOut.
 */
export function applyLook(c: CineState, kind: CineKind, tl: Timeline, t: number, lastPeak: number, release: number, handedBack: boolean): void {
  const inK = smoothstep(tl.slowAt, tl.slowAt + 0.14, t);
  const w = inK * (1 - smoothstep(release, release + tl.fadeOut, t));
  const wc = inK * (1 - smoothstep(release, release + 0.14, t));
  const start = Math.exp(-Math.max(0, t - tl.slowAt) * 7);
  const peak = t >= lastPeak ? Math.exp(-(t - lastPeak) * 6) : 0;
  c.ko = (kind === 'wrecked' ? 0.6 : 1) * wc;
  c.bgBurst = kind === 'wrecked' || handedBack ? 0 : wc;
  c.bgMargin = kind === 'ult' ? 14 : 3;
  c.red = kind === 'wrecked' ? 0.5 * wc : 0;
  c.halftone = (0.55 + 0.45 * peak) * wc;
  c.grain = 0.5 * w;
  c.vignette = 0.3 * w;
  c.lines = (kind === 'wrecked' ? 0.35 : 0.5 + 0.4 * peak) * wc;
  c.zoom = (0.03 + 0.1 * start + 0.06 * peak) * wc;
  const barIn = easeOutCubic(clamp01((t - tl.slowAt) / 0.22));
  const barOut = easeInCubic(clamp01((t - release) / tl.fadeOut));
  c.letterbox = barIn * (1 - barOut);
}

/** Ult rise look: bars + white speed lines toward the pelican, mild vignette. */
export function applyRiseLook(c: CineState, t: number, end: number | null): void {
  const inK = smoothstep(0, 0.2, t);
  const outK = end === null ? 1 : 1 - smoothstep(end, end + 0.25, t);
  const w = inK * outK;
  c.ko = 0.25 * w;
  c.bgBurst = 0;
  c.red = 0;
  c.halftone = 0.2 * w;
  c.grain = 0.25 * w;
  c.vignette = 0.35 * w;
  c.lines = 0;
  c.zoom = 0.02 * w;
  c.letterbox = easeOutCubic(clamp01(t / 0.25)) * outK;
}
