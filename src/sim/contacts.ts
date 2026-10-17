// Rider ↔ rider contacts in track space (|ds| < 1.7, |dx| < 0.75): mass-weighted push-apart, lateral
// velocity exchange, rear-end speed exchange, hard bumps (Δvx > 3) deal 2–5 damage + wobble.
// Slipstream: ≤ 12 m behind someone within ±1.6 m → draft 0→1 over 0.6 s; pulling out at > 0.8 → slingshot.
import { Vector3 } from 'three';
import { clamp01, lerp } from '../core/math';
import { TUNING as T } from './tuning';
import { endDrift, giveBoost } from './drift';
import { startCarry } from './steering';
import { isRiding, isSolid, type SimCtx, type SimRider } from './state';

export class Contacts {
  private cooldown = new Map<number, number>();
  private mid = new Vector3();

  constructor(private ctx: SimCtx) {}

  step(dt: number): void {
    for (const [k, t] of this.cooldown) {
      if (t <= dt) this.cooldown.delete(k);
      else this.cooldown.set(k, t - dt);
    }
    const list = this.ctx.riders;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a || !isSolid(a.r)) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b || !isSolid(b.r)) continue;
        const ds = b.r.s - a.r.s;
        const dx = b.r.x - a.r.x;
        if (Math.abs(ds) >= T.contactDs || Math.abs(dx) >= T.contactDx || Math.abs(a.r.y - b.r.y) > 1) continue;
        this.resolve(a, b, ds, dx);
      }
    }
  }

  private resolve(a: SimRider, b: SimRider, ds: number, dx: number): void {
    const ra = a.r;
    const rb = b.r;
    const ma = a.tune.mass;
    const mb = b.tune.mass;
    const inv = 1 / (ma + mb);
    const penS = T.contactDs - Math.abs(ds);
    const penX = T.contactDx - Math.abs(dx);
    // Resolve along the axis with the smaller (normalised) overlap; corrections are capped per substep
    // so contacts push and never teleport.
    const strength = penS / T.contactDs < penX / T.contactDx
      ? this.rearEnd(a, b, ds, dx, penS, inv)
      : this.sideBySide(a, b, dx, penX, inv);
    if (strength <= T.bumpMin) return;
    if (strength > T.bumpEndDrift) {
      endDrift(this.ctx, a, false);
      endDrift(this.ctx, b, false);
    }
    const key = Math.min(ra.id, rb.id) * 1024 + Math.max(ra.id, rb.id);
    if (this.cooldown.has(key)) return;
    this.cooldown.set(key, 0.25);
    if (strength > T.bumpHard) {
      const k = clamp01((strength - T.bumpHard) / 5);
      const dmg = lerp(T.bumpDmgMin, T.bumpDmgMax, k);
      this.hurt(a, dmg * Math.min(1.25, mb / ma), rb.id, k);
      this.hurt(b, dmg * Math.min(1.25, ma / mb), ra.id, k);
    }
    const tr = this.ctx.session.track;
    tr.toWorld(Math.min((ra.s + rb.s) / 2, tr.length), (ra.x + rb.x) / 2, 0.9, this.mid);
    this.ctx.bus.emit('rider:bump', { a: ra.id, b: rb.id, strength, pos: { x: this.mid.x, y: this.mid.y, z: this.mid.z } });
  }

  /** Shoulder to shoulder: inelastic shove for gentle pressure, bouncy swap for real impacts. */
  private sideBySide(a: SimRider, b: SimRider, dx: number, pen: number, inv: number): number {
    const ra = a.r;
    const rb = b.r;
    const ma = a.tune.mass;
    const mb = b.tune.mass;
    const n = Math.abs(dx) > 1e-3 ? Math.sign(dx) : ra.id < rb.id ? 1 : -1;
    const fix = Math.min(pen, T.contactMaxFix);
    ra.x -= n * fix * mb * inv;
    rb.x += n * fix * ma * inv;
    const rel = (rb.vx - ra.vx) * n; // < 0 = closing
    if (rel >= 0) return 0;
    const e = -rel > T.bumpBounceMin ? T.contactRestitution : 0;
    const j = (-(1 + e) * rel) / (1 / ma + 1 / mb);
    ra.vx -= (n * j) / ma;
    rb.vx += (n * j) / mb;
    if (e > 0) {
      // A real side impact: both riders carry the bounce instead of gluing back together within 0.15 s.
      startCarry(a, T.knockTime, T.knockSteer, T.knockTau);
      startCarry(b, T.knockTime, T.knockSteer, T.knockTau);
    }
    return -rel;
  }

  /** Nose to tail: the follower hands speed to the leader and is held back, with a small side nudge. */
  private rearEnd(a: SimRider, b: SimRider, ds: number, dx: number, pen: number, inv: number): number {
    const back = ds > 0 ? a : b;
    const front = ds > 0 ? b : a;
    const mBack = back.tune.mass;
    const mFront = front.tune.mass;
    const fix = Math.min(pen, T.contactMaxFix);
    back.r.s -= fix * mFront * inv;
    front.r.s += fix * mBack * inv;
    const closing = back.r.speed - front.r.speed;
    if (closing <= 0) return 0;
    const dv = closing * (1 + T.rearRestitution);
    back.r.speed = Math.max(0, back.r.speed - dv * mFront * inv);
    front.r.speed += dv * mBack * inv;
    const side = Math.abs(dx) > 1e-3 ? Math.sign(back.r.x - front.r.x) : back.r.id < front.r.id ? -1 : 1;
    back.r.vx += side * Math.min(1.5, closing * 0.3);
    return closing * 0.8;
  }

  private hurt(sr: SimRider, dmg: number, from: number, k: number): void {
    const r = sr.r;
    sr.wobbleTime = Math.max(sr.wobbleTime, T.wobbleTime);
    sr.wobbleStrength = Math.max(sr.wobbleTime > 0 ? sr.wobbleStrength : 0, 0.5 + 0.5 * k);
    if (r.invuln > 0 || r.mods.shield) return;
    r.hp = Math.max(0, r.hp - Math.max(1, Math.round(dmg)));
    r.lastHitBy = from;
    r.lastHitTime = this.ctx.session.time;
  }
}

/** Slipstream amount and the slingshot when pulling out of a strong draft. */
export function slipstream(ctx: SimCtx, sr: SimRider, dt: number): void {
  const r = sr.r;
  let leader = -1;
  if (isRiding(r) && !r.airborne) {
    let best = Infinity;
    for (const o of ctx.riders) {
      if (o === sr || !isRiding(o.r) || o.r.mods.invisible) continue;
      const ds = o.r.s - r.s;
      if (ds > T.draftMinGap && ds < T.draftRange && Math.abs(o.r.x - r.x) < T.draftHalfWidth && ds < best) {
        best = ds;
        leader = o.r.id;
      }
    }
  }
  if (leader < 0 && sr.draftLeader >= 0 && r.draft > T.slingshotMin && r.mode === 'racing') {
    const prev = ctx.session.rider(sr.draftLeader);
    const ds = prev ? prev.s - r.s : 99;
    if (prev && ds > -1.5 && ds < T.draftRange + 2) giveBoost(ctx, sr, 'draft', T.slingshotPower, T.slingshotTime);
  }
  sr.draftLeader = leader;
  r.draft = leader >= 0 ? Math.min(1, r.draft + T.draftRise * dt) : Math.max(0, r.draft - T.draftFall * dt);
}
