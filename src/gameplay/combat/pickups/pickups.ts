// Pickups (SPEC §7): rows from track 'pickupRow' features + weapon drops. Collected by proximity in track
// space by any racing rider: 小鱼干 coins, fish +25 HP, weapon crate, 能量鱼罐头 +25 SP, dropped weapons
// (unarmed riders only). Row items pop back after a few seconds; drops fade after PICKUP.dropLife.
import { WEAPONS } from '../../../data/weapons';
import type { RiderState, WeaponId } from '../../../core/types';
import { equip, rollWeapon } from '../armory';
import { clampToRoad, type CombatCtx } from '../ctx';
import type { PropLibrary } from '../meshes/library';
import { gainSp } from '../sp';
import { PICKUP, SP } from '../tuning';
import { autoRows, layRow, makeItem, type Item, type PickupKind } from './items';
import { PickupRenderer } from './render';

const GRAVITY = 16;
/** m an item already in the Big Gulp stream may lag beyond the vacuum radius. */
const VACUUM_SLACK = 1;

export class PickupSystem {
  readonly items: Item[] = [];
  private renderer: PickupRenderer;
  private time = 0;
  private drawnFrame = -1;
  private lastId = 0;
  private readonly nextId = (): number => ++this.lastId;

  constructor(private ctx: CombatCtx, lib: PropLibrary) {
    const { track } = ctx.session;
    const rng = ctx.rng.fork(0x91c4);
    const rows = track.features.filter((f) => f.kind === 'pickupRow');
    const list = rows.length > 0 ? rows : autoRows(track.length, (s) => track.bounds(s).halfWidth, rng);
    for (const f of list) layRow(f, rng, this.items, this.nextId);
    for (const it of this.items) this.keepOnRoad(it);
    const counts = { coin: 0, fish: 0, crate: 0, can: 0 };
    for (const it of this.items) if (it.kind !== 'weapon') counts[it.kind]++;
    this.renderer = new PickupRenderer(ctx, lib, counts);
  }

  /** Track rows are external data: a row item never sits on the shoulder (≥ 1 m inside the asphalt). */
  private keepOnRoad(it: Item): void {
    it.x = clampToRoad(this.ctx, it.s, it.x, 1);
    if (it.home) it.home.x = it.x;
  }

  update(dt: number, collect: boolean): void {
    this.time += dt;
    const riders = this.ctx.session.riders;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it) continue;
      if (!it.alive) {
        if (this.time >= it.respawnAt && !riders.some((r) => Math.abs(r.s - it.s) < 12)) {
          it.alive = true;
          it.pop = 0;
        }
        continue;
      }
      it.pop = Math.min(1, it.pop + dt * 3.5);
      if (it.vel) this.fly(it, dt);
      if ((it.life -= dt) <= 0) {
        this.remove(i);
        continue;
      }
      if (collect && !it.vel) this.tryCollect(it, riders);
    }
    // Instance matrices are rewritten at most once per rendered frame (sim may run 2+ substeps per frame).
    const frame = this.ctx.session.app.renderer.info.render.frame;
    if (frame !== this.drawnFrame) {
      this.drawnFrame = frame;
      this.draw();
    }
  }

  private fly(it: Item, dt: number): void {
    const v = it.vel;
    if (!v) return;
    v.y -= GRAVITY * dt;
    v.s *= Math.exp(-1.6 * dt);
    it.s += v.s * dt;
    it.x = clampToRoad(this.ctx, it.s, it.x + v.x * dt, 1);
    it.y += v.y * dt;
    if (it.y <= PICKUP.float && v.y < 0) {
      it.y = PICKUP.float;
      it.vel = null;
    }
  }

  private tryCollect(it: Item, riders: RiderState[]): void {
    for (const r of riders) {
      if (r.mode !== 'racing' || this.ctx.has(r, 'gulped')) continue;
      if (Math.abs(r.s - it.s) > PICKUP.takeDs || Math.abs(r.x - it.x) > PICKUP.takeDx || r.y > PICKUP.takeMaxY) continue;
      if (this.take(r, it)) return;
    }
  }

  /**
   * Can `r` take `it`? Armed riders leave road weapons and crates alone (no forced downgrades); fish at full HP
   * and cans at full SP stay on the road for the riders behind (normal pickup and Big Gulp's vacuum alike).
   */
  accepts(r: RiderState, it: Item): boolean {
    if (!it.alive) return false;
    switch (it.kind) {
      case 'weapon':
      case 'crate': return r.weapon === 'none';
      case 'fish': return r.hp < r.maxHp;
      case 'can': return r.sp < SP.max;
      case 'coin': return true;
    }
  }

  /** Apply the item to `r`. Returns false if `r` can't take it. */
  take(r: RiderState, it: Item): boolean {
    if (!this.accepts(r, it)) return false;
    const { ctx } = this;
    const pos = ctx.world(it.s, it.x, it.y);
    const at = { x: pos.x, y: pos.y, z: pos.z };
    switch (it.kind) {
      case 'coin': r.coins += PICKUP.coinValue; break;
      case 'fish': r.hp = Math.min(r.maxHp, r.hp + PICKUP.fishHp); break;
      case 'can': gainSp(r, PICKUP.canSp); break;
      case 'crate': this.giveWeapon(r, rollWeapon(ctx), undefined); break;
      case 'weapon': this.giveWeapon(r, it.weapon, it.uses); break;
    }
    it.alive = false;
    it.vacuumBy = null;
    if (it.home) {
      it.s = it.home.s; // a vacuumed row item comes back at its row slot
      it.x = it.home.x;
    }
    if (it.life === Infinity) it.respawnAt = this.time + PICKUP.respawn;
    else this.remove(this.items.indexOf(it));
    ctx.bus.emit('pickup:take', { riderId: r.id, kind: it.kind, pos: at });
    return true;
  }

  private giveWeapon(r: RiderState, weapon: WeaponId, uses: number | undefined): void {
    equip(this.ctx, r, weapon, uses);
    this.ctx.bus.emit('combat:weaponPick', { riderId: r.id, weapon, stolenFrom: null });
  }

  /** A knocked-loose weapon flies off the rider and lands on the road ahead. */
  dropWeapon(weapon: WeaponId, uses: number, from: RiderState): void {
    if (weapon === 'none') return;
    const it = makeItem(this.nextId(), 'weapon', from.s, from.x, this.ctx.rng.next() * 6);
    it.weapon = weapon;
    it.uses = uses;
    it.y = from.y + 1.3;
    it.life = PICKUP.dropLife;
    it.pop = 0.6;
    const side = this.ctx.rng.chance(0.5) ? 1 : -1;
    it.vel = { s: from.speed * 0.75, x: side * this.ctx.rng.range(1.2, 2.6), y: 4.2 };
    this.items.push(it);
  }

  /**
   * Big Gulp: pull items `r` can take within `radius` toward it; they're collected on arrival. An item already
   * being pulled may trail up to VACUUM_SLACK beyond the radius (never further).
   */
  vacuum(r: RiderState, radius: number, dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it || it.vel || !this.accepts(r, it)) continue;
      const ds = it.s - r.s, dx = it.x - r.x;
      const d = Math.hypot(ds, dx);
      if (d > radius + VACUUM_SLACK || (d > radius && it.vacuumBy !== r.id)) continue;
      it.vacuumBy = r.id;
      const k = 1 - Math.exp(-9 * dt);
      it.s -= ds * k;
      it.x -= dx * k;
      it.s += r.speed * dt;
      if (d < 0.9) this.take(r, it);
    }
  }

  /** The pouch closed: drop `r`'s vacuum tags; uncollected row items pop back at their row slot. */
  releaseVacuum(r: RiderState): void {
    for (const it of this.items) {
      if (it.vacuumBy !== r.id) continue;
      it.vacuumBy = null;
      if (!it.home || !it.alive) continue;
      it.s = it.home.s;
      it.x = it.home.x;
      it.pop = 0;
    }
  }

  /** Debug/test: place an item (weapon kind needs `weapon`). */
  spawn(kind: PickupKind, s: number, x: number, weapon: WeaponId = 'saltfish'): Item {
    const it = makeItem(this.nextId(), kind, s, x, this.ctx.rng.next() * 6);
    if (kind === 'weapon') {
      it.weapon = weapon;
      it.uses = WEAPONS[weapon].uses;
      it.life = PICKUP.dropLife;
    }
    it.pop = 0;
    this.items.push(it);
    return it;
  }

  /** Remove every item (debug / tests). */
  clear(): void {
    for (let i = this.items.length - 1; i >= 0; i--) this.remove(i);
  }

  private remove(i: number): void {
    const it = this.items[i];
    if (!it) return;
    this.renderer.hideDrop(it.id, true);
    this.items.splice(i, 1);
  }

  private draw(): void {
    const p = this.ctx.session.player;
    this.renderer.begin();
    for (const it of this.items) {
      const near = Math.abs(it.s - p.s) < PICKUP.viewRange;
      if (it.alive && near) this.renderer.draw(it, this.time);
      else if (it.kind === 'weapon') this.renderer.hideDrop(it.id, false);
    }
    this.renderer.end();
  }

  dispose(): void {
    this.renderer.dispose();
    this.items.length = 0;
  }
}
