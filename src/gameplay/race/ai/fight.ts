// AI fighting: melee on riders alongside (side select, heavy when armed, counters), who to hunt
// (angry → the bell ringer; aggressive riders pick fights, the player a bit more often). Fairness rules
// for the player: nobody picks on them in the first seconds, one hunter at a time (token), no fresh hunt
// on a battered player, and a hunter backs off for a few seconds once it has landed its hit budget.
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

/** Who currently hunts the player (at most one rider; angry riders ignore it). */
export interface HuntToken { holder: RiderId | null }

export const canFight = (r: RiderState): boolean =>
  r.mode === 'racing' && r.action === null && r.mods.canAttack && !r.airborne;

const targetable = (t: RiderState): boolean =>
  (t.mode === 'racing' || t.mode === 'finished') && !t.mods.intangible && !t.mods.invisible && t.invuln <= 0;

export class Fighter {
  private attackT = 0;
  hunt: RiderState | null = null;
  private huntT = 0;
  private pickT = 2;
  private restT = 0;                       // s of leaving the player alone after spending the budget
  private hits: number[] = [];             // race times of recent hits landed on the player
  private angryAt: RiderId | null = null;

  constructor(private me: RiderState, private p: Personality, private rng: Rng, private token: HuntToken) {}

  tick(dt: number): void {
    this.attackT -= dt;
    this.huntT -= dt;
    this.pickT -= dt;
    this.restT -= dt;
  }

  /** This rider landed a hit on the player at race time `time`; spending the budget ends the hunt. */
  landedOnPlayer(time: number, player: RiderState): void {
    this.attackT = Math.max(this.attackT, this.p.grace);
    this.hits = this.hits.filter((t) => time - t < BUDGET_WINDOW);
    this.hits.push(time);
    if (this.hits.length < this.p.huntBudget || this.angryAt === player.id) return;
    this.hits.length = 0;
    this.restT = this.rng.range(3, 5);
    if (this.hunt === player) this.setHunt(null);
  }

  private setHunt(t: RiderState | null): void {
    const me = this.me.id;
    if (this.hunt?.isPlayer && this.token.holder === me) this.token.holder = null;
    this.hunt = t;
    if (t?.isPlayer && this.token.holder === null) this.token.holder = me;
  }

  /** May this rider go after the player right now (not angry at them)? */
  private playerFair(player: RiderState, time: number): boolean {
    if (this.angryAt === player.id) return true;
    return time >= CALM_START && this.restT <= 0;
  }

  /** Choose or drop a hunting target. `riders` = everyone in the race, `time` = race seconds. */
  chooseTarget(riders: readonly RiderState[], player: RiderState, time: number): void {
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
    const h = this.hunt;
    if (h && (this.huntT <= 0 || !targetable(h) || Math.abs(h.s - me.s) > 30 || (h === player && !this.playerFair(player, time)))) this.setHunt(null);
    if (this.hunt || this.pickT > 0) return;
    this.pickT = this.rng.range(1.5, 3.5);
    if (this.rng.next() > this.p.aggression * 0.75) return;
    const playerOk = this.playerFair(player, time) && player.hp >= player.maxHp * LOW_HP
      && (this.token.holder === null || this.token.holder === me.id);
    let best: RiderState | null = null, bestScore = 0;
    for (const r of riders) {
      if (r === me || !targetable(r) || (r === player && !playerOk)) continue;
      const ds = r.s - me.s;
      if (ds < -8 || ds > 16) continue;
      const score = (r === player ? this.p.playerPull : 1) * (1 - Math.abs(ds) / 18) * this.rng.range(0.6, 1.4);
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
      if (t.isPlayer && !this.playerFair(t, time)) continue;
      const dx = t.x - me.x;
      const ad = Math.abs(dx);
      if (ad < 0.45 || ad > reach - 0.15) continue;
      const winding = t.action !== null && (t.action.kind === 'attack' || t.action.kind === 'heavy') && t.action.t < WINDUP_LIGHT * 2;
      const hunted = this.hunt === t;
      const fury = t.isPlayer ? (hunted ? this.p.playerFury : 1) : hunted ? 1.4 : 0.65;
      const chance = this.p.aggression * fury + (winding ? this.p.skill * 0.5 : 0);
      this.attackT = this.p.reaction * this.rng.range(0.7, 1.3);
      if (this.rng.next() > chance) return false;
      const heavy = this.p.heavyChance * (t.isPlayer ? HEAVY_VS_PLAYER : 1);
      if (me.weapon !== 'none' && this.rng.next() < heavy) c.heavy = true;
      else if (dx > 0) c.attackR = true;
      else c.attackL = true;
      return true;
    }
    return false;
  }

  /** Lateral spot and speed to sit alongside the hunted rider, or null when not hunting. */
  huntGoal(): { x: number; ds: number } | null {
    const t = this.hunt;
    if (!t) return null;
    const side = this.me.x >= t.x ? 1 : -1;
    return { x: t.x + side * 1.2, ds: t.s - this.me.s };
  }

  /** Release the hunt (and the player token) when this rider leaves the race or the brain is dropped. */
  release(): void {
    this.setHunt(null);
  }
}
