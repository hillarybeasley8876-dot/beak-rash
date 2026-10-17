// Weapon meshes (cached geometry per id, shared toon material) and the holder that keeps the current
// weapon in the attacking hand, pointing up-forward out of the fist, striking face outward.
import { Mesh, Object3D, Quaternion, Vector3, type BufferGeometry, type Bone } from 'three';
import { toon } from '../../render/toon';
import type { Side, WeaponId } from '../../core/types';
import { CharacterBuilder } from '../kit/builder';
import { hullFor } from '../kit/outline';
import { aimQuat } from '../rig/ik';
import { baguette, leek, pan, saltfish } from './models-a';
import { keyboard, selfie, slipper, umbrella } from './models-b';

type Armed = Exclude<WeaponId, 'none'>;
const BUILD: Record<Armed, (b: CharacterBuilder) => void> = { saltfish, baguette, pan, leek, umbrella, selfie, slipper, keyboard };
const cache = new Map<Armed, BufferGeometry>();

export function weaponGeometry(id: Armed): BufferGeometry {
  let g = cache.get(id);
  if (!g) {
    const b = new CharacterBuilder();
    BUILD[id](b);
    g = b.build();
    cache.set(id, g);
  }
  return g;
}

/** A standalone weapon mesh with outline (grip at origin, length +Y). */
export function createWeaponMesh(id: Armed): Mesh {
  const mesh = new Mesh(weaponGeometry(id), toon('#ffffff', { vertexColors: true }));
  mesh.name = `weapon:${id}`;
  mesh.add(hullFor(mesh, 0.018));
  return mesh;
}

export class WeaponHolder {
  readonly pivot = new Object3D();
  private mesh: Mesh | null = null;
  private id: WeaponId = 'none';
  private side: Side = 1;
  private readonly q = new Quaternion();

  /** `hands` = [left, right] hand bones; `fore` = left forearm bind direction (unit, character space). */
  constructor(private readonly hands: readonly [Bone, Bone], private readonly fore: Vector3, private readonly grip: number) {
    this.pivot.name = 'weapon-pivot';
    this.attach(1);
  }

  get current(): WeaponId {
    return this.id;
  }

  set(id: WeaponId): void {
    if (id === this.id) return;
    if (this.mesh) this.pivot.remove(this.mesh);
    this.mesh = id === 'none' ? null : createWeaponMesh(id);
    if (this.mesh) this.pivot.add(this.mesh);
    this.id = id;
  }

  /** Move the weapon to the hand of `side` (the swing side). */
  attach(side: Side): void {
    this.side = side;
    const bone = side === -1 ? this.hands[0] : this.hands[1];
    bone.add(this.pivot);
    const f = this.fore.clone();
    if (side === 1) f.x = -f.x;
    const dir = f.clone().lerp(new Vector3(0, 1, 0), 0.62).normalize();
    aimQuat(new Vector3(0, 1, 0), new Vector3(0, 0, 1), dir, new Vector3(side, 0, 0), this.q);
    this.pivot.quaternion.copy(this.q);
    this.pivot.position.copy(f).multiplyScalar(this.grip);
  }

  get hand(): Side {
    return this.side;
  }

  /** Weapon tip in the hand bone's frame (wing tip stand-in when unarmed). */
  tipLocal(out: Vector3): Vector3 {
    const g = this.mesh?.geometry;
    if (g && !g.boundingBox) g.computeBoundingBox();
    const len = g?.boundingBox ? g.boundingBox.max.y : 0.16;
    return out.set(0, len, 0).applyQuaternion(this.pivot.quaternion).add(this.pivot.position);
  }

  dispose(): void {
    this.pivot.removeFromParent();
    this.mesh = null;
  }
}
