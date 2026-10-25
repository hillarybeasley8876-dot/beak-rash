// Weapon meshes (cached geometry per id, shared toon material) and the holder that keeps the current
// weapon in the attacking hand: shouldered (out-up-back, visible from the chase cam) while riding, swung
// along the hand into the rival lane (outward-forward, kept low) while striking. The umbrella has a second
// model — the open canopy it shows while the rider glides (SPEC §15).
import { Mesh, Object3D, Quaternion, Vector3, type BufferGeometry, type Bone } from 'three';
import { riderMaterial } from '../kit/material';
import type { Side, WeaponId } from '../../core/types';
import { CharacterBuilder } from '../kit/builder';
import { hullFor } from '../kit/outline';
import { aimQuat } from '../rig/ik';
import { baguette, leek, pan, saltfish } from './models-a';
import { baton, keyboard, selfie, slipper, umbrella, umbrellaOpen } from './models-b';

type Armed = Exclude<WeaponId, 'none'>;
const BUILD: Record<Armed, (b: CharacterBuilder) => void> = { saltfish, baguette, pan, leek, umbrella, selfie, slipper, keyboard, baton };
/** Weapons with a second model (the umbrella's open canopy, shown while gliding). */
const OPEN: Partial<Record<Armed, (b: CharacterBuilder) => void>> = { umbrella: umbrellaOpen };
const cache = new Map<string, BufferGeometry>();
const Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const dir = new Vector3(), hit = new Vector3(), up = new Vector3(), tv = new Vector3(), inv = new Quaternion();

export function weaponGeometry(id: Armed, open = false): BufferGeometry {
  const key = open ? `${id}|open` : id;
  let g = cache.get(key);
  if (!g) {
    const b = new CharacterBuilder();
    (open ? OPEN[id] ?? BUILD[id] : BUILD[id])(b);
    g = b.build();
    cache.set(key, g);
  }
  return g;
}

/** A standalone weapon mesh with outline (grip at origin, length +Y). */
export function createWeaponMesh(id: Armed, open = false): Mesh {
  const mesh = new Mesh(weaponGeometry(id, open), riderMaterial());
  mesh.name = `weapon:${id}${open ? ':open' : ''}`;
  mesh.add(hullFor(mesh, 0.018));
  return mesh;
}

export class WeaponHolder {
  readonly pivot = new Object3D();
  private mesh: Mesh | null = null;
  private id: WeaponId = 'none';
  private open = false;
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

  /** Is the open model showing (the umbrella's canopy while gliding)? */
  get isOpen(): boolean {
    return this.open;
  }

  set(id: WeaponId, open = false): void {
    if (id === this.id && open === this.open) return;
    if (this.mesh) this.pivot.remove(this.mesh);
    this.mesh = id === 'none' ? null : createWeaponMesh(id as Armed, open);
    if (this.mesh) this.pivot.add(this.mesh);
    this.id = id;
    this.open = id !== 'none' && open;
  }

  /** Move the weapon to the hand of `side` (the swing side). */
  attach(side: Side): void {
    this.side = side;
    const bone = side === -1 ? this.hands[0] : this.hands[1];
    bone.add(this.pivot);
    this.gripOffset(side, this.pivot.position);
  }

  /** Grip point in the hand bone's frame for `side`. */
  gripOffset(side: Side, out: Vector3): Vector3 {
    out.copy(this.fore).multiplyScalar(this.grip);
    if (side === 1) out.x = -out.x;
    return out;
  }

  /** While handed across (RiderExtras), the pivot rides `parent` (the body) with an explicit transform. */
  carry(parent: Object3D, side: Side, pos: Vector3, quat: Quaternion): void {
    this.side = side;
    if (this.pivot.parent !== parent) parent.add(this.pivot);
    this.pivot.position.copy(pos);
    this.pivot.quaternion.copy(quat);
  }

  get armed(): boolean {
    return this.mesh !== null;
  }

  /**
   * Weapon orientation in the frame of the `side` hand: character-space aim re-expressed in the hand bone's frame.
   * `handQ` = hand model rotation, `handDir` = the hand's aim (model space), `strike` 0..1 = shouldered → swinging.
   */
  orient(side: Side, handQ: Quaternion, handDir: Vector3, strike: number, out: Quaternion): Quaternion {
    hit.copy(handDir).add(tv.set(side * 0.6, -0.2, -0.25)).normalize();
    if (hit.y > 0.3) hit.setY(0.3).normalize();
    dir.set(side * 0.55, 0.5, 0.65).normalize().lerp(hit, strike).normalize();
    up.set(side, 0, 0.2).lerp(tv.set(side * 0.3, 0, -1), strike).normalize();
    inv.copy(handQ).invert();
    return aimQuat(Y, Z, dir.applyQuaternion(inv), up.applyQuaternion(inv), out);
  }

  /** Orient the weapon held in its current hand (see orient). */
  aim(handQ: Quaternion, handDir: Vector3, strike: number): void {
    this.pivot.quaternion.copy(this.orient(this.side, handQ, handDir, strike, this.q));
  }

  /** Hold the weapon straight up in the character frame (the umbrella glide): the shaft points at the sky.
   *  `handQ` = the hand bone's model rotation; the pivot's own rotation cancels it. */
  holdUp(handQ: Quaternion): void {
    this.pivot.quaternion.copy(handQ).invert();
  }

  get hand(): Side {
    return this.side;
  }

  /** Weapon length along +Y (wing tip stand-in when unarmed). */
  get length(): number {
    const g = this.mesh?.geometry;
    if (g && !g.boundingBox) g.computeBoundingBox();
    return g?.boundingBox ? g.boundingBox.max.y : 0.16;
  }

  /** Weapon tip in the pivot parent's frame (the hand bone; the body while handed across). */
  tipLocal(out: Vector3): Vector3 {
    return out.set(0, this.length, 0).applyQuaternion(this.pivot.quaternion).add(this.pivot.position);
  }

  /** Weapon tip in world space (call after the rider's matrices are updated). */
  tipWorld(out: Vector3): Vector3 {
    this.pivot.updateWorldMatrix(true, false);
    return out.set(0, this.length, 0).applyMatrix4(this.pivot.matrixWorld);
  }

  dispose(): void {
    this.pivot.removeFromParent();
    this.mesh = null;
  }
}
