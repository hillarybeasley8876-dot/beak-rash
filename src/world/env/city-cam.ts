// Camera position in track space for the city env modules: projected at most once per camera move
// (the wet road's onBeforeRender) and shared with the rain, which reads it a frame late.
import { Vector3, type Camera } from 'three';
import type { WorldCtx } from '../ctx';

export interface CityCam {
  readonly pos: Vector3;
  s: number;
}

const cams = new WeakMap<WorldCtx, CityCam>();
const scratch = new Vector3();

/** Camera world position and its track s (cached while the camera has not moved). */
export function cityCamS(ctx: WorldCtx, camera: Camera): CityCam {
  let cam = cams.get(ctx);
  scratch.setFromMatrixPosition(camera.matrixWorld);
  if (!cam) {
    cam = { pos: scratch.clone(), s: ctx.q.project(scratch).s };
    cams.set(ctx, cam);
  } else if (!cam.pos.equals(scratch)) {
    cam.pos.copy(scratch);
    cam.s = ctx.q.project(scratch, cam.s).s;
  }
  return cam;
}
