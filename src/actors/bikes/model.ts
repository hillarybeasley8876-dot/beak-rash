// One bike instance: shared cached geometry drawn as ONE rigidly skinned mesh (+ its outline hull) over a
// per-instance bone hierarchy (frame → wheels, crank → pedals, headset → steer → front wheel …).
// Markers hang off the bones, so they follow wheels, cranks and the bars exactly.
import { Bone, Group, Matrix4, Object3D, Skeleton, SkinnedMesh, Sphere, type BufferGeometry } from 'three';
import type { BikeId, Quality } from '../../core/types';
import { createAnimator } from './animate';
import { bodyMaterial, hullMaterial } from './build/material';
import { acquire } from './cache';
import type { GroupName, MarkerName } from './template';
import type { BikeMarkers, BikeModel } from './types';

/** Markers plus the bell lever (where a wing tip goes to ring it). */
export interface BikeMarkersEx extends BikeMarkers { bell?: Object3D }

function skinned(geo: BufferGeometry, skeleton: Skeleton, bounds: Sphere, isHull: boolean): SkinnedMesh {
  const mesh = new SkinnedMesh(geo, isHull ? hullMaterial() : bodyMaterial());
  mesh.bind(skeleton, new Matrix4());
  mesh.boundingSphere = bounds.clone();
  if (isHull) {
    mesh.boundingSphere.radius += 0.06;
    mesh.userData.isOutline = true;
    mesh.renderOrder = -1;
  } else {
    mesh.castShadow = true;
    mesh.userData.noOutline = true; // has its own hull; generic outline passes must skip it
  }
  mesh.name = isHull ? 'bike:hull' : 'bike:body';
  return mesh;
}

export function createBikeModel(id: BikeId, opts: { quality: Quality; tint?: string }): BikeModel {
  const lease = acquire(id, opts.quality, opts.tint);
  const { tpl } = lease;
  const root = new Group();
  root.name = `bike:${id}`;
  root.userData.tris = tpl.tris;
  root.userData.drawCalls = tpl.drawCalls;
  const frameBone = new Bone();
  frameBone.name = 'frame';
  root.add(frameBone);
  const bones: Bone[] = [frameBone];
  const nodes = new Map<GroupName, Object3D>();
  const nodeOf = (p: GroupName | null): Object3D => (p ? nodes.get(p) : frameBone) ?? frameBone;
  for (const g of tpl.groups) {
    const bone = new Bone();
    bone.name = g.name;
    bone.position.copy(g.position);
    bone.quaternion.copy(g.quaternion);
    nodeOf(g.parent).add(bone);
    nodes.set(g.name, bone);
    bones.push(bone);
  }
  const skeleton = new Skeleton(bones, [new Matrix4(), ...tpl.groups.map((g) => g.bindInverse)]);
  const bounds = (tpl.built.geo.boundingSphere ?? new Sphere()).clone();
  bounds.radius += 0.12; // steering / fish sway headroom
  root.add(skinned(lease.body, skeleton, bounds, false));
  if (tpl.built.hull) root.add(skinned(tpl.built.hull, skeleton, bounds, true));
  const marks = new Map<MarkerName, Object3D>();
  for (const m of tpl.markers) {
    const o = new Object3D();
    o.name = `marker:${m.name}`;
    o.position.copy(m.position);
    (m.parent ? nodeOf(m.parent) : root).add(o);
    marks.set(m.name, o);
  }
  const need = (n: MarkerName): Object3D => {
    const o = marks.get(n);
    if (!o) throw new Error(`[bikes] ${id} is missing marker ${n}`);
    return o;
  };
  const markers: BikeMarkersEx = {
    saddle: need('saddle'), gripL: need('gripL'), gripR: need('gripR'), pedalL: need('pedalL'), pedalR: need('pedalR'),
    basket: marks.get('basket'), rack: marks.get('rack'), stoker: marks.get('stoker'), bell: marks.get('bell'),
  };
  const steer = nodes.get('steer');
  if (!steer) throw new Error(`[bikes] ${id} has no steer group`);
  const anim = createAnimator(tpl, nodes, marks);
  anim.update(1e-3, 0, 0);
  let disposed = false;
  return {
    id, root, steer, markers,
    wheelRadius: tpl.def.wheelRadius,
    wheelbase: tpl.def.wheelbase,
    get crankAngle() { return anim.crankAngle; },
    update(dt, speed, steerAngle) { anim.update(dt, speed, steerAngle); },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      skeleton.dispose();
      lease.release();
    },
  };
}
