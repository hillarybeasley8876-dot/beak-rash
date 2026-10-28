// AI fighting: melee on riders alongside (side select, heavy when armed, counters), who to hunt
// (angry → the bell ringer; aggressive riders pick fights, a human and a rival race leader more often, so a
// runaway leader gets hit). Fairness rules
// for a human: nobody picks on them in the first seconds, one hunter at a time (a token per human), no fresh hunt
// on a battered human, and a hunter backs off for a few seconds once it has landed its hit budget.
// Hit a rival and it may hold a grudge (species temper): it owes you one swing for 5 s (taken as soon as it
// is back in reach; a skill hit pays too), hunts you for 4–6 s outside the token but within the budget and grace,
// and may spend up to 3 s of a catch-up (pace.ts paybackPace, in view) to close the last 8 m.
// Online (SPEC §28) the human is not the local player: every human has its own token, budget and grudges.
import { WEAPONS } from '../../../data/weapons';
import type { Rng } from '../../../core/rng';
import type { Controls, RiderId, RiderState } from '../../../core/types';
import type { Personality } from './personality';
import type { Blip } from './sense';

const MELEE_DS = 1.5;           // combat hits within |ds| < 1.6
const WINDUP_LIGHT = 0.06;
const CALM_START = 6;           // s after GO before anyone picks on the player
const BUDGET_WINDOW = 4;        // s window of the hunt budget
const LOW_HP = 0.3;             // no fresh hunt on a player below this HP fraction
const HEAVY_VS_PLAYER = 0.7;    // heavy-swing share against the player (× personality)
const RETALIATE_WINDOW = 5;     // s after being hit by the player in which a grudge swings back once in reach
const PAYBACK_RETRY = 0.25;     // s before another payback try after a failed roll (not a full reaction period)
const CATCH_UP_TIME = 3;        // s of grudge catch-up (pace.ts paybackPace, also in view) per grudge…
const CATCH_UP_GAP = 8;         // …only to close the last metres to the player ahead
const LEADER_PULL = 2;          // hunt weight of a rival leading the race (the player has playerPull)
const LEADER_FURY = 1;          // attack-chance multiplier on a rival race leader in reach (others 0.65)
const NEMESIS_GRUDGE = 2;       // the nemesis holds its grudge twice as long (SPEC §18)
const NEMESIS_CATCH = 6;        // …and its catch-up window is twice the usual one

/** Who currently hunts a human (at most one rider per human; angry riders ignore it). */
export interface HuntToken { holder: RiderId | null }

/** The hunt tokens of a race: one per human (SPEC §28 — offline a single human, the player). */
export type HuntTokens = Map<RiderId, HuntToken>;

export const canFight = (r: RiderState): boolean =>
  r.mode === 'racing' && r.action === null && r.mods.canAttack && !r.airborne;

const targetable = (t: RiderState): boolean =>
  (t.mode === 'racing' || t.mode === 'finished') && !t.mods.intangible && !t.mods.invisible && t.invuln <= 0;

export class Fighter {
  private attackT = 0;
  hunt: RiderState | null = null;
  private huntT = 0;
  private pickT = 2;
  private restT = 0;                       // s of leaving the humans alone after spending the budget
  private hits = new Map<RiderId, number[]>();  // per human: race times of recent hits landed on it
  private angryAt: RiderId | null = null;
  private graceT = 0;                      // s before swinging at a human again (after landing a hit)
  private retaliateT = 0;                  // s left to swing back at a human on the next chance in reach
  private grudgeT = 0;                     // s left of a grudge hunt on a human
  private catchT = 0;                      // s of grudge catch-up left
  private allies = new Set<RiderId>();     // the pack of this frame (围剿)
  private allianceTarget: RiderId = -1;
  private feud: RiderId | null = null;     // the ally this one is feuding with (plastic friendship)

  constructor(private me: RiderState, private p: Personality, private rng: Rng, private tokens: HuntTokens, private nemesis = false) {}

  /** The hunt token of a human (created on demand): one hunter per human (SPEC §28). */
  private tokenFor(id: RiderId): HuntToken {
    let t = this.tokens.get(id);
    if (!t) { t = { holder: null }; this.tokens.set(id, t); }
    return t;
  }

  /** The pack of this frame: the allies hunt the target and never each other. */
  setAlliance(members: readonly RiderId[], target: RiderId, feuds: ReadonlyMap<RiderId, RiderId>): void {
    this.allianceTarget = target;
    this.feud = feuds.get(this.me.id) ?? null;
    if (members.length !== this.allies.size || members.some((id) => !this.allies.has(id))) {
      this.allies = new Set(members);   // the pack only changes when a new alliance forms
    }
  }

  tick(dt: number): void {
    this.attackT -= dt;
    this.huntT -= dt;
    this.pickT -= dt;
    this.restT -= dt;
    this.graceT -= dt;
    this.retaliateT -= dt;
    this.grudgeT -= dt;
  }

  /** Hunting a human out of a grudge (skills fire more eagerly). */
  get grudging(): boolean {
    return this.grudgeT > 0 && this.hunt?.human === true;
  }

  /** Still owes the hunted human a payback swing (brakes to let a human behind come alongside). */
  get owes(): boolean {
    return this.retaliateT > 0 && this.hunt?.human === true;
  }

  /** This rider landed a hit on a human at race time `time`; spending the budget ends the hunt. */
  landedOnHuman(time: number, human: RiderState): void {
    this.attackT = Math.max(this.attackT, this.p.grace);
    this.graceT = this.p.grace;
    this.retaliateT = 0;
    // The hit budget is per human: spending it on one does not stop the hunt on another.
    const recent = (this.hits.get(human.id) ?? []).filter((t) => time - t < BUDGET_WINDOW);
    recent.push(time);
    this.hits.set(human.id, recent);
    if (recent.length < this.p.huntBudget || this.angryAt === human.id) return;
    this.hits.set(human.id, []);
    this.restT = this.rng.range(3, 5);
    if (this.hunt === human) this.setHunt(null);
  }

  /** A human hit this rider at race time `time`: maybe hold a grudge (species temper, never in the calm start). */
  wronged(human: RiderState, time: number): void {
    if (time < CALM_START || this.restT > 0 || this.me.mode !== 'racing' || this.rng.next() > this.p.grudge) return;
    this.retaliateT = RETALIATE_WINDOW;
    this.catchT = CATCH_UP_TIME;
    if (this.graceT <= 0) this.attackT = Math.min(this.attackT, 0.1);
    if (human.hp < human.maxHp * LOW_HP || !targetable(human)) return;
    if (this.hunt !== human) this.setHunt(human);
    const windowMul = this.nemesis ? NEMESIS_GRUDGE : 1;
    this.grudgeT = this.rng.range(4, 6) * windowMul;
    this.huntT = Math.max(this.huntT, this.grudgeT);
  }

  private setHunt(t: RiderState | null): void {
    const me = this.me.id;
    const old = this.hunt;
    if (old && old.human) {
      const tok = this.tokenFor(old.id);
      if (tok.holder === me) tok.holder = null;
    }
    this.hunt = t;
    if (t && t.human) {
      const tok = this.tokenFor(t.id);
      if (tok.holder === null) tok.holder = me;
    }
  }

  /** May this rider go after a human right now (not angry at them)? */
  private humanFair(human: RiderState, time: number): boolean {
    if (this.angryAt === human.id) return true;
    return time >= CALM_START && this.restT <= 0;
  }

  /** Choose or drop a hunting target. `riders` = everyone in the race, `humans` = the humans (SPEC §28). */
  chooseTarget(riders: readonly RiderState[], humans: readonly RiderState[], time: number): void {
    const me = this.me;
    if (me.mode !== 'racing') { if (this.hunt) this.setHunt(null); return; }
    const angry = me.statuses.find((s) => s.id === 'angry' && s.source !== null);
    this.angryAt = angry?.source ?? null;
    if (angry) {
      const src = riders.find((r) => r.id === angry.source) ?? null;
      if (src && src !== me && targetable(src)) {
        if (this.hunt !== src) this.setHunt(src);
        this.huntT = Math.max(this.huntT, angry.time);
        return;
      }
    }
    // 塑料友谊: the two that hit each other settle it between themselves for a few seconds.
    if (this.feud !== null) {
      const f = riders.find((r) => r.id === this.feud) ?? null;
      if (f && targetable(f) && Math.abs(f.s - me.s) < 25) {
        if (this.hunt !== f) this.setHunt(f);
        this.huntT = Math.max(this.huntT, 2);
        return;
      }
    }
    // 围剿: an ally of the pack hunts the human it is ganging up on, never one of its own.
    if (this.allies.has(me.id) && this.allianceTarget >= 0) {
      const t = riders.find((r) => r.id === this.allianceTarget) ?? null;
      if (t && targetable(t) && Math.abs(t.s - me.s) < 30 && this.humanFair(t, time)) {
        if (this.hunt !== t) this.setHunt(t);
        this.huntT = Math.max(this.huntT, 2);
        return;
      }
    }
    // 宿敌: the nemesis goes for a human whenever it can reach it (the calm start still applies).
    if (this.nemesis) {
      for (const h of humans) {
        if (targetable(h) && Math.abs(h.s - me.s) < 30 && this.humanFair(h, time)) {
          if (this.hunt !== h) this.setHunt(h);
          this.huntT = Math.max(this.huntT, 2);
          return;
        }
      }
    }
    const h = this.hunt;
    if (h && (this.huntT <= 0 || !targetable(h) || Math.abs(h.s - me.s) > 30 || (h.human && !this.humanFair(h, time)))) this.setHunt(null);
    if (this.hunt || this.pickT > 0) return;
    this.pickT = this.rng.range(1.5, 3.5);
    if (this.rng.next() > this.p.aggression * 0.75) return;
    let best: RiderState | null = null, bestScore = 0;
    for (const r of riders) {
      if (r === me || !targetable(r)) continue;
      if (r.human) {
        // A human is only fair game when it may be hunted: after the calm start, healthy enough, and with
        // the hunt token of THAT human free (one hunter per human, SPEC §28).
        if (!this.humanFair(r, time) || r.hp < r.maxHp * LOW_HP) continue;
        const tok = this.tokenFor(r.id);
        if (tok.holder !== null && tok.holder !== me.id) continue;
      } else if (this.allies.has(r.id) && r.id !== this.feud) continue;   // no friendly fire in the pack
      const ds = r.s - me.s;
      if (ds < -8 || ds > 16) continue;
      const pull = r.human ? this.p.playerPull : r.place === 1 ? LEADER_PULL : 1;
      const score = pull * (1 - Math.abs(ds) / 18) * this.rng.range(0.6, 1.4);
      if (score > bestScore) { bestScore = score; best = r; }
    }
    if (best) {
      this.setHunt(best);
      this.huntT = this.rng.range(2.5, 6) * (0.6 + this.p.aggression);
    }
  }

  /** Press an attack when a rival is in reach. Returns true when a swing was started. */
  melee(blips: readonly Blip[], c: Controls, time: number): boolean {
    const me = this.me;
    if (this.attackT > 0 || !canFight(me)) return false;
    const reach = WEAPONS[me.weapon].reach;
    for (const b of blips) {
      const t = b.rider;
      if (!t || Math.abs(b.ds) > MELEE_DS || !targetable(t)) continue;
      if (this.allies.has(t.id) && t.id !== this.feud) continue;   // the pack never hits itself
      if (t.human && !this.humanFair(t, time)) continue;
      const dx = t.x - me.x;
      const ad = Math.abs(dx);
      if (ad < 0.45 || ad > reach - 0.15) continue;
      const winding = t.action !== null && (t.action.kind === 'attack' || t.action.kind === 'heavy') && t.action.t < WINDUP_LIGHT * 2;
      const hunted = this.hunt === t;
      const fury = t.human ? (hunted ? this.p.playerFury : 1) : hunted ? 1.4 : t.place === 1 ? LEADER_FURY : 0.65;
      const payback = t.human && this.retaliateT > 0;
      const chance = payback ? 0.9 : this.p.aggression * fury + (winding ? this.p.skill * 0.5 : 0);
      // A missed payback roll retries soon (it is still owed); a swing or any other decision waits a reaction period.
      this.attackT = payback ? PAYBACK_RETRY : this.p.reaction * this.rng.range(0.7, 1.3);
      if (this.rng.next() > chance) return false;
      if (payback) {
        this.retaliateT = 0;
        this.attackT = this.p.reaction * this.rng.range(0.7, 1.3);
      }
      // A payback is a quick jab: a heavy's long windup would just get countered by the human's next swing.
      const heavy = payback ? 0 : this.p.heavyChance * (t.human ? HEAVY_VS_PLAYER : 1);
      if (me.weapon !== 'none' && this.rng.next() < heavy) c.heavy = true;
      else if (dx > 0) c.attackR = true;
      else c.attackL = true;
      return true;
    }
    return false;
  }

  /**
   * A grudge that still owes a human a swing, with that human 0.5–8 m ahead: may close in at paybackPace() in
   * view (the director's rubber band) for up to 3 s per grudge. Call once per step; spends the budget while true.
   */
  paybackChase(human: RiderState, dt: number): boolean {
    const gap = human.s - this.me.s;
    if (this.nemesis) {
      // 复仇之心: the nemesis closes the last metres whenever the human is just ahead (twice the window).
      if (gap < 0.5 || gap > CATCH_UP_GAP || this.hunt !== human) return false;
      this.catchT = Math.max(this.catchT, NEMESIS_CATCH);
      return true;
    }
    if (this.retaliateT <= 0 || this.catchT <= 0 || this.hunt !== human || gap < 0.5 || gap > CATCH_UP_GAP) return false;
    this.catchT -= dt;
    return true;
  }

  /** Lateral spot and speed to sit alongside the hunted rider, or null when not hunting. */
  huntGoal(): { x: number; ds: number } | null {
    const t = this.hunt;
    if (!t) return null;
    const side = this.me.x >= t.x ? 1 : -1;
    return { x: t.x + side * 1.2, ds: t.s - this.me.s };
  }

  /** Debug/tests: timers of the fight state (s). */
  debug(): Record<string, number> {
    const f = (v: number): number => +Math.max(0, v).toFixed(2);
    return { attack: f(this.attackT), owed: f(this.retaliateT), grudge: f(this.grudgeT), catchUp: f(this.catchT), rest: f(this.restT) };
  }

  /** Release the hunt (and the player token) when this rider leaves the race or the brain is dropped. */
  release(): void {
    this.setHunt(null);
  }
}
