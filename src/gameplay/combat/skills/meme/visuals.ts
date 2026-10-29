// The meme roster's own visuals (SPEC §24, job r6-skills-meme): the dropped banana peels, the crying cat's
// little rain cloud and the hamster's violin. Every mesh is a shared library geometry with the shared toon
// material (render/toon.ts caches it), so a cast never builds a material; each visual removes its meshes again.
import { Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { RiderState } from '../../../../core/types';
import { toonMesh } from '../../meshes/build';
import type { PropKey } from '../../meshes/catalog';
import { Follower } from '../../visuals/follower';
import { frameQuat } from '../../visuals/frame';
import type { Visual, VisualSystem } from '../../visuals/visuals';

const OFF = new Vector3();
const SPIN = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/** Where a peel was tossed from, where it lands on the road, and when it went up (s, x, s). */
export interface PeelSpot { s: number; x: number; at: number; fromS: number; fromX: number }

/** The toss: how long a peel is in the air, how high it goes, and how big it reads. */
export interface PeelFlight { flight: number; apex: number; launch: number; air: number; ground: number; slick: number; halo: number }

/**
 * The banana peels: each one is tossed up over the cat's head in a visible arc and lands behind it, so the chase
 * camera sees all three go (a peel dropped straight down behind the rider lands under the camera and is never
 * read). Landed peels sit on a pulsing slick and stay until the skill ends.
 */
export class PeelField implements Visual {
  private meshes: Mesh[] = [];
  private slicks: Mesh[] = [];
  private halos: Mesh[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private peels: readonly PeelSpot[], private dur: number, private o: PeelFlight) {
    for (const _ of peels) {
      const m = toonMesh(vs.ctx.lib.get('meme:peel'), 0.03);
      m.visible = false;
      vs.ctx.root.add(m);
      this.meshes.push(m);
      const slick = new Mesh(vs.ctx.lib.get('aura:disc'), vs.materials.glow('#ffe14d', 0, { additive: true }));
      slick.renderOrder = 1;
      slick.visible = false;
      vs.ctx.root.add(slick);
      this.slicks.push(slick);
      const halo = new Mesh(vs.ctx.lib.get('aura:disc'), vs.materials.glow('#ffd23f', 0, { additive: true }));
      halo.renderOrder = 2;
      halo.visible = false;
      vs.ctx.root.add(halo);
      this.halos.push(halo);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    let alive = false;
    const fade = Math.max(0, Math.min(1, (this.dur - this.t) / 0.5));
    this.peels.forEach((p, i) => {
      const m = this.meshes[i], slick = this.slicks[i], halo = this.halos[i];
      if (!m || !slick || !halo) return;
      const age = this.t - p.at;
      const show = age >= 0;
      m.visible = show;
      if (!show) return;
      alive = true;
      const u = Math.min(1, age / this.o.flight);
      const air = u < 1;
      const s = p.fromS + (p.s - p.fromS) * u;
      const x = p.fromX + (p.x - p.fromX) * u;
      const y = air ? (1 - u) * this.o.launch + this.o.apex * Math.sin(Math.PI * u) : 0.04;
      this.vs.ctx.world(s, x, y, m.position);
      frameQuat(this.vs.ctx, s, m.quaternion);
      if (air) m.rotateX(u * 9);   // it tumbles end over end while it flies
      m.scale.setScalar((air ? this.o.air : this.o.ground * (1 + 0.05 * Math.sin(this.t * 6 + i))) * fade);
      // the glow the toss leaves in the air: a bright halo around a peel in flight, so the arc reads from behind
      halo.visible = air;
      if (air) {
        halo.position.copy(m.position);
        halo.quaternion.copy(this.vs.ctx.session.app.camera.quaternion);
        halo.scale.setScalar(this.o.halo * (0.8 + 0.35 * Math.sin(Math.PI * u)));
        (halo.material as MeshBasicMaterial).opacity = 0.3;
      }
      slick.visible = !air;
      if (air) return;
      this.vs.ctx.world(p.s, p.x, 0.06, slick.position);
      frameQuat(this.vs.ctx, p.s, slick.quaternion).multiply(FLAT);
      const R = this.o.slick * (0.9 + 0.1 * Math.sin(this.t * 5 + i * 2));
      slick.scale.set(R, R, 1);
      (slick.material as MeshBasicMaterial).opacity = 0.45 * fade;
    });
    return alive && this.t < this.dur;
  }

  dispose(): void {
    for (const m of this.meshes) m.removeFromParent();
    for (const g of [...this.slicks, ...this.halos]) {
      g.removeFromParent();
      this.vs.materials.release(g.material as MeshBasicMaterial);
    }
    this.meshes.length = 0;
    this.slicks.length = 0;
    this.halos.length = 0;
  }
}

/** The crying cat's rain cloud: a little cloud over the rider with drops falling out of it. */
export class RainCloud extends Follower {
  private cloud: Mesh;
  private drops: Mesh[] = [];
  private cloudSize: number;

  constructor(vs: VisualSystem, r: RiderState, dur: number, private radius: number, cloudSize = radius * 0.13) {
    super(vs, r, dur, 0.3);
    this.cloudSize = cloudSize;
    this.cloud = this.own(toonMesh(this.geo('meme:cloud'), 0.03));
    for (let i = 0; i < 8; i++) {
      const d = this.own(toonMesh(this.geo('meme:drop'), 0.01));
      d.visible = false;
      this.drops.push(d);
    }
  }

  protected place(): void {
    const e = this.env;
    this.cloud.position.copy(this.pos).add(OFF.set(0, 3.4, 0).applyQuaternion(this.quat));
    this.cloud.quaternion.copy(this.quat);
    this.cloud.scale.setScalar(this.cloudSize * (0.9 + 0.1 * e));
    this.drops.forEach((d, i) => {
      const k = (this.t * 1.6 + i / this.drops.length) % 1;
      const a = (i / this.drops.length) * Math.PI * 2;
      const rad = this.radius * 0.45 * Math.sqrt((i + 0.5) / this.drops.length);
      d.position.copy(this.pos).add(OFF.set(Math.cos(a) * rad, 3.1 - k * 3, Math.sin(a) * rad).applyQuaternion(this.quat));
      d.quaternion.copy(this.quat);
      d.scale.set(1, 0.6 + 0.4 * e, 1);
      d.visible = e > 0.05;
    });
  }
}

/** The hamster's violin: it hovers at the rider's side and sways with the tune. */export class ViolinPlayer extends Follower {
  private violin: Mesh;

  constructor(vs: VisualSystem, r: RiderState, dur: number) {
    super(vs, r, dur, 0.25);
    this.violin = this.own(toonMesh(this.geo('meme:violin'), 0.03));
  }

  protected place(): void {
    const e = this.env;
    const sway = Math.sin(this.t * 4.2) * 0.16;
    this.violin.position.copy(this.pos).add(OFF.set(0.42, 1.15, -0.2).applyQuaternion(this.quat));
    SPIN.setFromAxisAngle(AXIS_Y, sway);
    this.violin.quaternion.copy(this.quat).multiply(SPIN).multiply(SPIN);
    this.violin.rotateX(-0.5 + Math.sin(this.t * 4.2) * 0.12);
    this.violin.scale.setScalar(0.8 + 0.2 * e);
  }
}

/** Pedro's bin: it spins beside him while he rummages in it. */
export class BinRummage extends Follower {
  private bin: Mesh;

  constructor(vs: VisualSystem, r: RiderState, dur: number) {
    super(vs, r, dur, 0.2);
    this.bin = this.own(toonMesh(this.geo('meme:bin'), 0.03));
  }

  protected place(): void {
    const e = this.env;
    this.bin.position.copy(this.pos).add(OFF.set(0.72, 0.5, -0.25).applyQuaternion(this.quat));
    SPIN.setFromAxisAngle(AXIS_Y, this.t * 7);
    this.bin.quaternion.copy(this.quat).multiply(SPIN);
    this.bin.scale.setScalar(0.8 + 0.2 * e);
  }
}

/**
 * The sad tune on its way to one listener: notes ride the air from the hamster's violin to whoever it silenced,
 * so the silence reads as something that came from the hamster and not as a status that appeared out of nowhere.
 */
export class SadNotes implements Visual {
  private notes: Mesh[] = [];
  private from = new Vector3();
  private to = new Vector3();
  private t = 0;

  constructor(private vs: VisualSystem, private caster: RiderState, private listener: RiderState, private dur: number) {
    for (let i = 0; i < NOTES.count; i++) this.notes.push(this.own());
  }

  private own(): Mesh {
    const m = toonMesh(this.vs.ctx.lib.get('meme:note'), 0.02);
    m.visible = false;
    this.vs.ctx.root.add(m);
    return m;
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur || this.caster.mode === 'crashed' || this.listener.mode === 'crashed') return false;
    const env = Math.max(0, Math.min(1, this.t / 0.2, (this.dur - this.t) / 0.3));
    this.vs.local(this.caster, 0.42, 1.5, -0.2, this.from);
    this.vs.local(this.listener, 0, 1.7, 0, this.to);
    const eye = this.vs.ctx.session.app.camera.quaternion;
    this.notes.forEach((m, i) => {
      const u = (this.t * NOTES.speed + i / this.notes.length) % 1;
      m.position.copy(this.from).lerp(this.to, u);
      m.position.y += Math.sin(u * Math.PI) * NOTES.lift + Math.sin(this.t * 7 + i * 2) * 0.1;
      m.position.x += Math.sin(u * Math.PI * 3 + this.t * 4 + i) * NOTES.sway;
      m.quaternion.copy(eye);
      m.scale.setScalar(NOTES.size * env * (0.55 + 0.55 * Math.sin(Math.PI * u)));
      m.visible = env > 0.05;
    });
    return true;
  }

  dispose(): void {
    for (const m of this.notes) m.removeFromParent();
    this.notes.length = 0;
  }
}

/** How the notes fly: how many, how fast, how high the arc bows and how much they sway. */
export const NOTES = { count: 4, speed: 0.85, lift: 0.9, sway: 0.25, size: 1.2 } as const;

/** How the prize comes out of the bin: the rise, the moment it hangs over pedro's head, and how big it reads. */
export interface PrizePopOpts { rise: number; hang: number; height: number; size: number }

/** The prize pedro pulled out: it comes up out of the bin and hangs over his head, so a random prize is seen. */
export class PrizePop extends Follower {
  private item: Mesh;

  constructor(vs: VisualSystem, r: RiderState, key: PropKey, private o: PrizePopOpts) {
    super(vs, r, o.rise + o.hang, 0.15);
    this.item = this.own(toonMesh(this.geo(key), 0.03));
  }

  protected place(): void {
    const u = Math.min(1, this.t / this.o.rise);
    const ease = 1 - Math.pow(1 - u, 3);
    const side = (1 - ease) * 0.72;   // it starts where the bin is and ends over his head
    const y = 0.5 + (this.o.height - 0.5) * ease + (u < 1 ? 0 : Math.sin(this.t * 5) * 0.08);
    this.item.position.copy(this.pos).add(OFF.set(side, y, -0.2).applyQuaternion(this.quat));
    SPIN.setFromAxisAngle(AXIS_Y, this.t * (u < 1 ? 9 : 2.4));
    this.item.quaternion.copy(this.quat).multiply(SPIN);
    this.item.scale.setScalar(this.o.size * (0.5 + 0.5 * ease) * this.env);
  }
}
