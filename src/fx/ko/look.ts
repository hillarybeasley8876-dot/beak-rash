// KO / ult cinematic timelines (real seconds) and the post look they drive.
import { clamp01, easeInCubic, easeOutCubic, smoothstep } from '../../core/math';
import type { CineState } from '../state';

export type CineKind = 'ko' | 'wrecked' | 'ult';

export interface Timeline {
  hitStop: number;   // sim freeze at the start (real s)
  slowAt: number;    // slow-mo + camera cut
  peakAt: number;    // `cine:ko peak` (UI splash)
  holdAt: number;    // the slow-mo starts easing up toward `holdScale` (the wreck arc plays out)
  releaseAt: number; // whoosh back to full speed, camera blends home
  fadeOut: number;   // post look fade after release
  scale: number;     // slow-mo time scale (the frozen beat around the peak)
  holdScale: number; // time scale reached after holdAt, so ~0.3-0.4 s of sim plays before the release
  holdRamp: number;  // seconds from `scale` to `holdScale`
  rampIn: number;    // seconds to reach `scale`
  rampOut: number;   // seconds back to 1
  extend: number;    // added once when a chain KO lands inside the window
  apexWait: number;  // max extra seconds the release waits for the victim's arc to turn over (0 = none)
}

/** Longest a window may run (release + fade), chains included (SPEC §0: 1.2-1.8 s). */
export const WINDOW_MAX = 1.8;

/** First KO: the frozen 0.1x beat (SPEC §8) holds through the peak and the splash slam, then eases up so the
 *  tumble still plays out (~0.25 s of sim) before the whoosh. */
export const FULL: Timeline = {
  hitStop: 0.09, slowAt: 0.09, peakAt: 0.45, holdAt: 0.75, releaseAt: 1.3, fadeOut: 0.32,
  scale: 0.1, holdScale: 0.4, holdRamp: 0.3, rampIn: 0.12, rampOut: 0.25, extend: 0.3, apexWait: 0.18,
};

/** Player wrecked: shorter, side camera, red edges; eases up early so ~0.45 s of the tumble plays on camera. */
export const WRECKED: Timeline = {
  hitStop: 0.08, slowAt: 0.08, peakAt: 0.3, holdAt: 0.2, releaseAt: 0.9, fadeOut: 0.28,
  scale: 0.15, holdScale: 0.65, holdRamp: 0.25, rampIn: 0.1, rampOut: 0.22, extend: 0.25, apexWait: 0.12,
};

/** SHOWTIME dive impact: the victims' cluster, a touch longer at the peak. */
export const ULT_IMPACT: Timeline = {
  hitStop: 0.12, slowAt: 0.12, peakAt: 0.5, holdAt: 0.5, releaseAt: 1.25, fadeOut: 0.32,
  scale: 0.12, holdScale: 0.35, holdRamp: 0.4, rampIn: 0.1, rampOut: 0.25, extend: 0.25, apexWait: 0,
};

/** settings.slowmo = 'off': no slow-mo or camera, just the beat for the splash and the sound. */
export const LITE: Timeline = {
  hitStop: 0.05, slowAt: 0.05, peakAt: 0.1, holdAt: 0.1, releaseAt: 0.7, fadeOut: 0.1,
  scale: 1, holdScale: 1, holdRamp: 0, rampIn: 0, rampOut: 0, extend: 0.2, apexWait: 0,
};

/** The 60 % shorter variant (repeat KOs within 10 s, or settings.slowmo = 'short'). */
export function shortVariant(t: Timeline): Timeline {
  const f = 0.4;
  const peakAt = Math.max(0.16, t.peakAt * f);
  return {
    ...t,
    hitStop: Math.max(0.05, t.hitStop * 0.7), slowAt: Math.max(0.05, t.slowAt * 0.7),
    peakAt, holdAt: peakAt, holdRamp: t.holdRamp * 0.6, releaseAt: Math.max(0.5, t.releaseAt * f),
    fadeOut: t.fadeOut * 0.8, rampOut: t.rampOut * 0.8, extend: t.extend * f, apexWait: 0,
  };
}

/**
 * Cinematic post look at real time `t`. `lastPeak` = time of the latest peak (chain KOs re-pulse).
 * `release` may move later than tl.releaseAt when a chain extends the window. The comic look snaps in
 * on the camera cut (slowAt) and is gone on the first handed-back frame (the whoosh carries the
 * transition); only bars, grain and vignette ease out over tl.fadeOut. `continued` = the window takes
 * over a running cinematic (SHOWTIME dive): bars and look are on from the first frame.
 * KO / ult: black-and-white subject with a paper rim on red rays. WRECKED: the same committed
 * look on an inverted backdrop (ink rays on deep red), red only at the edges, a crisp subject.
 */
export function applyLook(
  c: CineState, kind: CineKind, tl: Timeline, t: number, lastPeak: number, release: number, handedBack: boolean, continued = false,
): void {
  const inK = continued || t >= tl.slowAt ? 1 : 0;
  const w = inK * (1 - smoothstep(release, release + tl.fadeOut, t));
  const wc = handedBack ? 0 : inK;
  const start = Math.exp(-Math.max(0, t - tl.slowAt) * 7);
  const peak = t >= lastPeak ? Math.exp(-(t - lastPeak) * 6) : 0;
  const wrecked = kind === 'wrecked';
  c.ko = wc;
  c.bgBurst = wc;
  c.burstInk = wrecked ? 1 : 0;
  c.rim = wc;
  c.bgMargin = wrecked ? 2.2 : 3;
  c.behindAt = 2;
  c.red = wrecked ? 0.7 * w : 0;
  c.halftone = (0.55 + 0.45 * peak) * wc;
  c.grain = 0.5 * w;
  c.vignette = 0.3 * w;
  c.heroLines = 0;
  c.lines = (wrecked ? 0.35 : 0.5 + 0.4 * peak) * wc;
  c.zoom = (wrecked ? 0.008 + 0.012 * start : 0.03 + 0.1 * start + 0.03 * peak) * wc;
  const barIn = continued ? 1 : easeOutCubic(clamp01((t - tl.slowAt) / 0.22));
  const barOut = easeInCubic(clamp01((t - release) / tl.fadeOut));
  c.letterbox = barIn * (1 - barOut);
}

/** Ult rise look, in full colour: bars, white speed lines toward the pelican, vignette, a touch of grain. */
export function applyRiseLook(c: CineState, t: number, end: number | null): void {
  const inK = smoothstep(0, 0.2, t);
  const outK = end === null ? 1 : 1 - smoothstep(end, end + 0.25, t);
  const w = inK * outK;
  c.ko = c.bgBurst = c.burstInk = c.rim = c.red = c.halftone = c.lines = 0;
  c.grain = 0.15 * w;
  c.vignette = 0.35 * w;
  c.heroLines = 0.35 * w;
  c.zoom = 0.012 * w;
  c.letterbox = easeOutCubic(clamp01(t / 0.25)) * outK;
}
