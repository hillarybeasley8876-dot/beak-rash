// Vertex-animated materials for batched props. Motion is driven by the vertex uv (free on these
// untextured batches): uv.x = per-object phase (radians), uv.y = amplitude weight (0 = anchored).
//   bob   — crowds: vertical hop
//   wave  — flags / banners: sideways ripple travelling along the cloth
//   float — boats: heave + roll
// Each mode has a toon material and a matching outline hull material that moves in step.
import { BackSide, DoubleSide, FrontSide, MeshBasicMaterial, MeshToonMaterial, type Material, type WebGLProgramParametersWithUniforms } from 'three';
import { toonRamp } from '../../render/toon';
import type { WorldCtx } from '../ctx';
import { INK } from '../mats';

export type SwayMode = 'bob' | 'wave' | 'float';

const MOTION: Record<SwayMode, string> = {
  bob: 'transformed.y += max(0.0, sin(uSwayTime * 7.0 + uv.x)) * 0.16 * uv.y;',
  wave: 'transformed.x += sin(uSwayTime * 6.0 + uv.x - uv.y * 4.0) * 0.18 * uv.y; '
    + 'transformed.z += cos(uSwayTime * 5.0 + uv.x - uv.y * 3.0) * 0.12 * uv.y;',
  float: 'transformed.y += sin(uSwayTime * 1.3 + uv.x) * 0.16; transformed.x += sin(uSwayTime * 0.9 + uv.x * 1.7) * 0.05 * uv.y;',
};

/** One time uniform per track, advanced with sim time (freezes in hit-stop, slows in slow-mo). */
function sharedTime(ctx: WorldCtx): { time: { value: number } } {
  return ctx.shared('sway:time', () => {
    const time = { value: 0 };
    ctx.onUpdate((dtSim) => { time.value += dtSim; });
    return { time, dispose: () => undefined };
  });
}

function patch(m: Material, mode: SwayMode, time: { value: number }, extra = ''): void {
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSwayTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${MOTION[mode]}\n${extra}`);
  };
  m.customProgramCacheKey = () => `sway-${mode}${extra ? '-hull' : ''}`;
}

/** Toon material (vertex colours) animated by `mode`. */
export function swayMat(ctx: WorldCtx, mode: SwayMode, doubleSide = false): MeshToonMaterial {
  const { time } = sharedTime(ctx);
  return ctx.shared(`mat:sway:${mode}:${doubleSide}`, () => {
    // The `uv` attribute is always declared by three's vertex prefix, so no map is needed.
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), side: doubleSide ? DoubleSide : FrontSide });
    patch(m, mode, time);
    return m;
  });
}

/** Black back-face outline that follows the same motion. */
export function swayHullMat(ctx: WorldCtx, mode: SwayMode): MeshBasicMaterial {
  const { time } = sharedTime(ctx);
  return ctx.shared(`mat:swayHull:${mode}`, () => {
    const m = new MeshBasicMaterial({ color: INK, side: BackSide });
    patch(m, mode, time, ' ');
    return m;
  });
}
