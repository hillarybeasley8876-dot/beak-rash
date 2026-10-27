// pelican.ult SHOWTIME (SP 100): ult:start (fx cut-in + slow-mo), leap to 8 m, dive-bomb; the impact
// shockwave hits riders 40 m ahead / 20 m behind: 45 dmg + knock + 1 s stun (≤ 20 % HP left = KO), then
// ult:impact. The leap homes forward onto the pack (ult-aim.ts; never backwards, so a cast can't cost places);
// with nobody in reach the cast is denied (无目标！) — r6: a police officer in reach counts (SPEC §25: the shockwave
// knocks out every officer it reaches, combat:obstacleHit with ko). Its hits and KOs refund no SP, nor does the caster's fighting
// for SP.afterUlt s (sp.ts fightSp). The shockwave is drawn as bands hugging the road that part around riders.
import { easeInCubic, easeOutCubic } from '../../../core/math';
import type { RiderState } from '../../../core/types';
import { BIKES } from '../../../data/bikes';
import { targetable, type CombatCtx } from '../ctx';
import { impact } from '../feedback';
import { addStatus, removeStatus } from '../statuses';
import { GroundRing } from '../visuals/ground-ring';
import { Trail } from '../visuals/trail';
import { obstaclesIn, skillHit, skillObstacleHit } from './common';
import { homeStep, planUlt, type UltPlan, type UltReach } from './ult-aim';
import { TimedSkill, type EndReason, type SkillImpl } from './types';

const ID = 'pelican.ult';
export const ULT = {
  rise: 0.5, hang: 0.18, dive: 0.22, recover: 0.3, height: 8,
  ahead: 40, behind: 20, damage: 45, knock: 9, stun: 1, // behind: the leap never homes back onto a pack behind
  execute: 0.2, // victims the shockwave leaves at ≤ 20 % HP are knocked out (the chain-KO money shot)
  diveSpeed: 6, // m/s added for the dive
  leapTop: 1,   // leap speed ≥ this share of the bike's top speed (no one right behind passes under the cut-in)
  lead: 0.3,    // m the leap keeps ahead of a boosted rider from behind that would pass it in the air
  passing: 3,   // m: a rider this little ahead, still counted behind by the standings, is mid-pass (kept behind)
  lineGap: 3,   // m the impact must stay short of the finish line (else the cast is denied)
} as const;
const IMPACT_T = ULT.rise + ULT.hang + ULT.dive;

/** Track speed of the leap before the dive: the caster's own, or the bike's cruising top speed if it was slower. */
const leapSpeed = (r: RiderState): number => Math.max(r.speed, BIKES[r.bike].topSpeed * ULT.leapTop);
const REACH: UltReach = {
  ahead: ULT.ahead, behind: ULT.behind, lineGap: ULT.lineGap, flight: IMPACT_T, extra: ULT.diveSpeed * ULT.dive, speed: leapSpeed,
};
/** Where SHOWTIME would land now (null = no rider to hit short of the finish line). */
const plan = (ctx: CombatCtx, r: RiderState): UltPlan | null => planUlt(ctx, r, REACH);

/** An officer the natural landing's shockwave would reach (short of the finish line): reason enough to cast. */
function officerInReach(ctx: CombatCtx, r: RiderState): boolean {
  const travel = leapSpeed(r) * IMPACT_T + REACH.extra;
  if (r.s + travel >= ctx.session.track.length - ULT.lineGap) return false;
  return obstaclesIn(ctx, r, (o, ds) => o.kind === 'police' && ds >= -ULT.behind && ds <= travel + ULT.ahead).length > 0;
}

class Showtime extends TimedSkill {
  private hit = false;
  private leap: number; // track speed the leap keeps (leapSpeed at the cast)
  private trail: Trail;
  private anchor: RiderState | null;
  private behind: RiderState[]; // riders behind at the cast (by s or in the standings): none passes it in the air

  constructor(ctx: CombatCtx, r: RiderState, aim: UltPlan | null) {
    super(ctx, r, ID, IMPACT_T + ULT.recover, true, 'ult');
    this.anchor = aim?.anchor ?? null;
    this.leap = leapSpeed(r);
    this.behind = ctx.session.riders.filter((o) => o !== r && (o.s < r.s || (o.place > r.place && o.s - r.s < ULT.passing)));
    r.airborne = true; // airborne from the first step so sim adopts the flight as 'external' (no landing bonus)
    addStatus(r, 'intangible', IMPACT_T + ULT.recover + 0.1, 1, r.id, true);
    ctx.view(r)?.cue('ult', { skillId: ID });
    ctx.bus.emit('ult:start', { riderId: r.id, skillId: ID });
    const vs = ctx.visuals;
    this.trail = vs.add(new Trail(vs, (out) => {
      if (this.hit || r.mode === 'crashed') return false;
      vs.local(r, 0, 1.1, 0.3, out);
      return true;
    }, { color: '#ff1e3c', width: 0.5, life: 0.3, max: 24, alpha: 0.75 }));
  }

  /** Height curve: ease up, hang, dive. */
  private heightAt(t: number): number {
    if (t < ULT.rise) return ULT.height * easeOutCubic(t / ULT.rise);
    if (t < ULT.rise + ULT.hang) return ULT.height;
    if (t < IMPACT_T) return ULT.height * (1 - easeInCubic((t - ULT.rise - ULT.hang) / ULT.dive));
    return 0;
  }

  private fly(t: number, dt: number): void {
    const r = this.caster;
    const y = this.heightAt(t);
    r.vy = dt > 0 ? (this.heightAt(t + dt) - y) / dt : 0;
    r.y = y;
    r.airborne = true;
    r.speed = Math.max(r.speed, this.leap + (t > ULT.rise + ULT.hang ? ULT.diveSpeed : 0));
  }

  override pre(dt: number): void {
    if (!this.hit) this.fly(this.t, dt);
  }

  /**
   * A cast never costs places: a (boosted) rider from behind that catches the leap, or one passing the caster as it
   * casts (not counted ahead yet), is kept just behind it.
   */
  private stayAhead(): void {
    const r = this.caster;
    for (const o of this.behind) {
      // (a test-pinned rider follows the caster: chasing it would run away)
      if (o.mode === 'racing' && !o.mods.intangible && !this.ctx.rd(o).pin && o.s + ULT.lead > r.s) r.s = o.s + ULT.lead;
    }
  }

  protected tick(dt: number): void {
    if (this.hit) return;
    if (this.anchor) homeStep(this.ctx, this.caster, this.anchor, this.t, dt, IMPACT_T);
    this.stayAhead();
    if (this.t < IMPACT_T) {
      this.fly(this.t, dt);
      return;
    }
    this.slam();
  }

  private slam(): void {
    const { ctx, caster: r } = this;
    this.hit = true;
    this.trail.cut(); // the dive's red streak would hang in front of the victims in the impact shot
    r.y = r.vy = 0;
    r.airborne = false;
    const victims = ctx.session.riders.filter((v) => {
      if (v === r || !targetable(ctx, v)) return false;
      const ds = v.s - r.s;
      return ds <= ULT.ahead && ds >= -ULT.behind;
    });
    victims.forEach((v, i) => {
      const out = skillHit(ctx, r, v, ID, { damage: ULT.damage, knock: ULT.knock, stun: ULT.stun, speedLoss: 0.3, heavy: true, impact: 'ult', countCombo: i === 0 });
      if (out === 'landed' && v.hp <= v.maxHp * ULT.execute) v.hp = 0; // KO'd in postStep, credited to the ult
    });
    // The police (SPEC §25): every officer in the shockwave's reach is knocked out, whatever its HP.
    for (const o of obstaclesIn(ctx, r, (ob, ds) => ob.kind === 'police' && ds <= ULT.ahead && ds >= -ULT.behind)) {
      skillObstacleHit(ctx, r, o, ID, ULT.damage, true);
    }
    const pos = ctx.pos(r, 0.2);
    ctx.bus.emit('ult:impact', { riderId: r.id, skillId: ID, pos, victims: victims.map((v) => v.id) });
    impact(ctx, 'ult', r, null); // coalesced with the victims' hits into one punch
    const vs = ctx.visuals;
    vs.add(new GroundRing(vs, r.s, r.x, { color: '#ff1e3c', from: 1, to: ULT.ahead, dur: 0.75, source: r }));
    vs.add(new GroundRing(vs, r.s, r.x, { color: '#ffffff', from: 0.5, to: ULT.ahead * 0.8, dur: 0.6, delay: 0.06, source: r }));
    vs.add(new GroundRing(vs, r.s, r.x, { color: '#0b0b0f', from: 0.5, to: ULT.ahead * 0.55, dur: 0.5, delay: 0.12, source: r }));
  }

  protected override cleanup(reason: EndReason): void {
    const r = this.caster;
    this.trail.stop();
    if (reason !== 'dispose') removeStatus(r, 'intangible');
    if (!this.hit && (reason === 'crash' || reason === 'finish')) r.airborne = r.y > 0.01;
  }
}

export const ult: SkillImpl = {
  id: ID, noTarget: '无目标！', ready: (ctx, r) => plan(ctx, r) !== null || officerInReach(ctx, r),
  cast: (ctx, r) => new Showtime(ctx, r, plan(ctx, r)),
};
