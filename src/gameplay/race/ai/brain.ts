// One AI rider: perception → lane plan → steering/speed → drift/hop → fights/skills.
import { clamp, lerp, smoothstep } from '../../../core/math';
import type { Rng } from '../../../core/rng';
import type { Controls, RiderId, RiderState } from '../../../core/types';
import { Blunder, type BlunderGate } from './blunder';
import { Driver, topOf } from './control';
import { Fighter, type HuntToken } from './fight';
import type { RacingLine } from './line';
import type { Personality } from './personality';
import { planLateral, type PlanOutput } from './plan';
import type { Senses } from './sense';
import { useSkill } from './skills';
import { cornerSpeed, GripModel, targetSpeed, updateDrift, type DriftPlan } from './speed';
import { Showoff } from './tricks';
import { Thrower } from './throw';

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
  /** The director's once-a-race, in-view traffic blunder (blunder.ts). */
  blunder: BlunderGate;
}

const PLAN_EVERY = 0.05;
const SKILL_EVERY = 0.5;
const SOFT_CLOSING = 2;     // m/s: closing on a rider faster than this brakes instead of coasting
const FOLLOW_DECEL = 4;     // m/s²: planned deceleration when closing on a rider ahead
const CAP_SLACK = 0.5;      // m/s: aim this far above the pace cap (rubber makes the sim's top the cap itself)
const DRAFT_TOP = 0.1;      // slipstream top-speed bonus (SPEC §6, sim tuning draftTop): a drafter may close on the wheel
const RIVAL_PASS = 0.8;     // m/s: a hunted rival is fought in passing (never waited for)…
const FIGHT_PACE = 0.9;     // …and never below this share of the hunter's own race speed, so a brawl costs little time

/** Speed command of one step: target m/s and whether only easing off the pedals (never braking). */
interface SpeedGoal { target: number; soft: boolean }

export class Brain {
  readonly driver = new Driver();
  readonly fighter: Fighter;
  private grip: GripModel;
  private blunder: Blunder;
  private thrower: Thrower;
  private showoff: Showoff;
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
  private wantX = 0;              // last desired lane before the planner (debug summary)
  /** Rubber band: top-speed cap (m/s before mods/boosts) set by the director; Infinity = none. */
  paceTop = Infinity;
  /** Base pace of this rival (level reference + offset, m/s); Infinity when not racing / the player. */
  basePace = Infinity;
  /** Ring the bell on the next racing tick (after passing the player). */
  ringBell = false;
  /** Debug/test: seconds of forced braking (e.g. let the police catch the autopilot). */
  holdBrake = 0;
  /** 宿敌: this rider is the nemesis of the race (SPEC §18). */
  readonly nemesis: boolean;
  /** 围剿: this rider is one of the rivals that gang up on the player (SPEC §18). */
  ally = false;

  constructor(readonly r: RiderState, readonly c: Controls, readonly p: Personality, private rng: Rng, token: HuntToken, nemesis = false) {
    this.nemesis = nemesis;
    this.fighter = new Fighter(r, p, rng, token, nemesis);
    this.grip = new GripModel(p.risk * this.driver.authorityAtTop(r));
    this.blunder = new Blunder(r, p.skill, rng.fork(0xb1));
    this.thrower = new Thrower(r, rng.fork(0x7b), () => this.p.aggression);
    this.showoff = new Showoff(rng.fork(0x5c));
    this.tx = r.x;
    this.planT = rng.range(0, PLAN_EVERY);
    this.skillT = rng.range(0, SKILL_EVERY);
    this.wanderPhase = rng.range(0, 6.28);
    this.firstSkillAt = rng.range(5, 15);
    this.launchAt = rng.next() < p.launch ? rng.range(2.05, 2.8) : rng.next() < 0.7 ? rng.range(0.4, 1.9) : 3.5;
  }

  /** The pack of this frame (SPEC §18): the allies hunt the player and never each other. */
  setAlliance(members: readonly RiderId[], target: RiderId, feuds: ReadonlyMap<RiderId, RiderId>): void {
    this.ally = members.includes(this.r.id);
    this.fighter.setAlliance(members, target, feuds);
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
    // The throw is planned before the lane plan: the rider lines up on its target first.
    this.thrower.update(dt, {
      phase: w.phase, time: w.time, hunt: this.fighter.hunt,
    }, c, this.nemesis || this.ally);
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
    // The show-off species own the drift and the steer while they are in the air (a spin, SPEC §16).
    this.showoff.update(r, c);
    this.unstick(dt, c);
    if (this.holdBrake > 0) {
      // Debug/test brake: a full stop with hands off everything (no skills, swings, hops or bell).
      this.holdBrake -= dt;
      c.throttle = 0;
      c.brake = 1;
      c.drift = c.hop = c.attackL = c.attackR = c.heavy = c.skill1 = c.skill2 = c.skill3 = c.ult = c.bell = false;
    }
  }

  private desiredX(w: AiWorld, hw: number): number {
    const { r, p } = this;
    if (r.mode === 'finished') return this.rollOutX(hw);
    const lineX = w.line.x(r.s + Math.max(8, r.speed * 0.7));
    const bend = smoothstep(0.002, 0.009, Math.abs(w.line.peakCurv(r.s, r.s + 40)));
    const own = clamp(p.lineBias + p.wander * Math.sin(this.time * 0.23 + this.wanderPhase), -hw + 1.6, hw - 1.6);
    const x = lerp(own, lineX, clamp(p.lineFollow * (0.35 + 0.65 * bend), 0, 1));
    const goal = this.fighter.huntGoal();
    if (goal && Math.abs(goal.ds) < 25) return goal.x;
    // A throw in the making: line up on the target, beside it and not on top of it.
    const aim = this.thrower.aimX;
    if (aim !== null) return aim;
    this.updateDraft(w, bend);
    return this.draft ? this.draft.x : x;
  }

  /** Pick a wheel to sit on for a few seconds (slipstream); the planner pulls out when it closes in. */
  private updateDraft(w: AiWorld, bend: number): void {
    const d = this.draft;
    const gap = d ? d.s - this.r.s : 0;
    // Drop the wheel when it brakes or slows (closing fast): never follow a braking rider into its lane.
    if (d && (d.mode !== 'racing' || gap < 1.2 || gap > 18 || bend > 0.6 || d.speed < this.r.speed - 3)) this.draft = null;
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
    this.wantX = clamp(this.desiredX(w, hw), lo, hi);
    const blind = this.blunder.update(PLAN_EVERY, w.senses.blips, w.blunder);
    if (blind !== null) this.wantX = clamp(this.blunder.aimX, lo, hi);
    this.plan = planLateral({
      desiredX: this.wantX, prevX: this.plan.x, x: r.x, v: r.speed, lo, hi, asphalt: hw,
      horizon: (1 + 1.4 * p.skill) * (hunting ? 0.75 : 1), ignore: hunting ? hunting.id : null, blind,
      canHop: this.hopCd <= 0 && p.skill > 0.35,
    }, w.senses.blips);
    if (r.mode !== 'racing') return;
    if (this.fighter.melee(w.senses.blips, this.c, w.time)) return;
    this.skillT -= PLAN_EVERY;
    if (this.skillT <= 0 && w.time >= this.firstSkillAt) {
      this.skillT = SKILL_EVERY;
      const straight = this.straightAhead(w);
      const view = { me: r, blips: w.senses.blips, blocked: this.plan.followGap < 8, straight, player: w.player, time: w.time,
        grudge: this.fighter.grudging, field: w.riders.length, prefer: this.nemesis || this.ally ? w.player : null };
      useSkill(view, this.c, p.skillUse, this.rng.next());
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
      planX: +this.plan.x.toFixed(2), wantX: +this.wantX.toFixed(2), draft: this.draft?.id ?? null, follow: this.plan.followSpeed, hunt: this.fighter.hunt?.id ?? null,
      pace: Number.isFinite(this.paceTop) ? +this.paceTop.toFixed(2) : null, base: Number.isFinite(this.basePace) ? +this.basePace.toFixed(2) : null,
      top: +topOf(r).toFixed(2), rubber: +r.rubber.toFixed(3), aLat: +this.grip.aLat.toFixed(2), drift: this.drift.active,
      steer: +this.c.steer.toFixed(2), throttle: +this.c.throttle.toFixed(2), brake: +this.c.brake.toFixed(2),
      fight: this.fighter.debug(), blind: this.blunder.oid,
    };
  }

  private straightAhead(w: AiWorld): number {
    for (let d = 0; d < 160; d += 10) if (Math.abs(w.line.curv(this.r.s + d)) > 0.004) return d;
    return 160;
  }

  private drive(w: AiWorld): void {
    const { r, c } = this;
    const g = r.mode === 'finished' ? this.rollOut() : this.raceSpeed(w);
    this.followLimit(g);
    if (r.mode === 'racing') this.huntLimit(g);
    this.driver.speedTo(r, Math.max(0, g.target), c, g.soft);
    c.drift = this.drift.active && c.brake === 0;
    // The sim picks the drift direction from the steer sign on the press: lean into the bend first.
    if (c.drift && !r.drifting) c.steer = this.drift.dir * Math.max(0.45, Math.abs(c.steer));
    if (this.plan.hopAt !== null && this.hopCd <= 0 && !r.airborne) {
      c.hop = true;
      this.hopCd = 1.2;
    }
    if (r.airborne) c.steer = clamp(-r.yaw * 2, -0.3, 0.3);
  }

  /** Racing speed: own top and the pace cap (× boosts and slipstream), corners ahead, the drift plan. */
  private raceSpeed(w: AiWorld): SpeedGoal {
    const { r, p } = this;
    // Boosts and the slipstream lift the cap like they lift the sim's top: a drafter closes on the wheel ahead
    // and slingshots past, so the leader of a pack (no draft) can be caught.
    const boost = (1 + (r.boostTime > 0 ? r.boostPower : 0)) * (1 + DRAFT_TOP * r.draft);
    // Own bike top (× the race's rubber band factor, which the sim multiplies in) × statuses × boost.
    const top = topOf(r) * r.rubber * r.mods.speedMul * boost;
    // Aim above top speed so the pedals stay floored up to the pace cap (the rubber factor holds the sim's top
    // there); above it (a boost wearing off, rubber still easing) ease off, no brake.
    const cap = this.paceTop * r.mods.speedMul * boost + CAP_SLACK;
    const base = Math.min(top + 2, cap);
    if (this.time > this.driftRollAt) {
      this.driftRollAt = this.time + 6;
      this.driftRoll = this.rng.next();
    }
    const inside = (r.x - this.tx) * (this.drift.active ? this.drift.dir : 1);
    updateDrift(this.drift, r, w.line, p.drifter, p.skill, this.driftRoll, inside, this.stepDt);
    const target = targetSpeed(base, cornerSpeed(w.line, r.s, r.speed, this.grip.aLat), this.drift.active);
    // Soft (ease off, never brake) only while the pace cap is the binding limit; followLimit() and huntLimit()
    // brake for anything slow or stopped in front.
    return { target, soft: cap < top + 2 && target >= base - 0.01 };
  }

  /**
   * Past the line the sim coasts the bike to a stop (its finish auto-brake, ~60 m): the brain never pedals, it
   * pulls over (rollOutX) and brakes for anyone stopped ahead (followLimit).
   */
  private rollOut(): SpeedGoal {
    this.drift.active = false;
    return { target: this.r.speed - 0.7, soft: true };
  }

  /** Lane after the finish: the road edge, sides alternating by place, so later finishers have a clear road. */
  private rollOutX(hw: number): number {
    return (this.r.place % 2 === 1 ? 1 : -1) * (hw - 1.3);
  }

  /**
   * Riders in a pack sit close (drafting), but closing fast on one brakes in time (stopping-distance speed);
   * traffic and props get a real safety gap.
   */
  private followLimit(g: SpeedGoal): void {
    const { r } = this;
    const { followSpeed, followGap, followKind } = this.plan;
    if (followSpeed === null) return;
    const rider = followKind === 'rider';
    const room = followGap - (rider ? 1.2 : 3.5 + r.speed * 0.3);
    const t = followSpeed + (rider && room > 0 ? Math.sqrt(2 * FOLLOW_DECEL * room) : room * 0.6);
    if ((rider || room < 3.5 + r.speed * 0.3) && t < g.target) {
      g.target = t;
      g.soft = rider && followGap > 0.6 && r.speed - followSpeed < SOFT_CLOSING;
    }
  }

  /**
   * A hunter rides alongside the player: match its speed, closing in from behind (brake on a slow player); ahead
   * of it only ease off, unless it owes a payback (then brake to let the player come up). A rival is fought in
   * passing: closing in from behind, then a slow overtake (RIVAL_PASS) while swinging, never waiting for it nor
   * dropping below FIGHT_PACE of its own race speed (a slow rival gets one swing as the hunter goes by).
   */
  private huntLimit(g: SpeedGoal): void {
    const goal = this.fighter.huntGoal();
    const prey = this.fighter.hunt;
    if (!goal || !prey || Math.abs(goal.ds) >= 25) return;
    const close = clamp(goal.ds * 0.8, -2.5, 5);
    const t = prey.isPlayer ? prey.speed + close : Math.max(prey.speed + Math.max(RIVAL_PASS, close), g.target * FIGHT_PACE);
    if (t < g.target) {
      g.target = t;
      g.soft = (goal.ds < 0 && !this.fighter.owes) || (goal.ds >= 0 && this.r.speed - prey.speed < SOFT_CLOSING);
    }
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
