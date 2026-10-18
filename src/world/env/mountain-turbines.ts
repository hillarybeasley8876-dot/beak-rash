// Sunset Pass wind turbines (env-mountain): tall white turbines on a far ridge. Towers + nacelles go
// into the dressing's far batch (static, unoutlined); all rotors share one GPU-animated mesh that
// spins each blade set about its own hub.
import { BufferAttribute, Color, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import type { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { MeshBuf } from '../geom';
import { box, cylinder, sphere, trs } from '../kit/shapes';
import { animatedMesh } from './mountain-anim';

const WHITE = new Color('#f3eee9'), GREY = new Color('#cfc8cf'), RED = new Color('#e5191c');
const m = new Matrix4(), q = new Quaternion(), sc = new Vector3(), v = new Vector3();
const HEIGHT = 58, BLADE = 25;

export interface TurbineSite { x: number; y: number; z: number }

/** Tower + nacelle at a site (rotor faces `facing`, unit horizontal). */
function towerAt(buf: MeshBuf, p: TurbineSite, facing: Vector3): Vector3 {
  cylinder(buf, trs(p.x, p.y - 2, p.z, 0, 1.9, HEIGHT + 2, 1.9, m), WHITE, 10, 1, 0.55, false);
  const yaw = Math.atan2(facing.x, facing.z);
  box(buf, trs(p.x - facing.x * 1.5, p.y + HEIGHT + 1.2, p.z - facing.z * 1.5, yaw, 3.2, 3.0, 8.5, m), GREY);
  return new Vector3(p.x + facing.x * 3.4, p.y + HEIGHT + 1.3, p.z + facing.z * 3.4);
}

/** Three tapered blades + spinner around `hub`, in the plane facing `facing`. */
function rotorAt(buf: MeshBuf, hub: Vector3, facing: Vector3, phase: number, aHub: number[], aAxis: number[]): void {
  const start = buf.count;
  const side = new Vector3().crossVectors(facing, new Vector3(0, 1, 0)).normalize();
  sphere(buf, m.compose(hub, q.identity(), sc.set(1.3, 1.3, 1.3)), WHITE, 8, 5);
  for (let k = 0; k < 3; k++) {
    const a = phase + (k * Math.PI * 2) / 3;
    const dir = new Vector3().copy(side).multiplyScalar(Math.cos(a)).addScaledVector(new Vector3(0, 1, 0), Math.sin(a));
    q.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    // Blade = flattened tapered cylinder along dir, with a red tip band.
    m.compose(v.copy(hub).addScaledVector(dir, 0.8), q, sc.set(0.9, BLADE * 0.88, 0.25));
    cylinder(buf, m, WHITE, 6, 1, 0.35, false);
    m.compose(v.copy(hub).addScaledVector(dir, 0.8 + BLADE * 0.88), q, sc.set(0.31, BLADE * 0.12, 0.09));
    cylinder(buf, m, RED, 6, 1, 0.4, true);
  }
  for (let i = start; i < buf.count; i++) {
    aHub.push(hub.x, hub.y, hub.z);
    aAxis.push(facing.x, facing.y, facing.z);
  }
}

const DECL = /* glsl */`attribute vec3 aHub; attribute vec3 aAxis;`;
// Rodrigues rotation of the vertex about its hub; speed varies a little per turbine.
const MOTION = /* glsl */`
{
  float ang = uLifeTime * (0.9 + 0.25 * fract(aHub.x * 0.013)) + aHub.z * 0.01;
  vec3 p = transformed - aHub;
  float c = cos(ang), s = sin(ang);
  transformed = aHub + p * c + cross(aAxis, p) * s + aAxis * dot(aAxis, p) * (1.0 - c);
}`;

/** Turbines at `sites`: towers into `far` (static), rotors as one animated mesh. */
export function buildTurbines(ctx: WorldCtx, far: (x: number, z: number) => MeshBuf, sites: TurbineSite[], facing: Vector3, rng: Rng): void {
  if (!sites.length) return;
  const rotors = new MeshBuf();
  const aHub: number[] = [], aAxis: number[] = [];
  const bounds = new Sphere();
  const pts: Vector3[] = [];
  for (const p of sites) {
    const hub = towerAt(far(p.x, p.z), p, facing);
    rotorAt(rotors, hub, facing, rng.range(0, 6.28), aHub, aAxis);
    pts.push(hub);
  }
  const geo = rotors.build();
  geo.setAttribute('aHub', new BufferAttribute(new Float32Array(aHub), 3));
  geo.setAttribute('aAxis', new BufferAttribute(new Float32Array(aAxis), 3));
  bounds.setFromPoints(pts);
  bounds.radius += BLADE + 4;
  animatedMesh(ctx, geo, { name: 'turbineRotors', decl: DECL, motion: MOTION, attributes: ['aHub', 'aAxis'], outline: 0.18, bounds });
  ctx.log(`wind turbines: ${sites.length}`);
}
