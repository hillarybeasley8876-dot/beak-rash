// The gobi's industry: wind turbines on the ridge (towers static, rotors spinning on the GPU) and
// nodding oil pumpjacks (the walking beam rocks on its pivot, a few matrix updates per frame).
import { BufferAttribute, Group, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import { MeshBuf } from '../../geom';
import { box, cylinder, trs } from '../../kit/shapes';
import { animatedMesh } from '../../env/mountain-anim';
import { bufMesh } from './batch';
import { C } from './kit';
import { rod } from './critters';
import type { GobiCtx } from './gctx';

const m = new Matrix4(), q = new Quaternion(), sc = new Vector3(), v = new Vector3();
const UP = new Vector3(0, 1, 0);

const TOWER_H = 52;
const BLADE = 24;

export interface TurbineSite { x: number; y: number; z: number; ax: number; az: number; phase: number }

/** One turbine: the tower goes into the far batch, the rotor is returned for the animated mesh. */
export function turbine(g: GobiCtx, x: number, y: number, z: number, ax: number, az: number): TurbineSite {
  const buf = g.far.at(x, z);
  cylinder(buf, trs(x, y - 1.5, z, 0, 1.8, TOWER_H + 1.5, 1.8, m), C.white, 12, 1, 0.42, false);
  // Nacelle: a stub box pointing along the rotor axis.
  const yaw = Math.atan2(ax, az);
  box(buf, trs(x + ax * 2.2, y + TOWER_H + 1.1, z + az * 2.2, yaw, 2.6, 2.4, 7.2, m), C.steel);
  return { x, y, z, ax, az, phase: g.rng.range(0, 6.28) };
}

/** All the turbine rotors in one animated mesh (one draw call): each blade set spins about its hub. */
export function buildTurbineRotors(g: GobiCtx, sites: TurbineSite[]): void {
  if (!sites.length) return;
  const rotors = new MeshBuf();
  const aHub: number[] = [], aAxis: number[] = [];
  const pts: Vector3[] = [];
  const side = new Vector3();
  for (const site of sites) {
    const facing = new Vector3(site.ax, 0, site.az).normalize();
    const hub = new Vector3(site.x + facing.x * 5.2, site.y + TOWER_H + 1.2, site.z + facing.z * 5.2);
    pts.push(hub);
    side.crossVectors(facing, UP).normalize();
    const start = rotors.count;
    for (let k = 0; k < 3; k++) {
      const a = site.phase + (k * Math.PI * 2) / 3;
      const dir = new Vector3().copy(side).multiplyScalar(Math.cos(a)).addScaledVector(UP, Math.sin(a));
      q.setFromUnitVectors(UP, dir);
      m.compose(v.copy(hub).addScaledVector(dir, 0.6), q, sc.set(0.85, BLADE * 0.88, 0.24));
      cylinder(rotors, m, C.white, 6, 1, 0.32, false);
      m.compose(v.copy(hub).addScaledVector(dir, 0.6 + BLADE * 0.88), q, sc.set(0.3, BLADE * 0.12, 0.09));
      cylinder(rotors, m, C.red, 6, 1, 0.4, true);
    }
    for (let i = start; i < rotors.count; i++) {
      aHub.push(hub.x, hub.y, hub.z);
      aAxis.push(facing.x, facing.y, facing.z);
    }
  }
  const geo = rotors.build();
  geo.setAttribute('aHub', new BufferAttribute(new Float32Array(aHub), 3));
  geo.setAttribute('aAxis', new BufferAttribute(new Float32Array(aAxis), 3));
  const bounds = new Sphere();
  bounds.setFromPoints(pts);
  bounds.radius += BLADE + 4;
  const decl = 'attribute vec3 aHub; attribute vec3 aAxis;';
  const motion = `
{
  float ang = uLifeTime * (0.5 + 0.18 * fract(aHub.x * 0.013)) + aHub.z * 0.01;
  vec3 p = transformed - aHub;
  float c = cos(ang), s = sin(ang);
  transformed = aHub + p * c + cross(aAxis, p) * s + aAxis * dot(aAxis, p) * (1.0 - c);
}`;
  const mesh = animatedMesh(g.ctx, geo, { name: 'gobiTurbineRotors', decl, motion, attributes: ['aHub', 'aAxis'], outline: 0.16, bounds });
  g.group.add(mesh);
  g.ctx.log(`gobi: ${sites.length} wind turbines`);
}

/** Oil pumpjack: static frame in the merged batch, walking beam on a pivot that nods. */
export function pumpjack(g: GobiCtx, x: number, y: number, z: number, yaw: number): void {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const buf = g.props.at(x, z);
  // Base and motor house.
  box(buf, trs(x, y + 0.25, z, yaw, 7.2, 0.5, 2.6, m), C.steelDark);
  box(buf, trs(x - fx * 2.6, y + 1.1, z - fz * 2.6, yaw, 2.6, 1.8, 2.2, m), C.red);
  // Samson post: two legs up to the pivot.
  const px = x + fx * 0.4, pz = z + fz * 0.4, py = y + 6.2;
  for (const side of [-1, 1]) {
    rod(buf, new Vector3(px + rx * side * 1.5, y + 0.4, pz + rz * side * 1.5), new Vector3(px + rx * side * 0.35, py, pz + rz * side * 0.35),
      0.16, C.steel, 5);
  }
  box(buf, trs(px, py - 0.1, pz, yaw, 1.2, 0.4, 1.2, m), C.steelDark);
  // The walking beam (moves): built around the pivot, in local space.
  const beam = new MeshBuf();
  box(beam, trs(0, 0, 0, 0, 7.0, 0.42, 0.62, m), C.steel);
  box(beam, trs(3.9, -0.5, 0, 0, 1.2, 1.4, 1.0, m), C.steelDark);         // horsehead
  box(beam, trs(-3.2, -0.45, 0, 0, 1.5, 1.0, 1.4, m), C.steelDark);        // counterweight
  rod(beam, new Vector3(0, -0.2, 0), new Vector3(4.1, -1.1, 0), 0.07, C.steelDark, 4);  // horsehead link
  // The holder carries the yaw; the beam inside carries the nod.
  const holder = new Group();
  holder.position.set(px, py, pz);
  holder.rotation.y = yaw;
  holder.name = 'gobi-pumpjack';
  g.group.add(holder);
  const beamMesh = bufMesh(g.ctx, holder, 'gobi-pumpjack-beam', beam);
  g.nod.push({ obj: beamMesh, phase: g.rng.range(0, 6.28), amp: 0.26, speed: 1.1 });
}
