// Rider ↔ rider contacts in track space (|ds| < 1.7, |dx| < 0.75): mass-weighted push-apart, lateral
// velocity exchange, rear-end speed exchange, hard bumps (Δvx > 3) deal 2–5 damage + wobble.
// Contacts latch the pair (like walls): after the first bump, re-contacts while either rider still presses
// toward the other are silent (side ones inelastic shoves, no event or damage) until they separate by > 0.4 m
// (> 1 m whatever the steering) or stay apart 0.6 s; side bounces ease both headings instead of snapping them.
// Slipstream: ≤ 12 m behind someone within ±1.6 m → draft 0→1 over 0.6 s; pulling out at > 0.8 → slingshot
// (no draft or slingshot below 8 m/s, and braking resets the draft).
import { Vector3 } from 'three';
import { clamp01, lerp } from '../core/math';
import { TUNING as T } from './tuning';
import { endDrift, giveBoost } from './drift';
import { startCarry } from './steering';
import { isRiding, isSolid, trackEnd, type SimCtx, type SimRider } from './state';

const pairKey = (a: SimRider, b: SimRider): number => Math.min(a.r.id, b.r.id) * 1024 + Math.max(a.r.id, b.r.id);

export class Contacts {
  private cooldown = new Map<number, number>();
  /** Latched side-contact pairs → seconds since they last touched and their mean s then. */
  private latch = new Map<number, { free: number; s: number }>();
  private mid = new Vector3();

  constructor(private ctx: SimCtx) {}

  step(dt: number): void {
    for (const [k, t] of this.cooldown) {
      if (t <= dt) this.cooldown.delete(k);
      else this.cooldown.set(k, t - dt);
    }
    for (const [k, l] of this.latch) {
      l.free += dt;
      if (l.free > T.pairLatchTime) this.latch.delete(k);
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
        if (Math.abs(ds) >= T.contactDs || Math.abs(dx) >= T.contactDx || Math.abs(a.r.y - b.r.y) > 1) {
          this.unlatchIfApart(a, b, ds, dx);
          continue;
        }
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
    const key = pairKey(a, b);
    const side = penS / T.contactDs >= penX / T.contactDx;
    const latched = this.latch.has(key);
    const strength = side ? this.sideBySide(a, b, dx, penX, inv, latched) : this.rearEnd(a, b, ds, dx, penS, inv);
    this.touch(key, (ra.s + rb.s) / 2);
    if (strength <= T.bumpMin) return;
    if (strength > T.bumpEndDrift) {
      endDrift(this.ctx, a, false);
      endDrift(this.ctx, b, false);
    }
    if (latched || this.cooldown.has(key)) return; // one event (and its damage) per approach
    this.cooldown.set(key, 0.25);
    if (strength > T.bumpHard) {
      const k = clamp01((strength - T.bumpHard) / 5);
      const dmg = lerp(T.bumpDmgMin, T.bumpDmgMax, k);
      this.hurt(a, dmg * Math.min(1.25, mb / ma), rb.id, k);
      this.hurt(b, dmg * Math.min(1.25, ma / mb), ra.id, k);
    }
    const tr = this.ctx.session.track;
    tr.toWorld(Math.min((ra.s + rb.s) / 2, trackEnd(tr)), (ra.x + rb.x) / 2, 0.9, this.mid);
    this.ctx.bus.emit('rider:bump', { a: ra.id, b: rb.id, strength, pos: { x: this.mid.x, y: this.mid.y, z: this.mid.z } });
  }

  /** Shoulder to shoulder: inelastic shove for gentle pressure or a latched pair, bouncy swap for real impacts. */
  private sideBySide(a: SimRider, b: SimRider, dx: number, pen: number, inv: number, latched: boolean): number {
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
    const e = -rel > T.bumpBounceMin && !latched ? T.contactRestitution : 0;
    const j = (-(1 + e) * rel) / (1 / ma + 1 / mb);
    ra.vx -= (n * j) / ma;
    rb.vx += (n * j) / mb;
    if (-rel > T.bumpEaseMin) a.yawEase = b.yawEase = T.yawEaseTime; // noses turn smoothly with the shove, never snap
    if (e > 0) {
      // A real side impact: both riders carry the bounce instead of gluing back together within 0.15 s
      // (steering back toward the other rider is muted for a moment, steering away is not).
      const toB = n > 0 ? 1 : -1;
      startCarry(a, T.knockTime, T.bumpSteer, T.knockTau, toB);
      startCarry(b, T.knockTime, T.bumpSteer, T.knockTau, toB > 0 ? -1 : 1);
    }
    return -rel;
  }

  private touch(key: number, s: number): void {
    const l = this.latch.get(key);
    if (l) {
      l.free = 0;
      l.s = s;
    } else {
      this.latch.set(key, { free: 0, s });
    }
  }

  /**
   * Drop a pair's latch once they are clearly apart: > 1 m beyond contact, > 0.4 m with neither pressing in,
   * or moved farther than they could ride since they touched (a respawn or a teleport is a new approach).
   */
  private unlatchIfApart(a: SimRider, b: SimRider, ds: number, dx: number): void {
    const key = pairKey(a, b);
    const l = this.latch.get(key);
    if (!l) return;
    const gap = Math.abs(dx) - T.contactDx;
    const pressing = (a.vxWant - b.vxWant) * Math.sign(dx) > 0;
    const passed = Math.abs(ds) > T.contactDs + T.pairLatchFar;
    const jumped = Math.abs((a.r.s + b.r.s) / 2 - l.s) > 2 + 60 * l.free;
    if (passed || jumped || gap > T.pairLatchFar || (gap > T.pairLatchGap && !pressing)) this.latch.delete(key);
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

/** Slipstream amount and the slingshot when pulling out of a strong draft (none while braking or slow). */
export function slipstream(ctx: SimCtx, sr: SimRider, dt: number): void {
  const r = sr.r;
  const braking = (ctx.session.controls.get(r.id)?.brake ?? 0) > T.draftBrakeMax;
  const able = isRiding(r) && !r.airborne && !braking && r.speed > T.draftMinSpeed;
  let leader = -1;
  if (able) {
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
  if (able && leader < 0 && sr.draftLeader >= 0 && r.draft > T.slingshotMin && r.mode === 'racing') {
    const prev = ctx.session.rider(sr.draftLeader);
    const ds = prev ? prev.s - r.s : 99;
    if (prev && ds > -1.5 && ds < T.draftRange + 2) giveBoost(ctx, sr, 'draft', T.slingshotPower, T.slingshotTime);
  }
  sr.draftLeader = leader;
  if (braking) r.draft = 0;
  else r.draft = leader >= 0 ? Math.min(1, r.draft + T.draftRise * dt) : Math.max(0, r.draft - T.draftFall * dt);
}
