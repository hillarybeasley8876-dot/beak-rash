// Sunset Pass cable car (env-mountain): a single-span ropeway between two stations, two sagging
// track lines, and gondolas riding up one line and down the other. Stations + cables are static
// (dressing props batch); all gondolas share one GPU-animated mesh.
import { BufferAttribute, Color, Matrix4, Sphere, Vector3 } from 'three';
import type { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { MeshBuf } from '../geom';
import { box, cylinder, trs } from '../kit/shapes';
import { rod } from '../scenery/props/mountain-bridge';
import { sagAt } from '../scenery/props/mountain-deco';
import { animatedMesh } from './mountain-anim';

const C = (h: string): Color => new Color(h);
const PAL = {
  cab: [C('#e5191c'), C('#f4efe6'), C('#ffcf3a'), C('#e5191c'), C('#2f6fd6')], glass: C('#bfe3ff'), dark: C('#2a2630'),
  station: C('#efe2cc'), roof: C('#7a2e22'), steel: C('#8f96a0'), cable: C('#24212a'),
};
const m = new Matrix4();
const GAP = 3.2, PER_LINE = 6, SPEED = 5.5;

export interface RopewaySpec { a: Vector3; b: Vector3; sag: number }


/** Station building under the bullwheel at p (yaw = cable direction). */
function station(buf: MeshBuf, p: Vector3, yaw: number, ground: number): void {
  const h = Math.max(4, p.y - ground - 1.2);
  box(buf, trs(p.x, ground + h / 2 - 1, p.z, yaw, 2 * GAP + 6, h + 2, 11, m), PAL.station);
  box(buf, trs(p.x, ground + h + 0.6, p.z, yaw, 2 * GAP + 7.5, 0.6, 12.5, m), PAL.roof);
  cylinder(buf, trs(p.x, p.y - 0.35, p.z, 0, GAP + 0.4, 0.35, GAP + 0.4, m), PAL.steel, 16);
  for (const k of [-1, 1]) box(buf, trs(p.x + Math.cos(yaw) * k * (GAP + 2.4), ground + h + 3.2, p.z - Math.sin(yaw) * k * (GAP + 2.4), yaw, 0.5, 5.2, 0.5, m), PAL.steel);
}

/** Gondola cabin hanging below the grip (local origin), turned to `yaw`. */
function gondola(buf: MeshBuf, yaw: number, col: Color): void {
  box(buf, trs(0, -1.2, 0, yaw, 0.14, 2.4, 0.14, m), PAL.dark);
  box(buf, trs(0, -2.55, 0, yaw, 2.2, 0.3, 2.2, m), PAL.dark);
  box(buf, trs(0, -3.6, 0, yaw, 2.0, 1.9, 2.0, m), col);
  box(buf, trs(0, -3.35, 0, yaw, 2.04, 0.7, 2.04, m), PAL.glass);
}

const DECL = /* glsl */`attribute vec2 aRide; uniform vec3 uA0; uniform vec3 uB0; uniform vec3 uA1; uniform vec3 uB1; uniform float uSag; uniform float uSpeed;`;
const MOTION = /* glsl */`
{
  float t = fract(uLifeTime * uSpeed + aRide.x);
  vec3 p = aRide.y < 0.5 ? mix(uA0, uB0, t) : mix(uB1, uA1, t);
  p.y -= uSag * 4.0 * t * (1.0 - t);
  transformed.x += sin(uLifeTime * 1.3 + aRide.x * 20.0) * 0.06 * position.y;
  transformed += p;
}`;

/** Ropeway: stations + cables into `props` (static), gondolas as one animated mesh. */
export function buildRopeway(ctx: WorldCtx, props: (x: number, z: number) => MeshBuf, spec: RopewaySpec, rng: Rng): void {
  const { a, b, sag } = spec;
  const dir = new Vector3().subVectors(b, a).setY(0).normalize();
  const side = new Vector3(-dir.z, 0, dir.x);
  const yaw = Math.atan2(dir.x, dir.z);
  const ends = [[a.clone().addScaledVector(side, GAP), b.clone().addScaledVector(side, GAP)], [a.clone().addScaledVector(side, -GAP), b.clone().addScaledVector(side, -GAP)]] as Array<[Vector3, Vector3]>;
  station(props(a.x, a.z), a, yaw, ctx.groundWorld(a.x, a.z));
  station(props(b.x, b.z), b, yaw, ctx.groundWorld(b.x, b.z));
  for (const [p0, p1] of ends) {
    let prev = p0;
    for (let i = 1; i <= 24; i++) {
      const p = sagAt(p0, p1, i / 24, sag);
      rod(props(p.x, p.z), prev, p, 0.09, PAL.cable, 4);
      prev = p;
    }
  }
  const cars = new MeshBuf();
  const ride: number[] = [];
  for (let line = 0; line < 2; line++) {
    for (let k = 0; k < PER_LINE; k++) {
      const start = cars.count;
      gondola(cars, yaw, rng.pick(PAL.cab));
      for (let i = start; i < cars.count; i++) ride.push((k + line * 0.5) / PER_LINE, line);
    }
  }
  const geo = cars.build();
  geo.setAttribute('aRide', new BufferAttribute(new Float32Array(ride), 2));
  const len = a.distanceTo(b);
  const bounds = new Sphere(new Vector3().lerpVectors(a, b, 0.5), len / 2 + 12);
  const [l0, l1] = ends as [[Vector3, Vector3], [Vector3, Vector3]];
  animatedMesh(ctx, geo, {
    name: 'gondolas', decl: DECL, motion: MOTION, attributes: ['aRide'], outline: 0.06, bounds,
    uniforms: {
      uA0: { value: l0[0] }, uB0: { value: l0[1] }, uA1: { value: l1[0] }, uB1: { value: l1[1] },
      uSag: { value: sag }, uSpeed: { value: SPEED / len },
    },
  });
  ctx.log(`ropeway ${Math.round(len)} m, sag ${sag.toFixed(1)}`);
}
