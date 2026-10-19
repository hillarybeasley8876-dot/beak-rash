// Shared post-processing parameters. Writers: system (grade + speed, every frame), react/* (pulses),
// ko/* (cinematic look). Reader: post/composite (uniforms). Pulses decay in real time.
import { Color, Vector2, type Object3D } from 'three';
import { clamp01 } from '../core/math';
import type { CastRole } from './post/mask';

/** Track look, eased toward the current track's EnvLook.grade; `wb` = sRGB white balance for KO cast colours. */
export interface GradeState { saturation: number; contrast: number; tint: Color; exposure: number; bloom: number; threshold: number; wb: Color }

/** Speed sensation, recomputed from the player each frame; `rush` = the release-whoosh share (never masked by the KO look). */
export interface SpeedState { edgeBlur: number; chroma: number; lines: number; rush: number }

/** Cinematic look, owned by the KO / ult director (0 = off). */
export interface CineState {
  ko: number;          // desaturate-except-red + comic red/black tint
  halftone: number;
  zoom: number;        // radial zoom blur toward `focus`
  lines: number;       // black manga speed lines toward `focus`
  heroLines: number;   // white speed lines toward `focus` (SHOWTIME rise, full colour)
  focus: Vector2;      // screen uv of the cinematic subject
  red: number;         // red edge tint (wrecked)
  grain: number;
  vignette: number;
  letterbox: number;   // 0..1 bar slide-in
  bgBurst: number;     // replace everything behind the subject with a red/black radial burst
  burstInk: number;    // 0 = red / deep-red rays, 1 = ink rays on deep red (wrecked)
  rim: number;         // paper sticker rim where the subject meets the burst
  subjectDepth: number; // view-space distance of the subject (m), for the burst mask
  bgMargin: number;    // metres behind the subject before the burst takes over
  behindAt: number;    // metres behind the subject where the dark 'behind' band starts (ult: past the farthest victim)
  cast: Map<Object3D, CastRole>; // rider / vehicle roots for the subject mask (empty = depth-only look)
  hide: Set<Object3D>; // riders between the lens and a victim, skipped while the comic look is on
}

/** One-shot pulses (decay automatically). */
export interface PulseState {
  damage: number;      // red edge pulse when the player is hit
  flash: number;
  flashColor: Color;
  chroma: number;      // chromatic punch
  impact: number;      // seconds left of the inverted impact frame
  impactColor: Color;
  whoosh: number;      // speed-line / edge-blur rush when a cinematic hands back to the race
}

export class PostState {
  readonly grade: GradeState = { saturation: 1, contrast: 1, tint: new Color(1, 1, 1), exposure: 1, bloom: 0.2, threshold: 1, wb: new Color(1, 1, 1) };
  readonly speed: SpeedState = { edgeBlur: 0, chroma: 0, lines: 0, rush: 0 };
  readonly cine: CineState = {
    ko: 0, halftone: 0, zoom: 0, lines: 0, heroLines: 0, focus: new Vector2(0.5, 0.5), red: 0, grain: 0, vignette: 0, letterbox: 0,
    bgBurst: 0, burstInk: 0, rim: 0, subjectDepth: 4, bgMargin: 3, behindAt: 2, cast: new Map(), hide: new Set(),
  };
  readonly pulse: PulseState = {
    damage: 0, flash: 0, flashColor: new Color(1, 1, 1), chroma: 0, impact: 0, impactColor: new Color(1, 1, 1), whoosh: 0,
  };
  /** Accessibility: no inverted impact frames, softer flashes. */
  reducedFlashes = false;
  /** Lines colour for gameplay speed lines (white); KO lines are black. */
  readonly linesColor = new Color(1, 1, 1);

  /** Red edge pulse (player hurt), 0..1 strength. */
  hurt(strength: number): void {
    this.pulse.damage = Math.max(this.pulse.damage, clamp01(strength));
  }

  flash(strength: number, color: string | Color = '#ffffff'): void {
    const s = this.reducedFlashes ? strength * 0.35 : strength;
    if (s < this.pulse.flash) return;
    this.pulse.flash = clamp01(s);
    this.pulse.flashColor.set(color);
  }

  punch(chroma: number): void {
    this.pulse.chroma = Math.max(this.pulse.chroma, chroma);
  }

  /** 1–2 frame black/white (or red/black) inverted impact frame. */
  impact(seconds: number, color: string | Color = '#ffffff'): void {
    if (this.reducedFlashes) return;
    this.pulse.impact = Math.max(this.pulse.impact, seconds);
    this.pulse.impactColor.set(color);
  }

  /** Speed rush back into the race (cinematic release), 0..1. */
  whoosh(strength: number): void {
    this.pulse.whoosh = Math.max(this.pulse.whoosh, clamp01(strength));
  }

  /** Decay pulses by real time. */
  tick(dtReal: number): void {
    const p = this.pulse;
    p.damage = Math.max(0, p.damage - dtReal * 2.6);
    p.flash = Math.max(0, p.flash - dtReal * 7);
    // Proportional decay: a punch stays visible for ~0.15 s whatever its size.
    p.chroma = p.chroma < 1e-4 ? 0 : p.chroma * Math.exp(-dtReal * 10);
    p.impact = Math.max(0, p.impact - dtReal);
    p.whoosh = Math.max(0, p.whoosh - dtReal * 2.4);
  }

  resetCine(): void {
    const c = this.cine;
    c.ko = c.halftone = c.zoom = c.lines = c.heroLines = c.red = c.grain = c.vignette = c.letterbox = c.bgBurst = c.burstInk = c.rim = 0;
    c.subjectDepth = 4;
    c.bgMargin = 3;
    c.behindAt = 2;
    c.focus.set(0.5, 0.5);
    c.cast.clear();
    c.hide.clear();
  }

  reset(): void {
    this.resetCine();
    const p = this.pulse;
    p.damage = p.flash = p.chroma = p.impact = p.whoosh = 0;
    this.speed.edgeBlur = this.speed.chroma = this.speed.lines = this.speed.rush = 0;
  }
}
