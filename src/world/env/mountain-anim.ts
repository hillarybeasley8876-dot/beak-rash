// Shared helpers for Sunset Pass vertex-animated scenery (env-mountain): one sim-time uniform, and a
// toon mesh + matching outline hull whose vertices move by an injected GLSL snippet (rotors,
// gondolas, balloons) — one draw call per animated family, motion computed on the GPU.
import {
  BackSide, Mesh, MeshBasicMaterial, MeshToonMaterial, Sphere, type BufferGeometry, type IUniform, type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { toonRamp } from '../../render/toon';
import type { WorldCtx } from '../ctx';
import { makeHull } from '../geom';
import { INK } from '../mats';

/** Sim-time seconds (freezes in hit-stop, slows in slow-mo), shared by every animated family. */
export function lifeTime(ctx: WorldCtx): IUniform<number> {
  return ctx.shared('mountain:life:time', () => {
    const time: IUniform<number> = { value: 0 };
    ctx.onUpdate((dtSim) => { time.value += dtSim; });
    return { time, dispose: () => undefined };
  }).time;
}

export interface AnimSpec {
  name: string;
  /** GLSL declarations (attributes / uniforms besides uLifeTime). */
  decl: string;
  /** GLSL run after <begin_vertex>: modify `transformed` (and optionally `objectNormal` earlier). */
  motion: string;
  /** Extra uniforms (shared objects). */
  uniforms?: Record<string, IUniform>;
  /** Attribute names the hull must copy. */
  attributes: string[];
  outline: number;
  /** World-space sphere covering every animated position (frustum + fog culling). */
  bounds: Sphere;
}

function patch(m: Material, spec: AnimSpec, time: IUniform<number>, key: string): void {
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uLifeTime = time;
    for (const [k, u] of Object.entries(spec.uniforms ?? {})) shader.uniforms[k] = u;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uLifeTime;\n${spec.decl}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${spec.motion}`);
  };
  m.customProgramCacheKey = () => `mountain-anim-${spec.name}-${key}`;
}

/** Build the animated toon mesh (+ outline hull) and add it to the track group. */
export function animatedMesh(ctx: WorldCtx, geo: BufferGeometry, spec: AnimSpec): Mesh {
  const time = lifeTime(ctx);
  const mat = ctx.own(new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
  patch(mat, spec, time, 'body');
  ctx.own(geo);
  geo.boundingSphere = spec.bounds.clone();
  const mesh = new Mesh(geo, mat);
  mesh.name = spec.name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (spec.outline > 0) {
    const hullGeo = ctx.own(makeHull(geo, spec.outline));
    for (const a of spec.attributes) {
      const attr = geo.getAttribute(a);
      if (attr) hullGeo.setAttribute(a, attr.clone());
    }
    hullGeo.boundingSphere = spec.bounds.clone();
    const hullMat = ctx.own(new MeshBasicMaterial({ color: INK, side: BackSide }));
    patch(hullMat, spec, time, 'hull');
    const hull = new Mesh(hullGeo, hullMat);
    hull.name = `${spec.name}:hull`;
    hull.userData.isOutline = true;
    mesh.add(hull);
  }
  ctx.group.add(mesh);
  return mesh;
}
