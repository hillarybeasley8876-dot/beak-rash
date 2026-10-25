// One bike instance: shared cached geometry drawn as ONE rigidly skinned mesh (+ its outline hull) over a
// per-instance bone hierarchy (frame → wheels, crank → pedals, headset → steer → front wheel …).
// Markers hang off the bones, so they follow wheels, cranks and the bars exactly. A second, low-poly level (the
// far LOD: no spokes detail / chain / cranks / cables, see PartSet.detail) rides the same bones; setLod() swaps.
import { Bone, Group, Matrix4, Mesh, Object3D, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3, type BufferGeometry } from 'three';
import type { BikeId, Quality } from '../../core/types';
import { createAnimator } from './animate';
import { bodyMaterial, depthMaterial, hullMaterial } from './build/material';
import { acquire, type BikeTemplate } from './cache';
import { createDuckRider, duckRiderWanted } from './duck';
import type { GroupName, MarkerName } from './template';
import type { BikeMarkers, BikeModel } from './types';

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
    mesh.customDepthMaterial = depthMaterial();
    mesh.userData.noOutline = true; // has its own hull; generic outline passes must skip it
  }
  mesh.name = isHull ? 'bike:hull' : 'bike:body';
  return mesh;
}

/** One LOD level over the shared skeleton: [body, hull?]. The far level starts hidden, named `…:far` and tagged
 *  userData.lod = 'far' (a stand-in of the full one: whoever walks the bike's meshes may skip it). */
function level(body: BufferGeometry, tpl: BikeTemplate, skeleton: Skeleton, bounds: Sphere,
  far: boolean): SkinnedMesh[] {
  const out = [skinned(body, skeleton, bounds, false)];
  if (tpl.built.hull) out.push(skinned(tpl.built.hull, skeleton, bounds, true));
  if (far) for (const m of out) { m.name += ':far'; m.userData.lod = 'far'; m.visible = false; }
  return out;
}

/** The player is the only rider whose bike is created without a rival tint (actors/view.ts gives every
 *  rival its accent colour), so an untinted bike is the player's. */
function isPlayerBike(opts: { tint?: string; player?: boolean }): boolean {
  return opts.player ?? opts.tint === undefined;
}

export function createBikeModel(id: BikeId, opts: { quality: Quality; tint?: string; player?: boolean }): BikeModel {
  const lease = acquire(id, opts.quality, opts.tint);
  const { tpl } = lease;
  const root = new Group();
  root.name = `bike:${id}`;
  root.userData.tris = tpl.tris;
  root.userData.drawCalls = tpl.drawCalls;
  root.userData.farTris = lease.far.tris;
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
  const [nearBody, nearHull] = level(lease.body, tpl, skeleton, bounds, false);
  const [farBody, farHull] = level(lease.farBody, lease.far, skeleton, bounds, true);
  for (const m of [nearBody, nearHull, farBody, farHull]) if (m) root.add(m);
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
  const markers: BikeMarkers = {
    saddle: need('saddle'), gripL: need('gripL'), gripR: need('gripR'), pedalL: need('pedalL'), pedalR: need('pedalR'),
    basket: marks.get('basket'), rack: marks.get('rack'), stoker: marks.get('stoker'), bell: marks.get('bell'),
  };
  const steer = nodes.get('steer');
  if (!steer) throw new Error(`[bikes] ${id} has no steer group`);
  // Extras live outside the merged geometry: the LLM chain to the rider's neck.
  const extras: Object3D[] = tpl.def.extras?.() ?? [];
  for (const o of extras) root.add(o);
  // The rubber-duck passenger (SPEC §21 #1): on the bars of the player's bike, turning with them.
  let duck: Object3D | null = null;
  if (isPlayerBike(opts) && duckRiderWanted()) {
    duck = createDuckRider();
    const bell = marks.get('bell');
    const gl = marks.get('gripL'), gr = marks.get('gripR');
    const bar = bell ? bell.position.clone()
      : gl && gr ? gl.position.clone().add(gr.position).multiplyScalar(0.5)
        : new Vector3();
    // The bell sits on the bar's centre: the duck perches right next to it, on the bar's top.
    duck.position.copy(bar).add(new Vector3(0.075, -0.005, 0.005));
    steer.updateWorldMatrix(true, false);
    duck.quaternion.copy(steer.getWorldQuaternion(new Quaternion()).invert());
    steer.add(duck);
  }
  const anim = createAnimator(tpl, nodes, marks);
  anim.update(1e-3, 0, 0);
  let disposed = false;
  return {
    id, root, steer, markers,
    wheelRadius: tpl.def.wheelRadius,
    wheelbase: tpl.def.wheelbase,
    get crankAngle() { return anim.crankAngle; },
    update(dt, speed, steerAngle) { anim.update(dt, speed, steerAngle); },
    setLod(far, outline) {
      if (nearBody) { nearBody.visible = !far; nearBody.castShadow = outline; }
      if (nearHull) nearHull.visible = !far && outline;
      if (farBody) { farBody.visible = far; farBody.castShadow = outline; }
      if (farHull) farHull.visible = far && outline;
      // The chain and the duck are near-LOD details: at 35 m they are under a pixel.
      for (const o of extras) o.visible = !far;
      if (duck) duck.visible = !far;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      skeleton.dispose();
      for (const o of [...extras, ...(duck ? [duck] : [])]) {
        o.traverse((c) => { if (c instanceof Mesh) c.geometry.dispose(); });
      }
      lease.release();
    },
  };
}
