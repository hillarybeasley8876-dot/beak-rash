// Shared track materials (one instance per track via ctx.shared): vertex-coloured toon props,
// black outline hulls, emissive lamps. Matches render/toon.ts (same 3-band ramp).
import { BackSide, DoubleSide, MeshBasicMaterial, MeshToonMaterial } from 'three';
import { toonRamp } from '../render/toon';
import type { WorldCtx } from './ctx';

export const INK = '#0b0b0f';
/** Outline widths (m): road-side props/vehicles per the art bible; big buildings slightly thicker. */
export const OUTLINE = { prop: 0.04, small: 0.025, building: 0.07 } as const;

export function propsMat(ctx: WorldCtx): MeshToonMaterial {
  return ctx.shared('mat:props', () => new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
}

/** Double-sided variant for thin cards (flags, leaves, awnings). */
export function propsMat2(ctx: WorldCtx): MeshToonMaterial {
  return ctx.shared('mat:props2', () => new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), side: DoubleSide }));
}

export function hullMat(ctx: WorldCtx): MeshBasicMaterial {
  return ctx.shared('mat:hull', () => new MeshBasicMaterial({ color: INK, side: BackSide }));
}

/** Unlit vertex colours (emissive signs, lamp globes, windows at night). */
export function glowMat(ctx: WorldCtx): MeshBasicMaterial {
  return ctx.shared('mat:glow', () => new MeshBasicMaterial({ vertexColors: true }));
}
