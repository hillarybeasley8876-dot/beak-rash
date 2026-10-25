// Thrown weapons (SPEC §15): a weapon leaves the hand, flies with a soft homing arc, hits a rider or an
// obstacle, and drops back onto the road where it ends (one use fewer; at 0 it breaks instead).
import { Quaternion, Vector3, type BufferGeometry, type Mesh } from 'three';
import { WEAPONS, type WeaponTrait } from '../../../data/weapons';
import type { Obstacle, RiderState } from '../../../core/types';
import { clamp, wrapAngle } from '../../../core/math';
import { equip } from '../armory';
import { targetable, type CombatCtx } from '../ctx';
import { applyHit } from '../damage';
import { toonMesh } from '../meshes/build';
import { weaponGeometry } from '../meshes/weapon-props';
import { critChance } from '../traits';
import { MELEE, THROW, TRAIT } from '../tuning';
import type { ThrowableId } from '../throw';
import { frameQuat } from '../visuals/frame';

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const DEG = Math.PI / 180;

export interface ThrownWeapon {
  readonly id: number;
  readonly owner: RiderState;
  readonly weapon: ThrowableId;
  readonly dir: 1 | -1;          // +1 = thrown forward, -1 = thrown backward (lookBack)
  readonly uses: number;        // hits the weapon had left when it left the hand
  readonly trait: WeaponTrait | null; // the r4 trait of the weapon (SPEC §15)
  readonly speed0: number;      // its launch speed (m/s): the traits steer on it, they never change it
  target: RiderState | null;    // the rider the weapon homes on (locked at the release)
  s: number; x: number; y: number;
  vs: number; vx: number; vy: number;
  age: number;
  alive: boolean;
  mesh: Mesh;
  geometry: BufferGeometry;
}

export class ThrownWeaponSystem {
  readonly list: ThrownWeapon[] = [];
  private nextId = 9000; // its own id range (skill projectiles count from 1)
  private q = new Quaternion();

  constructor(private ctx: CombatCtx) {}

  /** The weapon leaves the hand: combat:throw + projectile:spawn. */
  throwWeapon(owner: RiderState, weapon: ThrowableId, dir: 1 | -1, uses: number): ThrownWeapon {
    const ctx = this.ctx;
    const geometry = weaponGeometry(weapon);
    const mesh = toonMesh(geometry, 0.035);
    mesh.name = `thrown:${weapon}`;
    ctx.root.add(mesh);
    const speed = dir === 1 ? owner.speed + THROW.forwardSpeed : owner.speed - THROW.backSpeed;
    const p: ThrownWeapon = {
      id: this.nextId++, owner, weapon, dir, uses, trait: WEAPONS[weapon].trait ?? null, target: null,
      speed0: Math.abs(speed),
      s: owner.s, x: owner.x, y: THROW.handHeight,
      vs: speed, vx: 0, vy: THROW.launchVy,
      age: 0, alive: true, mesh, geometry,
    };
    p.target = this.pickTarget(p);
    this.list.push(p);
    const pos = this.at(p);
    ctx.bus.emit('projectile:spawn', { id: p.id, owner: owner.id, target: null, kind: `weapon:${weapon}`, pos });
    ctx.bus.emit('combat:throw', { riderId: owner.id, weapon, dir, pos, projectileId: p.id });
    return p;
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p) continue;
      if (p.alive) this.step(p, dt);
      if (!p.alive) this.remove(i);
    }
  }

  private step(p: ThrownWeapon, dt: number): void {
    p.age += dt;
    if (p.trait === 'boomerang') this.steerBoomerang(p, dt);
    else if (p.trait === 'seeker') this.steerSeeker(p, dt);
    else this.steer(p, dt);
    p.s += p.vs * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.trait === 'boomerang' && this.inReach(p)) {
      this.catch(p);
      return;
    }
    const victim = this.contact(p);
    if (victim) {
      this.hit(p, victim);
      return;
    }
    const ob = this.obstacle(p);
    if (ob) {
      this.hitObstacle(p, ob);
      return;
    }
    if (p.y <= 0 || p.age >= this.life(p)) {
      this.end(p, null); // the weapon lands on the road
      return;
    }
    this.place(p);
  }

  /** How long the weapon stays in the air: the boomerang needs longer to fall after its catch window. */
  private life(p: ThrownWeapon): number {
    return p.trait === 'boomerang' ? TRAIT.boomerang.window + 1.2 : THROW.life;
  }

  /**
   * 回旋镖: the saltfish flies out, then curves back to its thrower, who may be braking or turning.
   * It is caught when it comes within TRAIT.boomerang.catch m of them before the window is over.
   */
  private steerBoomerang(p: ThrownWeapon, dt: number): void {
    if (p.age < TRAIT.boomerang.out || p.age > TRAIT.boomerang.window) {
      p.vy -= THROW.gravity * dt; // out of the window: it gives up and drops onto the road
      return;
    }
    const o = p.owner;
    const speed = p.speed0 * TRAIT.boomerang.speedMul;
    const ds = o.s + o.speed * TRAIT.boomerang.lead - p.s, dx = o.x - p.x;
    const heading = Math.atan2(p.vx, p.vs) +
      clamp(wrapAngle(Math.atan2(dx, ds) - Math.atan2(p.vx, p.vs)), -TRAIT.boomerang.turn * dt, TRAIT.boomerang.turn * dt);
    p.vs = Math.cos(heading) * speed;
    p.vx = Math.sin(heading) * speed;
    const dy = o.y + 1.2 - p.y;
    p.vy += (dy * THROW.heightGain - p.vy) * (1 - Math.exp(-THROW.turnRate * dt));
  }

  /** 必中: the slipper steers hard at the rider it picked (6 rad/s, a wide cone). */
  private steerSeeker(p: ThrownWeapon, dt: number): void {
    const t = p.target;
    if (!t) {
      p.vy -= THROW.gravity * dt;
      return;
    }
    const speed = p.speed0 + TRAIT.seeker.boost; // 必中: it flies faster than a plain throw
    const ds = t.s + t.speed * 0.12 - p.s, dx = t.x - p.x;
    const heading = Math.atan2(p.vx, p.vs) +
      clamp(wrapAngle(Math.atan2(dx, ds) - Math.atan2(p.vx, p.vs)), -TRAIT.seeker.turn * dt, TRAIT.seeker.turn * dt);
    p.vs = Math.cos(heading) * speed;
    p.vx = Math.sin(heading) * speed;
    const dy = t.y + 1 - p.y;
    p.vy += (dy * TRAIT.seeker.height - p.vy) * (1 - Math.exp(-TRAIT.seeker.turn * dt));
  }

  /** The boomerang is back within reach of its thrower. */
  private inReach(p: ThrownWeapon): boolean {
    if (p.age < TRAIT.boomerang.out || p.age > TRAIT.boomerang.window) return false;
    const o = p.owner;
    return Math.hypot(o.s - p.s, o.x - p.x) <= TRAIT.boomerang.catch;
  }

  /** 回旋镖: the saltfish comes back to the hand (one use fewer) or drops on the road. */
  private catch(p: ThrownWeapon): void {
    const ctx = this.ctx;
    p.alive = false;
    const pos = this.at(p);
    ctx.bus.emit('projectile:end', { id: p.id, hit: null, pos });
    const uses = p.uses - 1;
    if (uses <= 0) {
      ctx.bus.emit('combat:weaponBreak', { riderId: p.owner.id, weapon: p.weapon, pos });
      ctx.session.app.fx.burst('debris', pos, { count: 14 });
      ctx.session.app.fx.burst('poof', pos, { scale: 0.5 });
      return;
    }
    if (p.owner.weapon === 'none') {
      equip(ctx, p.owner, p.weapon, uses);
      ctx.bus.emit('combat:weaponPick', { riderId: p.owner.id, weapon: p.weapon, stolenFrom: null });
    } else {
      const it = ctx.pickups.spawn('weapon', p.s, p.x, p.weapon, THROW.dropGrace);
      it.uses = uses;
      ctx.bus.emit('combat:weaponDrop', { riderId: p.owner.id, weapon: p.weapon, pos });
    }
    ctx.session.app.fx.burst('poof', pos, { scale: 0.4 });
  }

  /** Soft homing: steer toward the target, and hold the flight height while it does. */
  private steer(p: ThrownWeapon, dt: number): void {
    if (p.target && !targetable(this.ctx, p.target)) p.target = null;
    const target = p.target;
    if (!target) {
      p.vy -= THROW.gravity * dt; // nothing to home on: the weapon arcs down onto the road
      return;
    }
    const speed = Math.max(1, Math.abs(p.vs));
    const want = clamp((target.x - p.x) * THROW.lateralGain, -THROW.lateralMax, THROW.lateralMax);
    const maxDv = speed * THROW.turnRate * dt; // the heading may only turn THROW.turnRate rad/s
    p.vx += clamp(want - p.vx, -maxDv, maxDv);
    const dy = target.y + 1 - p.y;
    p.vy += (dy * THROW.heightGain - p.vy) * (1 - Math.exp(-THROW.turnRate * dt));
  }

  /**
   * The rider the weapon homes on: the one in the throw direction whose line is closest to the weapon's own
   * (the rider you are throwing at), the nearest one when two share that line. The lock is taken at the
   * release, so the weapon does not swerve from one rival to another mid-flight.
   * 必中: the slipper takes the NEAREST rider anywhere in its wide cone (off-axis riders a plain throw would
   * miss included) and flies past the ones in the way.
   */
  private pickTarget(p: ThrownWeapon): RiderState | null {
    const ctx = this.ctx;
    const seeker = p.trait === 'seeker'; // 必中: a wide cone, a long reach
    const range = seeker ? TRAIT.seeker.range : p.dir === 1 ? THROW.range : THROW.backRange;
    const cone = (seeker ? TRAIT.seeker.cone : THROW.cone) * DEG;
    let best: RiderState | null = null;
    let bestDx = Infinity;
    let bestD = Infinity;
    for (const r of ctx.session.riders) {
      if (r === p.owner || !targetable(ctx, r)) continue;
      const ds = (r.s - p.s) * p.dir; // > 0 = in the throw direction
      if (ds <= 0) continue;
      const dx = Math.abs(r.x - p.x);
      const d = Math.hypot(ds, r.x - p.x);
      if (d > range) continue;
      if (Math.atan2(dx, ds) > cone) continue;
      const better = seeker ? d < bestD : dx < bestDx || (Math.abs(dx - bestDx) <= 1e-6 && d < bestD);
      if (better) {
        bestDx = dx;
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  /** The rider the weapon hits: the one it locked onto, or anyone it touches when it homes on nobody. */
  private contact(p: ThrownWeapon): RiderState | null {
    const ctx = this.ctx;
    if (p.target) {
      // A homing weapon goes for the rider it locked onto; it does not hit a bystander on the way.
      return this.touches(p, p.target) ? p.target : null;
    }
    for (const r of ctx.session.riders) {
      if (r === p.owner || !targetable(ctx, r)) continue;
      if (this.touches(p, r)) return r;
    }
    return null;
  }

  /** Is the rider within reach of the weapon? */
  private touches(p: ThrownWeapon, r: RiderState): boolean {
    if (!targetable(this.ctx, r)) return false;
    if (Math.hypot(r.s - p.s, r.x - p.x) > THROW.hitRadius) return false;
    return Math.abs(r.y + 1 - p.y) <= THROW.hitHeight;
  }

  /** A hittable obstacle the weapon flies into (traffic, a corgi, event props, secret props). */
  private obstacle(p: ThrownWeapon): Obstacle | null {
    for (const o of this.ctx.session.obstacles) {
      if (!o.active) continue;
      if (o.kind === 'oil' || o.kind === 'puddle' || o.kind === 'ramp') continue;
      if (Math.abs(o.x - p.x) > o.halfWidth + 0.4) continue;
      if (Math.abs(o.s - p.s) > o.halfLength + 0.4) continue;
      if (p.y > o.height + 0.3) continue;
      return o;
    }
    return null;
  }

  private hit(p: ThrownWeapon, victim: RiderState): void {
    const ctx = this.ctx;
    const w = WEAPONS[p.weapon];
    const crit = ctx.force.crit ?? ctx.rng.chance(critChance(p.weapon));
    const outcome = applyHit(ctx, {
      attacker: p.owner, victim,
      damage: w.heavyDamage * THROW.damageMul,
      side: 1, weapon: p.weapon, heavy: true, crit, skillId: null,
      knock: w.knock * MELEE.heavyKnockMul,
      speedLoss: ctx.rng.range(MELEE.speedLoss[0], MELEE.speedLoss[1]),
      melee: true, impact: 'heavy', sp: THROW.sp,
    });
    this.end(p, outcome === 'landed' ? victim : null);
  }

  private hitObstacle(p: ThrownWeapon, o: Obstacle): void {
    const ctx = this.ctx;
    const w = WEAPONS[p.weapon];
    const pos = this.at(p);
    ctx.bus.emit('combat:obstacleHit', {
      obstacleId: o.id, attacker: p.owner.id, weapon: p.weapon,
      damage: Math.max(1, Math.round(w.heavyDamage * THROW.damageMul)), thrown: true, pos,
    });
    ctx.session.app.fx.burst('debris', pos, { count: 8 });
    this.end(p, null);
  }

  private end(p: ThrownWeapon, hit: RiderState | null, drop = true): void {
    if (!p.alive) return;
    p.alive = false;
    const ctx = this.ctx;
    ctx.bus.emit('projectile:end', { id: p.id, hit: hit?.id ?? null, pos: this.at(p) });
    if (drop) this.drop(p);
  }

  /** Where the weapon ends it drops onto the road; a moment later anyone may grab it again. */
  private drop(p: ThrownWeapon): void {
    const ctx = this.ctx;
    const uses = p.uses - 1;
    if (uses <= 0) {
      const pos = this.at(p);
      ctx.bus.emit('combat:weaponBreak', { riderId: p.owner.id, weapon: p.weapon, pos });
      ctx.session.app.fx.burst('debris', pos, { count: 14 });
      ctx.session.app.fx.burst('poof', pos, { scale: 0.5 });
      return;
    }
    const it = ctx.pickups.spawn('weapon', p.s, p.x, p.weapon, THROW.dropGrace);
    it.uses = uses;
  }

  /** Plain-object world position of the weapon (event payloads). */
  private at(p: ThrownWeapon): { x: number; y: number; z: number } {
    const w = this.ctx.world(p.s, p.x, Math.max(0, p.y));
    return { x: w.x, y: w.y, z: w.z };
  }

  /** The prop mesh tumbles end over end, nose along the throw direction. */
  private place(p: ThrownWeapon): void {
    const m = p.mesh;
    this.ctx.world(p.s, p.x, p.y, m.position);
    frameQuat(this.ctx, p.s, m.quaternion);
    if (p.dir === -1) m.quaternion.multiply(this.q.setFromAxisAngle(AXIS_Y, Math.PI));
    m.quaternion.multiply(this.q.setFromAxisAngle(AXIS_X, p.age * THROW.spin));
  }

  private remove(i: number): void {
    const p = this.list[i];
    if (!p) return;
    p.mesh.removeFromParent();
    p.geometry.dispose();
    this.list.splice(i, 1);
  }

  dispose(): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p) continue;
      this.end(p, null, false); // the session is going away: the weapon does not land on the road
      this.remove(i);
    }
  }
}
