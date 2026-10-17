// One AI rider: perception → lane plan → steering/speed → drift/hop → fights/skills.
import { clamp, lerp, smoothstep } from '../../../core/math';
import type { Rng } from '../../../core/rng';
import type { Controls, RiderState } from '../../../core/types';
import { Driver, topOf } from './control';
import { Fighter, type HuntToken } from './fight';
import type { RacingLine } from './line';
import type { Personality } from './personality';
import { planLateral, type PlanOutput } from './plan';
import type { Senses } from './sense';
import { useSkill } from './skills';
import { cornerSpeed, GripModel, targetSpeed, updateDrift, type DriftPlan } from './speed';

export interface AiWorld {
  phase: 'intro' | 'countdown' | 'racing' | 'finished';
  countdownTime: number;
  /** Race seconds since GO. */
  time: number;
  riders: readonly RiderState[];
  player: RiderState;
  line: RacingLine;
  senses: Senses;
  bounds(s: number): { left: number; right: number; halfWidth: number };
}

const PLAN_EVERY = 0.05;
const SKILL_EVERY = 0.5;

export class Brain {
  readonly driver = new Driver();
  readonly fighter: Fighter;
  private grip: GripModel;
  private drift: DriftPlan = { active: false, dir: 0, goal: 0.6, cool: 0 };
  private plan: PlanOutput = { x: 0, followSpeed: null, followGap: Infinity, followKind: null, hopAt: null };
  private tx: number;
  private planT: number;
  private skillT: number;
  private hopCd = 0;
  private stuckT = 0;
  private wanderPhase: number;
  private launchAt: number;
  private firstSkillAt: number;   // race time of the first signature skill (staggered per rider)
  private time = 0;
  private driftRoll = 0;
  private driftRollAt = 0;
  private draft: RiderState | null = null;
  private draftT = 0;
  private stepDt = 0;
  /** Rubber band: top-speed cap (m/s before mods/boosts) set by the director; Infinity = none. */
  paceTop = Infinity;
  /** Ring the bell on the next racing tick (after passing the player). */
  ringBell = false;
  /** Debug/test: seconds of forced braking (e.g. let the police catch the autopilot). */
  holdBrake = 0;

  constructor(readonly r: RiderState, readonly c: Controls, readonly p: Personality, private rng: Rng, token: HuntToken) {
    this.fighter = new Fighter(r, p, rng, token);
    this.grip = new GripModel(p.risk * this.driver.authorityAtTop(r));
    this.tx = r.x;
    this.planT = rng.range(0, PLAN_EVERY);
    this.skillT = rng.range(0, SKILL_EVERY);
    this.wanderPhase = rng.range(0, 6.28);
    this.firstSkillAt = rng.range(5, 15);
    this.launchAt = rng.next() < p.launch ? rng.range(2.05, 2.8) : rng.next() < 0.7 ? rng.range(0.4, 1.9) : 3.5;
  }

  update(dt: number, w: AiWorld): void {
    const { r, c } = this;
    this.time += dt;
    this.stepDt = dt;
    c.drift = false;
    if (w.phase === 'intro' || w.phase === 'countdown') {
      c.steer = 0;
      c.brake = 0;
      c.throttle = w.phase === 'countdown' && w.countdownTime >= this.launchAt ? 1 : 0;
      return;
    }
    if (r.mode !== 'racing' && r.mode !== 'finished') {
      c.throttle = c.brake = 0;
      this.driver.reset();
      this.drift.active = false;
      this.tx = r.x;
      return;
    }
    this.fighter.tick(dt);
    this.hopCd -= dt;
    this.planT -= dt;
    if (this.planT <= 0) {
      this.planT += PLAN_EVERY;
      this.think(w);
    }
    const rate = this.p.lateralRate * (this.plan.followGap < 12 ? 2 : 1);
    this.tx += clamp(this.plan.x - this.tx, -rate * dt, rate * dt);
    const urgency = this.plan.followGap < 15 ? 1 : 0.4;
    if (r.drifting && this.drift.active) this.driver.steerDrift(r, this.tx, this.drift.dir, dt, c);
    else this.driver.steerTo(r, this.tx, urgency, dt, c);
    this.drive(w);
    this.grip.update(r, c.steer, r.x - w.line.x(r.s), w.line.curv(r.s), dt);
    this.unstick(dt, c);
    if (this.holdBrake > 0) {
      this.holdBrake -= dt;
      c.throttle = 0;
      c.brake = 1;
      c.drift = false;
    }
  }

  private desiredX(w: AiWorld, hw: number): number {
    const { r, p } = this;
    const lineX = w.line.x(r.s + Math.max(8, r.speed * 0.7));
    const bend = smoothstep(0.002, 0.009, Math.abs(w.line.peakCurv(r.s, r.s + 40)));
    const own = clamp(p.lineBias + p.wander * Math.sin(this.time * 0.23 + this.wanderPhase), -hw + 1.6, hw - 1.6);
    const x = lerp(own, lineX, clamp(p.lineFollow * (0.35 + 0.65 * bend), 0, 1));
    const goal = this.fighter.huntGoal();
    if (goal && Math.abs(goal.ds) < 25) return goal.x;
    this.updateDraft(w, bend);
    return this.draft ? this.draft.x : x;
  }

  /** Pick a wheel to sit on for a few seconds (slipstream); the planner pulls out when it closes in. */
  private updateDraft(w: AiWorld, bend: number): void {
    const d = this.draft;
    const gap = d ? d.s - this.r.s : 0;
    if (d && (d.mode !== 'racing' || gap < 1.2 || gap > 18 || bend > 0.6)) this.draft = null;
    this.draftT -= PLAN_EVERY;
    if (this.draftT > 0) return;
    this.draftT = this.rng.range(2, 4);
    if (this.draft || bend > 0.5 || this.rng.next() > this.p.drafter) return;
    for (const b of w.senses.blips) {
      if (b.kind === 'rider' && b.rider && b.ds > 3 && b.ds < 14 && Math.abs(b.vs - this.r.speed) < 2.5) {
        this.draft = b.rider;
        return;
      }
    }
  }

  private think(w: AiWorld): void {
    const { r, p } = this;
    w.senses.scan(r);
    const look = r.s + Math.min(20, r.speed * 0.6);
    const b0 = w.bounds(r.s), b1 = w.bounds(look);
    const hw = Math.min(b0.halfWidth, b1.halfWidth);
    const lo = -Math.min(b0.left, b1.left) + 0.9, hi = Math.min(b0.right, b1.right) - 0.9;
    this.fighter.chooseTarget(w.riders, w.player, w.time);
    const hunting = this.fighter.hunt;
    this.plan = planLateral({
      desiredX: clamp(this.desiredX(w, hw), lo, hi), prevX: this.plan.x, x: r.x, v: r.speed, lo, hi, asphalt: hw,
      horizon: (1 + 1.4 * p.skill) * (hunting ? 0.75 : 1), ignore: hunting ? hunting.id : null,
      canHop: this.hopCd <= 0 && p.skill > 0.35,
    }, w.senses.blips);
    if (r.mode !== 'racing') return;
    if (this.fighter.melee(w.senses.blips, this.c, w.time)) return;
    this.skillT -= PLAN_EVERY;
    if (this.skillT <= 0 && w.time >= this.firstSkillAt) {
      this.skillT = SKILL_EVERY;
      const straight = this.straightAhead(w);
      useSkill({ me: r, blips: w.senses.blips, blocked: this.plan.followGap < 8, straight, player: w.player, time: w.time }, this.c, p.skillUse, this.rng.next());
    }
    if (this.ringBell) {
      this.ringBell = false;
      this.c.bell = true;
    }
  }

  summary(): Record<string, unknown> {
    const { r } = this;
    return {
      id: r.id, c: r.character, mode: r.mode, s: Math.round(r.s), x: +r.x.toFixed(2), v: +r.speed.toFixed(1),
      planX: +this.plan.x.toFixed(2), follow: this.plan.followSpeed, hunt: this.fighter.hunt?.id ?? null,
      pace: Number.isFinite(this.paceTop) ? +this.paceTop.toFixed(2) : null, aLat: +this.grip.aLat.toFixed(2), drift: this.drift.active,
      steer: +this.c.steer.toFixed(2), throttle: +this.c.throttle.toFixed(2), brake: +this.c.brake.toFixed(2),
    };
  }

  private straightAhead(w: AiWorld): number {
    for (let d = 0; d < 160; d += 10) if (Math.abs(w.line.curv(this.r.s + d)) > 0.004) return d;
    return 160;
  }

  private drive(w: AiWorld): void {
    const { r, c, p } = this;
    if (r.mode === 'finished') {
      // Roll out after the line: brake harder when still flying (boosted finishes).
      c.throttle = 0;
      c.brake = clamp((r.speed - 5) / 10, 0.1, 0.8);
      return;
    }
    const boost = 1 + (r.boostTime > 0 ? r.boostPower : 0);
    const top = topOf(r) * r.mods.speedMul * boost;
    // Aim above top speed so the pedals stay floored, unless the pace cap binds (then ease off, no brake).
    const cap = this.paceTop * r.mods.speedMul * boost;
    const base = Math.min(top + 2, cap);
    if (this.time > this.driftRollAt) {
      this.driftRollAt = this.time + 6;
      this.driftRoll = this.rng.next();
    }
    const inside = (r.x - this.tx) * (this.drift.active ? this.drift.dir : 1);
    updateDrift(this.drift, r, w.line, p.drifter, p.skill, this.driftRoll, inside, this.stepDt);
    let target = targetSpeed(base, cornerSpeed(w.line, r.s, r.speed, this.grip.aLat), this.drift.active);
    let soft = cap < top + 2 && target >= base - 0.01;
    const { followSpeed, followGap, followKind } = this.plan;
    if (followSpeed !== null) {
      // Riders in a pack sit close (drafting); traffic and props get a real safety gap.
      const want = followKind === 'rider' ? 1.2 : 3.5 + r.speed * 0.3;
      if (followGap < want * 2) target = Math.min(target, followSpeed + (followGap - want) * 0.6);
      soft = followKind === 'rider' && followGap > 0.6;
    }
    const goal = this.fighter.huntGoal();
    const prey = this.fighter.hunt;
    if (goal && prey && Math.abs(goal.ds) < 25) {
      target = Math.min(target, prey.speed + clamp(goal.ds * 0.8, -2.5, 5));
      soft = soft || goal.ds < 0;
    }
    this.driver.speedTo(r, Math.max(0, target), c, soft);
    c.drift = this.drift.active && c.brake === 0;
    // The sim picks the drift direction from the steer sign on the press: lean into the bend first.
    if (c.drift && !r.drifting) c.steer = this.drift.dir * Math.max(0.45, Math.abs(c.steer));
    if (this.plan.hopAt !== null && this.hopCd <= 0 && !r.airborne) {
      c.hop = true;
      this.hopCd = 1.2;
    }
    if (r.airborne) c.steer = clamp(-r.yaw * 2, -0.3, 0.3);
  }

  /** Riders pinned against a wall or a stopped car pedal and steer back to the line. */
  private unstick(dt: number, c: Controls): void {
    const r = this.r;
    if (r.mode !== 'racing' || r.speed > 4) {
      this.stuckT = 0;
      return;
    }
    if (r.speed < 2) this.stuckT += dt;
    if (this.stuckT < 1.2) return;
    c.throttle = 1;
    c.brake = 0;
    c.drift = false;
    c.steer = clamp(-r.x * 0.3, -1, 1);
    if (this.stuckT > 3 && this.hopCd <= 0) {
      c.hop = true;
      this.hopCd = 1.5;
    }
  }
}
