// Instanced rendering for traffic: per type one paint + one trim mesh (+ decals) sharing an instance
// matrix buffer with their outline hulls; global wheel and lamp pools. ~2–5 draw calls per type in view.
import {
  BoxGeometry, BufferGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3,
  type Material,
} from 'three';
import { outlineMaterial, toon } from '../../../render/toon';
import { buildModel, buildWheel, WHEEL_R, type VehicleModel } from './models';
import { createDecalAtlas, type DecalAtlas } from './decals';
import { VEHICLES, VEHICLE_TYPES, type VehicleType } from './types';

export const MAX_VEHICLES = 32;
const STRIDE = 6;                 // wheel / lamp instances reserved per vehicle
const OUTLINE_W = 0.04;
const INK = '#0b0b0f';            // outline colour (same as render/toon outline())
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const BLINK_COLOR = new Color('#ffab1a');
const BRAKE_COLOR = new Color('#ff2a2a');

interface TypeMeshes {
  model: VehicleModel;
  meshes: InstancedMesh[];        // paint first; all share paint.instanceMatrix
  slots: SlotPool;
}

/** Lowest-free-first slot pool, so draw counts can be trimmed to the highest slot in use. */
class SlotPool {
  private used = new Set<number>();
  constructor(readonly cap: number) {}

  take(): number | null {
    for (let i = 0; i < this.cap; i++) {
      if (!this.used.has(i)) {
        this.used.add(i);
        return i;
      }
    }
    return null;
  }

  give(i: number): void {
    this.used.delete(i);
  }

  /** Instances that must be drawn: highest used slot + 1. */
  get span(): number {
    let top = -1;
    for (const i of this.used) top = Math.max(top, i);
    return top + 1;
  }
}

export interface VehiclePose {
  body: Matrix4;
  wheelAngle: number;
  blinkL: boolean;
  blinkR: boolean;
  braking: boolean;
}

export class TrafficRender {
  readonly group = new Group();
  private types = new Map<VehicleType, TypeMeshes>();
  private wheels: InstancedMesh;
  private wheelHull: InstancedMesh;
  private lamps: InstancedMesh;
  private global = new SlotPool(MAX_VEHICLES);
  private atlas: DecalAtlas;
  private m = new Matrix4();
  private t = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private sc = new Vector3();

  /** Night tracks: headlights and tail lights always on (bloom makes them glow). */
  private night: InstancedMesh | null = null;

  constructor(adText: string, night = false) {
    this.group.name = 'race:traffic';
    this.atlas = createDecalAtlas(adText);
    const hullMat = outlineMaterial(INK, OUTLINE_W);
    for (const type of VEHICLE_TYPES) this.types.set(type, this.buildType(type, hullMat));
    const wheelGeo = buildWheel();
    const cap = MAX_VEHICLES * STRIDE;
    this.wheels = this.instanced(wheelGeo, toon('#ffffff', { vertexColors: true }), cap);
    this.wheels.castShadow = true;
    this.wheelHull = this.instanced(wheelGeo, outlineMaterial(INK, 0.03), cap);
    this.wheelHull.instanceMatrix = this.wheels.instanceMatrix;
    this.lamps = this.instanced(new BoxGeometry(0.2, 0.15, 0.1), new MeshBasicMaterial({ color: '#ffffff' }), cap);
    for (let i = 0; i < cap; i++) {
      this.wheels.setMatrixAt(i, HIDDEN);
      this.lamps.setMatrixAt(i, HIDDEN);
      this.lamps.setColorAt(i, i % STRIDE < 4 ? BLINK_COLOR : BRAKE_COLOR);
    }
    if (night) this.night = this.nightLamps();
    this.trimGlobal();
    for (const tm of this.types.values()) this.trimType(tm);
  }

  private nightLamps(): InstancedMesh {
    const cap = MAX_VEHICLES * 4;
    const mesh = this.instanced(new BoxGeometry(0.4, 0.2, 0.08), new MeshBasicMaterial({ color: '#ffffff' }), cap);
    const head = new Color('#fff3c0').multiplyScalar(1.6), tail = new Color('#d01020');
    for (let i = 0; i < cap; i++) {
      mesh.setMatrixAt(i, HIDDEN);
      mesh.setColorAt(i, i % 4 < 2 ? head : tail);
    }
    return mesh;
  }

  private instanced(geo: BufferGeometry, mat: Material, cap: number): InstancedMesh {
    const mesh = new InstancedMesh(geo, mat, cap);
    mesh.frustumCulled = false;
    mesh.userData.noOutline = true;
    this.group.add(mesh);
    return mesh;
  }

  private buildType(type: VehicleType, hullMat: Material): TypeMeshes {
    const def = VEHICLES[type];
    const model = buildModel(type);
    const paint = this.instanced(model.paint, toon('#ffffff', { vertexColors: true }), def.cap);
    const trim = this.instanced(model.trim, toon('#ffffff', { vertexColors: true }), def.cap);
    paint.castShadow = trim.castShadow = true;
    const meshes = [paint, trim];
    if (model.decal) meshes.push(this.instanced(model.decal, this.atlas.material, def.cap));
    meshes.push(this.instanced(model.paint, hullMat, def.cap), this.instanced(model.trim, hullMat, def.cap));
    for (const mesh of meshes) {
      mesh.instanceMatrix = paint.instanceMatrix;
      mesh.visible = false;
    }
    for (let i = 0; i < def.cap; i++) {
      paint.setMatrixAt(i, HIDDEN);
      paint.setColorAt(i, new Color('#ffffff'));
    }
    return { model, meshes, slots: new SlotPool(def.cap) };
  }

  private trimType(tm: TypeMeshes): void {
    const span = tm.slots.span;
    for (const mesh of tm.meshes) {
      mesh.count = span;
      mesh.visible = span > 0;
    }
  }

  private trimGlobal(): void {
    const span = this.global.span;
    this.wheels.count = this.wheelHull.count = this.lamps.count = span * STRIDE;
    if (this.night) this.night.count = span * 4;
  }

  /** Reserve instances; returns [typeSlot, globalSlot] or null when that type is at capacity. */
  alloc(type: VehicleType, color: string): [number, number] | null {
    const tm = this.types.get(type);
    if (!tm) return null;
    const slot = tm.slots.take();
    if (slot === null) return null;
    const g = this.global.take();
    if (g === null) {
      tm.slots.give(slot);
      return null;
    }
    const paint = tm.meshes[0] as InstancedMesh;
    paint.setColorAt(slot, new Color(color));
    if (paint.instanceColor) paint.instanceColor.needsUpdate = true;
    this.trimType(tm);
    this.trimGlobal();
    return [slot, g];
  }

  free(type: VehicleType, slot: number, g: number): void {
    const tm = this.types.get(type);
    if (!tm) return;
    (tm.meshes[0] as InstancedMesh).setMatrixAt(slot, HIDDEN);
    for (let i = 0; i < STRIDE; i++) {
      this.wheels.setMatrixAt(g * STRIDE + i, HIDDEN);
      this.lamps.setMatrixAt(g * STRIDE + i, HIDDEN);
    }
    for (let i = 0; i < 4; i++) this.night?.setMatrixAt(g * 4 + i, HIDDEN);
    tm.slots.give(slot);
    this.global.give(g);
    this.trimType(tm);
    this.trimGlobal();
  }

  /** Place one vehicle: body, spinning wheels, blinkers and brake lights. */
  pose(type: VehicleType, slot: number, g: number, p: VehiclePose): void {
    const tm = this.types.get(type);
    if (!tm) return;
    const def = VEHICLES[type];
    (tm.meshes[0] as InstancedMesh).setMatrixAt(slot, p.body);
    const k = def.wheelR / WHEEL_R;
    this.sc.set(k, k, k);
    this.q.setFromAxisAngle(this.v.set(1, 0, 0), -p.wheelAngle / def.wheelR);
    def.wheels.forEach(([wx, wz], i) => {
      this.t.compose(this.v.set(wx, def.wheelR, wz), this.q, this.sc);
      this.wheels.setMatrixAt(g * STRIDE + i, this.m.multiplyMatrices(p.body, this.t));
    });
    const lamp = (i: number, at: readonly number[] | undefined, on: boolean): void => {
      if (!at || !on) { this.lamps.setMatrixAt(g * STRIDE + i, HIDDEN); return; }
      this.t.makeTranslation(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
      this.lamps.setMatrixAt(g * STRIDE + i, this.m.multiplyMatrices(p.body, this.t));
    };
    const { blink, brake, head } = tm.model;
    lamp(0, blink[0], p.blinkL); lamp(1, blink[1], p.blinkR); lamp(2, blink[2], p.blinkL); lamp(3, blink[3], p.blinkR);
    lamp(4, brake[0], p.braking); lamp(5, brake[1], p.braking);
    const night = this.night;
    if (!night) return;
    [head[0], head[1], brake[0], brake[1]].forEach((at, i) => {
      this.t.makeTranslation(at?.[0] ?? 0, at?.[1] ?? 0, (at?.[2] ?? 0) + (i < 2 ? -0.01 : 0.01));
      night.setMatrixAt(g * 4 + i, this.m.multiplyMatrices(p.body, this.t));
    });
  }

  /** Upload this frame's instance matrices. */
  commit(): void {
    for (const tm of this.types.values()) if (tm.slots.span > 0) (tm.meshes[0] as InstancedMesh).instanceMatrix.needsUpdate = true;
    this.wheels.instanceMatrix.needsUpdate = true;
    this.lamps.instanceMatrix.needsUpdate = true;
    if (this.night) this.night.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const tm of this.types.values()) {
      tm.model.paint.dispose();
      tm.model.trim.dispose();
      tm.model.decal?.dispose();
      for (const mesh of tm.meshes) mesh.dispose();
    }
    this.wheels.geometry.dispose();
    this.wheels.dispose();
    this.wheelHull.dispose();
    this.lamps.geometry.dispose();
    (this.lamps.material as Material).dispose();
    this.lamps.dispose();
    if (this.night) {
      this.night.geometry.dispose();
      (this.night.material as Material).dispose();
      this.night.dispose();
    }
    this.atlas.dispose();
  }
}
