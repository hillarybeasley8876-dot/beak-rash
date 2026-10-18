// What is under the wheels besides the surface: track features and non-solid obstacles.
// ramp → ride up the wedge, launch at the lip by its angle · jumpCrest → kick at the crest top
// boostPad → boost · oil → 'oiled' (grip ×0.25, 1.2 s, −6 % speed, fishtail) · puddle → 'wet' (grip ×0.6,
// −2 % speed, a short light fishtail) + splash event.
import { TUNING as T } from './tuning';
import { giveBoost } from './drift';
import { dropStatus, setStatus, trackEnd, type SimCtx, type SimRider } from './state';
import type { RiderState } from '../core/types';

interface Box { s0: number; s1: number; x0: number; x1: number }

const box: Box = { s0: 0, s1: 0, x0: 0, x1: 0 };

function inside(r: RiderState, b: Box): boolean {
  return r.s >= b.s0 && r.s <= b.s1 && r.x >= Math.min(b.x0, b.x1) && r.x <= Math.max(b.x0, b.x1);
}

function num(v: number | string | boolean | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Wedge rising along +s from 0 at s0 to `height` at s1. */
function ramp(sr: SimRider, b: Box, height: number): void {
  const r = sr.r;
  if (!inside(r, b) || height <= 0) return;
  const slope = height / Math.max(0.5, b.s1 - b.s0);
  const h = slope * (r.s - b.s0);
  if (r.airborne && r.y > h + 0.05) return; // flying over it
  sr.onRamp = true;
  sr.rampSlope = slope;
  r.airborne = false;
  r.airTime = 0;
  r.y = h;
  r.vy = r.speed * slope;
}

function crest(ctx: SimCtx, sr: SimRider, b: Box, peak: number): void {
  const r = sr.r;
  // A natural micro-launch just before the peak must not swallow the kick, so low riders still get it.
  if (r.y > 0.3 || r.speed < T.crestMinSpeed || !(sr.prevS < peak && r.s >= peak)) return;
  if (r.x < Math.min(b.x0, b.x1) - 2 || r.x > Math.max(b.x0, b.x1) + 2) return;
  const tr = ctx.session.track;
  const before = tr.frameAt(Math.max(0, peak - T.crestSpan), ctx.tmpFrame).slope;
  const after = tr.frameAt(Math.min(trackEnd(tr), peak + T.crestSpan), ctx.tmpFrame).slope;
  r.vy = Math.max(r.vy, r.speed * Math.max(T.crestMinKick, before - after) * T.crestKick);
  if (r.airborne) sr.airKind = 'launch'; // a hop or micro-launch at the peak becomes a full jump
}

/** Run before vertical(): may pin the rider to a ramp or set a crest kick (vy) that starts an air episode. */
export function groundEffects(ctx: SimCtx, sr: SimRider): void {
  const r = sr.r;
  sr.onRamp = false;
  sr.rampSlope = 0;
  let pad = false;
  let padPower = T.padPower;
  let padTime = T.padTime;
  let oil = false;
  let puddle = false;
  for (const f of ctx.session.track.features) {
    if (r.s < f.s0 - 1 || r.s > f.s1 + 1) continue;
    box.s0 = f.s0; box.s1 = f.s1; box.x0 = f.x0; box.x1 = f.x1;
    if (f.kind === 'ramp') ramp(sr, box, num(f.data?.height, T.rampHeight));
    else if (f.kind === 'jumpCrest') crest(ctx, sr, box, num(f.data?.peak, (f.s0 + f.s1) / 2));
    else if (r.airborne) continue;
    else if (f.kind === 'boostPad' && inside(r, box)) {
      pad = true;
      padPower = num(f.data?.power, T.padPower);
      padTime = num(f.data?.time, T.padTime);
    }
    else if (f.kind === 'oil') oil = oil || inside(r, box);
    else if (f.kind === 'puddle') puddle = puddle || inside(r, box);
  }
  for (const o of ctx.session.obstacles) {
    if (!o.active || o.solid) continue;
    box.s0 = o.s - o.halfLength; box.s1 = o.s + o.halfLength; box.x0 = o.x - o.halfWidth; box.x1 = o.x + o.halfWidth;
    if (o.kind === 'ramp') ramp(sr, box, o.height);
    else if (r.airborne) continue;
    else if (o.kind === 'oil') oil = oil || inside(r, box);
    else if (o.kind === 'puddle') puddle = puddle || inside(r, box);
  }
  if (pad && !sr.inPad) giveBoost(ctx, sr, 'pad', padPower, padTime);
  if (oil) {
    if (!sr.inOil) enterSlick(ctx, sr, 'oil', T.oilScrub);
    sr.oilTime = T.oilTime;
  }
  if (puddle) {
    if (!sr.inPuddle) enterSlick(ctx, sr, 'puddle', T.puddleScrub);
    sr.wetTime = T.wetTime;
  }
  sr.inPad = pad;
  sr.inOil = oil;
  sr.inPuddle = puddle;
}

/** Entering oil / a puddle: scrub some speed and start the fishtail from a fresh phase. */
function enterSlick(ctx: SimCtx, sr: SimRider, surface: 'oil' | 'puddle', scrub: number): void {
  const r = sr.r;
  ctx.bus.emit('rider:offroad', { riderId: r.id, surface });
  r.speed *= 1 - scrub;
  if (sr.oilTime <= 0 && sr.wetTime <= 0) sr.slidePhase = 0;
}

/** Count down sim-owned effect timers and mirror them into statuses (source null) for HUD/fx/actors. */
export function tickSimStatuses(sr: SimRider, dt: number): void {
  sr.oilTime = mirror(sr.r, 'oiled', sr.oilTime, 1 - T.oilGrip, dt);
  sr.wetTime = mirror(sr.r, 'wet', sr.wetTime, 1 - T.puddleGrip, dt);
  sr.wobbleTime = mirror(sr.r, 'wobble', sr.wobbleTime, sr.wobbleStrength, dt);
}

function mirror(r: RiderState, id: 'oiled' | 'wet' | 'wobble', time: number, strength: number, dt: number): number {
  if (time <= 0) return 0;
  const left = Math.max(0, time - dt);
  if (left > 0) setStatus(r, id, left, strength);
  else dropStatus(r, id);
  return left;
}
