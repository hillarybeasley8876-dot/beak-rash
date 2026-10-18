// Draws pickups: one instanced toon mesh (+ outline) per row kind, one shared instanced shadow blob,
// and a toon mesh per dropped weapon. Only items near the player are written each update.
import { InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { easeOutBack, smoothstep } from '../../../core/math';
import type { TrackFrame, WeaponId } from '../../../core/types';
import type { CombatCtx } from '../ctx';
import { instancedToon, toonMesh } from '../meshes/build';
import type { PropLibrary } from '../meshes/library';
import { PICKUP } from '../tuning';
import type { Item, PickupKind } from './items';

type RowKind = Exclude<PickupKind, 'weapon'>;
const SCALE: Record<RowKind, number> = { coin: 1.75, fish: 1.45, crate: 1.3, can: 1.45 };
/** Items shrink away between these distances (m) from the camera, so a passed coin never fills the screen. */
const NEAR_CAMERA = { hide: 1.6, full: 4 } as const;

interface Batch { fill: InstancedMesh; hull: InstancedMesh; n: number; cap: number }

export class PickupRenderer {
  private batches = new Map<RowKind, Batch>();
  private shadow: InstancedMesh;
  private shadowN = 0;
  private drops = new Map<number, Mesh>();
  private frame = {} as TrackFrame;
  private basis = new Matrix4();
  private m = new Matrix4();
  private q = new Quaternion();
  private spin = new Quaternion();
  private tumble = new Quaternion();
  private p = new Vector3();
  private sc = new Vector3();
  private back = new Vector3();
  private axisY = new Vector3(0, 1, 0);
  private axisX = new Vector3(1, 0, 0);

  constructor(private ctx: CombatCtx, private lib: PropLibrary, counts: Record<RowKind, number>) {
    for (const kind of Object.keys(SCALE) as RowKind[]) {
      const cap = counts[kind] + 12;
      const { fill, hull } = instancedToon(lib.get(`pickup:${kind}`), cap, 0.035);
      fill.name = `pickups:${kind}`;
      ctx.root.add(fill);
      this.batches.set(kind, { fill, hull, n: 0, cap });
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) + 64;
    const mat = new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.shadow = new InstancedMesh(lib.get('pickup:shadow'), mat, total);
    this.shadow.count = 0;
    this.shadow.frustumCulled = false;
    this.shadow.name = 'pickups:shadow';
    ctx.root.add(this.shadow);
  }

  begin(): void {
    for (const b of this.batches.values()) b.n = 0;
    this.shadowN = 0;
  }

  /** Write one visible item. `time` drives bob and spin. */
  draw(item: Item, time: number): void {
    const { track } = this.ctx.session;
    track.frameAt(item.s, this.frame);
    const f = this.frame;
    this.basis.makeBasis(
      this.p.set(f.right.x, f.right.y, f.right.z),
      this.sc.set(f.up.x, f.up.y, f.up.z),
      this.back.set(-f.tangent.x, -f.tangent.y, -f.tangent.z),
    );
    this.q.setFromRotationMatrix(this.basis);
    const flying = item.vel !== null;
    const bob = flying ? 0 : Math.sin(time * 2.4 + item.phase * 3) * PICKUP.bob;
    this.spin.setFromAxisAngle(this.axisY, time * PICKUP.spin + item.phase * 2);
    this.q.multiply(this.spin);
    if (flying) this.q.multiply(this.tumble.setFromAxisAngle(this.axisX, time * 9 + item.phase));
    track.toWorld(item.s, item.x, item.y + bob, this.p);
    const fade = smoothstep(NEAR_CAMERA.hide, NEAR_CAMERA.full, this.p.distanceTo(this.ctx.session.app.camera.position));
    const pop = easeOutBack(item.pop) * fade;
    if (item.kind === 'weapon') this.drawDrop(item, pop);
    else if (fade > 0) this.drawRow(item.kind, pop);
    if (fade > 0) this.drawShadow(item, pop);
  }

  private drawRow(kind: RowKind, pop: number): void {
    const b = this.batches.get(kind);
    if (!b || b.n >= b.cap) return;
    const s = SCALE[kind] * pop;
    this.m.compose(this.p, this.q, this.sc.set(s, s, s));
    b.fill.setMatrixAt(b.n++, this.m);
  }

  private drawDrop(item: Item, pop: number): void {
    let mesh = this.drops.get(item.id);
    if (!mesh) {
      const w = item.weapon as Exclude<WeaponId, 'none'>;
      mesh = toonMesh(this.lib.get(`weapon:${w}`), 0.03);
      mesh.name = `pickup:weapon:${w}`;
      this.ctx.root.add(mesh);
      this.drops.set(item.id, mesh);
    }
    mesh.visible = pop > 0;
    mesh.position.copy(this.p);
    mesh.quaternion.copy(this.q).multiply(this.tumble.setFromAxisAngle(this.axisX, item.vel ? 0 : -0.75));
    mesh.scale.setScalar(1.45 * pop);
  }

  private drawShadow(item: Item, pop: number): void {
    if (this.shadowN >= this.shadow.instanceMatrix.count) return;
    const k = Math.max(0.2, 1 - item.y * 0.25) * pop * (item.kind === 'weapon' ? 1.4 : 1);
    this.ctx.session.track.toWorld(item.s, item.x, 0.03, this.p);
    this.q.setFromRotationMatrix(this.basis);
    this.m.compose(this.p, this.q, this.sc.set(k, 1, k));
    this.shadow.setMatrixAt(this.shadowN++, this.m);
  }

  end(): void {
    for (const b of this.batches.values()) {
      b.fill.count = b.hull.count = b.n;
      b.fill.instanceMatrix.needsUpdate = true;
    }
    this.shadow.count = this.shadowN;
    this.shadow.instanceMatrix.needsUpdate = true;
  }

  /** Hide a drop mesh this frame (out of range) or remove it for good. */
  hideDrop(id: number, remove: boolean): void {
    const mesh = this.drops.get(id);
    if (!mesh) return;
    mesh.visible = false;
    if (!remove) return;
    mesh.removeFromParent();
    this.drops.delete(id);
  }

  dispose(): void {
    for (const b of this.batches.values()) {
      b.fill.removeFromParent();
      b.fill.dispose();
      b.hull.dispose();
    }
    for (const mesh of this.drops.values()) mesh.removeFromParent();
    this.drops.clear();
    this.shadow.removeFromParent();
    this.shadow.dispose();
    (this.shadow.material as MeshBasicMaterial).dispose();
  }
}
