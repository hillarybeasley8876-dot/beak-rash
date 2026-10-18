// Projectiles in track space (salted-fish torpedo; generic so new skills can add more): homing, trail,
// first-contact hits against targetable riders, wall / timeout poofs. Swallowable by Big Gulp.
import { Mesh, Quaternion, Vector3, type BufferGeometry, type ColorRepresentation } from 'three';
import type { RiderState } from '../../../core/types';
import { finished, roadEdge, targetable, type CombatCtx } from '../ctx';
import { toonMesh } from '../meshes/build';
import { frameQuat } from '../visuals/frame';
import { Trail } from '../visuals/trail';

export interface ProjectileSpec {
  skillId: string;
  owner: RiderState;
  target: RiderState | null;
  s: number; x: number; y: number;
  speed: number;              // m/s, constant
  turn: number;               // homing responsiveness (1/s)
  life: number;               // s
  radius: number;             // m
  geometry: BufferGeometry;
  trail: ColorRepresentation;
  onHit(victim: RiderState, p: Projectile): void;
}

export interface Projectile extends ProjectileSpec {
  readonly id: number;
  vs: number; vx: number; vy: number;
  age: number;
  alive: boolean;
  mesh: Mesh;
  tail: Trail;
}

const AXIS_X = new Vector3(1, 0, 0), AXIS_Y = new Vector3(0, 1, 0), AXIS_Z = new Vector3(0, 0, 1);

export class ProjectileSystem {
  readonly list: Projectile[] = [];
  private nextId = 1; // per session: same seed, same event ids after an in-page restart
  private q = new Quaternion();
  private back = new Vector3();

  constructor(private ctx: CombatCtx) {}

  spawn(spec: ProjectileSpec): Projectile {
    const mesh = toonMesh(spec.geometry, 0.035);
    mesh.name = `projectile:${spec.skillId}`;
    this.ctx.root.add(mesh);
    const p: Projectile = {
      ...spec, id: this.nextId++, vs: spec.speed, vx: 0, vy: 0, age: 0, alive: true, mesh,
      tail: this.ctx.visuals.add(new Trail(this.ctx.visuals, (out) => this.tailPos(p, out), { color: spec.trail, width: 0.42, life: 0.3, max: 20, alpha: 0.9 })),
    };
    this.place(p);
    this.list.push(p);
    this.ctx.bus.emit('projectile:spawn', {
      id: p.id, owner: p.owner.id, target: p.target?.id ?? null, kind: p.skillId, pos: this.at(p),
    });
    return p;
  }

  /** Plain-object world position of a projectile (event payloads). */
  private at(p: Projectile): { x: number; y: number; z: number } {
    const w = this.ctx.world(p.s, p.x, p.y);
    return { x: w.x, y: w.y, z: w.z };
  }

  /** Every projectile ends exactly once: hit, poof, swallowed or disposed (projectile:end). */
  private end(p: Projectile, hit: RiderState | null): void {
    if (!p.alive) return;
    p.alive = false;
    this.ctx.bus.emit('projectile:end', { id: p.id, hit: hit?.id ?? null, pos: this.at(p) });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p) continue;
      if (p.alive) this.step(p, dt);
      if (!p.alive) this.remove(i);
    }
  }

  private step(p: Projectile, dt: number): void {
    p.age += dt;
    if (finished(p.owner)) {
      this.poof(p); // its owner crossed the line: nothing scores past it
      return;
    }
    this.home(p, dt);
    p.s += p.vs * dt;
    p.x += p.vx * dt;
    p.y = Math.max(0.35, p.y + p.vy * dt);
    if (this.blocked(p)) {
      this.end(p, null);
      const at = this.ctx.world(p.s, p.x, p.y);
      this.ctx.session.app.fx.burst('scales', at, { count: 10 });
      this.ctx.session.app.fx.burst('poof', at, { scale: 0.6 });
      return;
    }
    const victim = this.contact(p);
    if (victim) {
      this.end(p, victim);
      p.onHit(victim, p);
      return;
    }
    if (this.spent(p)) {
      this.poof(p);
      return;
    }
    this.place(p);
  }

  /** Steer toward a live target (constant speed), else level out at about 1 m. */
  private home(p: Projectile, dt: number): void {
    const t = p.target && targetable(this.ctx, p.target) ? p.target : null;
    if (t) {
      const ds = t.s + t.speed * 0.12 - p.s, dx = t.x - p.x, dy = t.y + 1.0 - p.y;
      const len = Math.hypot(ds, dx, dy) || 1;
      const k = 1 - Math.exp(-p.turn * dt);
      p.vs += ((ds / len) * p.speed - p.vs) * k;
      p.vx += ((dx / len) * p.speed - p.vx) * k;
      p.vy += ((dy / len) * p.speed - p.vy) * k;
      const n = Math.hypot(p.vs, p.vx, p.vy) || 1;
      p.vs *= p.speed / n; p.vx *= p.speed / n; p.vy *= p.speed / n;
    } else {
      p.vy += (1.0 - p.y) * 3 * dt - p.vy * 2 * dt;
    }
  }

  /** Timed out, off the road or past the line. */
  private spent(p: Projectile): boolean {
    return p.age >= p.life || Math.abs(p.x) > roadEdge(this.ctx, p.s, p.x) || p.s > this.ctx.session.track.length;
  }

  /** Inside a solid obstacle (car, truck, bus, barrier): projectiles never pass through traffic. */
  private blocked(p: Projectile): boolean {
    return this.ctx.session.obstacles.some((o) => o.active && o.solid && p.y < o.height + p.radius &&
      Math.abs(o.s - p.s) < o.halfLength + p.radius && Math.abs(o.x - p.x) < o.halfWidth + p.radius);
  }

  /** End without a hit in a puff of smoke. */
  private poof(p: Projectile): void {
    this.end(p, null);
    this.ctx.session.app.fx.burst('smoke', this.ctx.world(p.s, p.x, p.y), { count: 6 });
  }

  private contact(p: Projectile): RiderState | null {
    for (const r of this.ctx.session.riders) {
      if (r === p.owner || !targetable(this.ctx, r)) continue;
      if (Math.abs(r.s - p.s) < p.radius + 0.7 && Math.abs(r.x - p.x) < p.radius + 0.45 && Math.abs(r.y + 1.0 - p.y) < 1.2) return r;
    }
    return null;
  }

  private place(p: Projectile): void {
    const m = p.mesh;
    this.ctx.world(p.s, p.x, p.y, m.position);
    frameQuat(this.ctx, p.s, m.quaternion);
    const yaw = Math.atan2(p.vx, p.vs);
    const pitch = Math.atan2(p.vy, Math.hypot(p.vs, p.vx));
    m.quaternion.multiply(this.q.setFromAxisAngle(AXIS_Y, -yaw));
    m.quaternion.multiply(this.q.setFromAxisAngle(AXIS_X, pitch));
    m.quaternion.multiply(this.q.setFromAxisAngle(AXIS_Z, Math.sin(p.age * 26) * 0.45));
  }

  private tailPos(p: Projectile, out: Vector3): boolean {
    if (!p.alive) return false;
    out.copy(p.mesh.position).add(this.back.set(0, 0, 0.55).applyQuaternion(p.mesh.quaternion));
    return true;
  }

  /** Big Gulp: eat other riders' projectiles near `r`. Returns how many were swallowed. */
  swallow(r: RiderState, radius: number): number {
    let n = 0;
    for (const p of this.list) {
      if (!p.alive || p.owner === r || Math.hypot(p.s - r.s, p.x - r.x) > radius) continue;
      this.end(p, null);
      n++;
    }
    return n;
  }

  private remove(i: number): void {
    const p = this.list[i];
    if (!p) return;
    p.tail.stop();
    p.mesh.removeFromParent();
    this.list.splice(i, 1);
  }

  dispose(): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p) this.end(p, null);
      this.remove(i);
    }
  }
}
