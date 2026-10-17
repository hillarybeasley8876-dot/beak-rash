// Where and what traffic appears: ahead of the player (deep in the fog, so nothing pops in), both
// directions, never inside riders or other vehicles, never on the start straight or the finish run.
import type { Rng } from '../../../core/rng';
import type { RiderState } from '../../../core/types';
import { laneX, type Vehicle } from './driver';
import { VEHICLES, VEHICLE_TYPES, type VehicleDef, type VehicleType } from './types';

export const START_CLEAR = 190;      // no traffic before this s (grid, start gantry, intro)
export const AHEAD_NEAR = 40;        // m: initial fill starts this far (+120) ahead of the player
export const BEHIND = 60;
const MIN_FAR = 400;
const FOG_SHARE = 0.75;              // new vehicles appear at 3/4 of the fog distance (mostly fogged)
export const BASE_WINDOW = MIN_FAR + BEHIND;   // the window the level densities were tuned for

/** Farthest spawn distance ahead of the player for a track whose fog ends at `fogFar` m. */
export const aheadFar = (fogFar: number): number => Math.max(MIN_FAR, FOG_SHARE * fogFar);

export interface SpawnSpot {
  def: VehicleDef;
  s: number;
  lane: number;
  dir: 1 | -1;
  color: string;
  cruise: number;
}

export function pickType(rng: Rng): VehicleType {
  const total = VEHICLE_TYPES.reduce((a, t) => a + VEHICLES[t].weight, 0);
  let roll = rng.next() * total;
  for (const t of VEHICLE_TYPES) {
    roll -= VEHICLES[t].weight;
    if (roll <= 0) return t;
  }
  return 'compact';
}

export interface SpawnWorld {
  length: number;
  halfWidth(s: number): number;
  riders: readonly RiderState[];
  vehicles: readonly Vehicle[];
}

/** True when a vehicle of half-length `hl` at (s, lane) keeps clear of riders and other vehicles. */
export function spotIsFree(w: SpawnWorld, s: number, lane: number, hl: number): boolean {
  const x = laneX(lane, w.halfWidth(s));
  for (const r of w.riders) {
    const ds = Math.abs(r.s - s);
    if (ds < hl + 14 && (Math.abs(r.x - x) < 3.2 || ds < hl + 4)) return false;
  }
  for (const v of w.vehicles) {
    if (Math.sign(v.lane) !== Math.sign(lane)) continue;
    if (Math.abs(v.ob.s - s) < v.def.length / 2 + hl + 18) return false;
  }
  return true;
}

/** Choose a spawn spot in [s0, s1]; null when nothing fits this time. */
export function chooseSpot(w: SpawnWorld, rng: Rng, s0: number, s1: number): SpawnSpot | null {
  const def = VEHICLES[pickType(rng)];
  const dir: 1 | -1 = rng.next() < 0.62 ? 1 : -1;
  const s = rng.range(s0, s1);
  const maxS = dir > 0 ? w.length - 320 : w.length - 150;
  if (s < START_CLEAR || s > maxS) return null;
  const wide = w.halfWidth(s) >= 5.6;
  const lane = dir * (wide && rng.next() < 0.5 ? 2 : 1);
  if (!spotIsFree(w, s, lane, def.length / 2)) return null;
  return {
    def, s, lane, dir,
    color: rng.pick(def.palette),
    cruise: rng.range(def.speed[0], def.speed[1]),
  };
}
