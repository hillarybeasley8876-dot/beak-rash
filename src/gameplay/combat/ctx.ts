// Shared combat context: session handles, the combat clock, per-rider private data and track-space queries.
// Subsystems (pickups, projectiles, visuals, skills) are attached by system.ts after construction.
import { Group, Quaternion, Vector3 } from 'three';
import type { RiderView, Session } from '../../core/contracts';
import type { Rng } from '../../core/rng';
import type { RiderId, RiderState, Side, StatusId, WeaponId } from '../../core/types';
import type { PropLibrary } from './meshes/library';
import type { PickupSystem } from './pickups/pickups';
import type { ProjectileSystem } from './projectiles/projectiles';
import type { SkillRunner } from './skills/runner';
import type { VisualSystem } from './visuals/visuals';

/** Phase lengths (s) of a swing. */
export interface SwingTiming { windup: number; active: number; recover: number; total: number }

/** Combat bookkeeping that is private to this unit (RiderState only carries the shared fields). */
export interface RiderCombat {
  swing: SwingTiming;                             // timing of the current / last swing
  buffered: { heavy: boolean; side: Side | 0; age: number } | null; // swing pressed during a swing tail / stagger
  skillBuf: Array<{ slot: number; age: number; hold: number }>; // skills pressed while busy (one per slot), retried
  bellBuf: number | null;                         // age of a bell press held while a swing / stagger finishes
  bellCd: number;
  bellPaid: number[];                             // combat time the bell last paid SP for provoking rider [id]
  nextCrit: boolean;                              // ONE MORE! grants a guaranteed crit
  koFired: boolean;                               // combat:ko already emitted for this wreck
  hpAtCrash: number;                              // HP when the current wreck started
  lastAttack: number;                             // session time of the last hit this rider landed
  hitByMirror: RiderId | null;                    // detects lastHitBy writes from other units
  koBy: { attacker: RiderId | null; skillId: string | null; weapon: WeaponId } | null;
  pin: { ds: number; dx: number; passive: boolean } | null; // test harness: hold position vs the player
}

/** Test overrides for random rolls (debug API). undefined = roll normally. */
export interface ForcedRolls { crit?: boolean; loose?: boolean; block?: boolean }

export class CombatCtx {
  readonly bus: Session['app']['bus'];
  readonly root = new Group();
  readonly data: RiderCombat[];
  readonly force: ForcedRolls = {};
  /** Combat seconds since creation (advances in every racing substep). */
  time = 0;
  lib!: PropLibrary;
  pickups!: PickupSystem;
  projectiles!: ProjectileSystem;
  visuals!: VisualSystem;
  skills!: SkillRunner;
  private tmp = new Vector3();
  private posTmp = new Vector3();
  private lift = new Vector3();
  private quat = new Quaternion();

  constructor(readonly session: Session, readonly rng: Rng) {
    this.bus = session.app.bus;
    this.root.name = 'combat';
    session.world.add(this.root);
    this.data = session.riders.map(() => ({
      swing: { windup: 0, active: 0, recover: 0, total: 0 }, buffered: null, skillBuf: [], bellBuf: null, bellCd: 0, bellPaid: session.riders.map(() => -Infinity),
      nextCrit: false, koFired: false, hpAtCrash: 0, lastAttack: -999, hitByMirror: null, koBy: null, pin: null,
    }));
  }

  get racing(): boolean {
    return this.session.phase === 'racing';
  }

  /** Shared clock for RiderState.lastHitTime (session seconds since GO). */
  now(): number {
    return this.session.time;
  }

  /** A random roll that tests can force through the debug API. */
  roll(p: number, forced: boolean | undefined): boolean {
    return forced ?? this.rng.chance(p);
  }

  rd(r: RiderState): RiderCombat {
    const d = this.data[r.id];
    if (!d) throw new Error(`[combat] no data for rider ${r.id}`);
    return d;
  }

  view(r: RiderState): RiderView | undefined {
    return this.session.views.get(r.id);
  }

  /** World point of a track-space position; `out` defaults to a shared temp (copy it if you keep it). */
  world(s: number, x: number, y: number, out: Vector3 = this.tmp): Vector3 {
    return this.session.track.toWorld(s, x, y, out);
  }

  /** Plain-object world position `lift` m up the rider's body, following lean / yaw / pitch (event payloads). */
  pos(r: RiderState, lift = 1.1): { x: number; y: number; z: number } {
    const p = this.posTmp;
    this.session.physics.pose(r, p, this.quat);
    p.add(this.lift.set(0, lift, 0).applyQuaternion(this.quat));
    return { x: p.x, y: p.y, z: p.z };
  }

  has(r: RiderState, id: StatusId): boolean {
    return r.statuses.some((st) => st.id === id && st.time > 0);
  }
}

/** Can this rider act (swing, cast, collect)? */
export const active = (r: RiderState): boolean => r.mode === 'racing';

/** The rider is only striking a pose (bell, or a non-exclusive skill's cast pose): a swing or the bell may cut it. */
export function posing(ctx: CombatCtx, r: RiderState): boolean {
  const a = r.action;
  return a !== null && (a.kind === 'bell' || (a.kind === 'skill' && !ctx.skills.busy(r)));
}

/** Past the line: whatever the rider still has running moves and shows, but never scores (hits, debuffs, KOs). */
export const finished = (r: RiderState): boolean => r.mode === 'finished' || r.finishTime !== null;

/** Can this rider be hit by melee, skills or projectiles right now? */
export function targetable(ctx: CombatCtx, r: RiderState): boolean {
  return active(r) && !r.mods.intangible && !r.mods.invisible && r.invuln <= 0 && !ctx.has(r, 'gulped');
}

/** Track-space filter for rider queries: ds = other.s − self.s, dx likewise. */
export type Keep = (o: RiderState, ds: number, dx: number) => boolean;

/** Squared distances parallel to the list others() is building (keep predicates never query riders). */
const sortDist: number[] = [];

/** Riders other than `self`, nearest first, passing `keep` (insertion-sorted: no per-query scratch objects). */
export function others(ctx: CombatCtx, self: RiderState, keep: Keep): RiderState[] {
  const out: RiderState[] = [];
  sortDist.length = 0;
  for (const o of ctx.session.riders) {
    if (o === self) continue;
    const ds = o.s - self.s, dx = o.x - self.x;
    if (!keep(o, ds, dx)) continue;
    const d = ds * ds + dx * dx;
    let i = out.length;
    for (; i > 0 && (sortDist[i - 1] ?? 0) > d; i--) {
      out[i] = out[i - 1] as RiderState;
      sortDist[i] = sortDist[i - 1] ?? 0;
    }
    out[i] = o;
    sortDist[i] = d;
  }
  return out;
}

/** The nearest rider other than `self` passing `keep` (no allocation). */
export function nearest(ctx: CombatCtx, self: RiderState, keep: Keep): RiderState | undefined {
  let best: RiderState | undefined, bestD = Infinity;
  for (const o of ctx.session.riders) {
    if (o === self) continue;
    const ds = o.s - self.s, dx = o.x - self.x;
    const d = ds * ds + dx * dx;
    if (d < bestD && keep(o, ds, dx)) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** Clamp a lateral offset onto the asphalt at s (keeps a margin from the edge). */
export function clampToRoad(ctx: CombatCtx, s: number, x: number, margin = 0.8): number {
  const half = Math.max(1, ctx.session.track.bounds(s).halfWidth - margin);
  return Math.max(-half, Math.min(half, x));
}

/** Lateral distance from the centre line to the wall/drop on the side of x at s. */
export function roadEdge(ctx: CombatCtx, s: number, x: number): number {
  const b = ctx.session.track.bounds(s);
  return x >= 0 ? b.right : b.left;
}
