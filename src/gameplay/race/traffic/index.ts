// Traffic manager: spawns/despawns vehicles around the humans of the race (offline: the player; online: every
// member, each with its own band and one shared budget), drives them, keeps session.obstacles in
// sync (physics collides with them), honks, and poses the instanced meshes after each substep.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { BILLBOARD_LINES } from '../../../data/memes';
import type { Session } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { trackPose } from '../pose';
import { blinkers, driveVehicle, laneX, startMove, type Surroundings, type Vehicle } from './driver';
import { collectBlockers, freeBands, lowerBound, nextBlocker, type Blocker, type RoadBlockers, type ZonePiece } from './blocks';
import { MAX_VEHICLES, TrafficRender } from './render';
import { AHEAD_NEAR, aheadFar, BASE_WINDOW, BEHIND, chooseSpot, spotIsFree, START_CLEAR, type SpawnSpot, type SpawnWorld } from './spawner';

const SPAWN_EVERY = 0.25;
const SPAWN_BAND = 50;         // m: new vehicles appear in [far, far + band] ahead of the player
const FOG_PUSH = 160;          // m: a spawn may move this far past `far` so a curve cannot bring it into clear view
const AUDIBLE = 80;            // m from the player for honks to be worth an event
const MERGE_RANGE = 70;        // m: how far ahead a vehicle looks for a solid obstacle on its road
const LEAD = 24;               // m: how far ahead the open lane is measured (the lane slides sideways)
const BAND_SPLIT = 1.0;        // m: the room the two directions keep between them in the open lane
const BLOCK_REFRESH = 0.2;     // s: how often the list of solid obstacles on the road is rebuilt

export interface Traffic {
  preStep(dt: number): void;
  /** Pose the meshes from the current state (after each sim substep). */
  sync(): void;
  summary(): Array<Record<string, unknown>>;
  /**
   * A work zone is coming: its wall is not up yet, but the traffic already drives around it (the cars
   * merge into the open lane long before the barriers go up, so none of them is caught in a closed lane).
   */
  planZone(id: number, pieces: ZonePiece[]): void;
  /** The work zone is gone (its props were taken down). */
  dropZone(id: number): void;
  /** The cars that drive on the stretch of road [s0, s1]: the events must know what is on the road. */
  carsIn(s0: number, s1: number): CarInfo[];
  dispose(): void;
}

/** One car on the road, in track space. */
export interface CarInfo {
  id: number;
  s: number;
  x: number;
  /** +1 = with the race, −1 = oncoming. */
  dir: 1 | -1;
  halfWidth: number;
  halfLength: number;
}

export function createTraffic(session: Session): Traffic {
  const { app, track, config } = session;
  const rng = session.rng.fork(0x7aff1c);
  const render = new TrafficRender(rng.pick(BILLBOARD_LINES), track.look.grade.night);
  session.world.add(render.group);
  const vehicles: Vehicle[] = [];
  const far = aheadFar(track.look.fog.far);
  // Level density (7 + 3/level over the base window), kept per metre over the deeper spawn window.
  const target = Math.min(MAX_VEHICLES, Math.round(Math.min(22, 7 + 3 * (config.level - 1)) * (far + BEHIND) / BASE_WINDOW));
  const halfWidth = (s: number): number => track.bounds(s).halfWidth;
  const world: SpawnWorld = { length: track.length, halfWidth, riders: session.riders, vehicles, blocks: [] };
  let nextId = 1000;
  let spawnT = 0;
  let time = 0;
  let spawnTurn = 0;      // whose band the next spawn belongs to (the humans in turn)
  // The solid obstacles on the road that are not traffic (the work-zone wall, a crate, the tipped
  // truck): the traffic drives around them instead of through them.
  const ownIds = new Set<number>();
  // The work zones that are planned but not up yet: the traffic drives around them as if they were.
  const zones = new Map<number, Blocker[]>();
  let road: RoadBlockers = { list: [], maxHalf: 0 };
  let blockT = 0;
  const refreshRoad = (): void => {
    road = collectBlockers(session.obstacles, ownIds);
    for (const pieces of zones.values()) {
      for (const p of pieces) {
        road.list.push(p);
        if (p.halfLength > road.maxHalf) road.maxHalf = p.halfLength;
      }
    }
    road.list.sort((a, b) => a.s - b.s);
    world.blocks = road.list;
  };

  const spawn = (spot: SpawnSpot): void => {
    const slots = render.alloc(spot.def.type, spot.color);
    if (!slots) return;
    const ob = {
      id: nextId++, kind: spot.def.kind, s: spot.s, x: laneX(spot.lane, halfWidth(spot.s)), speed: spot.dir * spot.cruise,
      halfWidth: spot.def.width / 2, halfLength: spot.def.length / 2, height: spot.def.height, solid: true, active: true,
    };
    vehicles.push({
      def: spot.def, ob, dir: spot.dir, color: spot.color, lane: spot.lane, xTarget: ob.x, merging: false, hold: false,
      blinkT: 0, gap: Infinity, cruise: spot.cruise, speed: spot.cruise, braking: false, hazard: 0, honkCd: rng.range(0, 2),
      laneCd: rng.range(6, 25), wheelDist: 0, vxl: 0, slot: slots[0], g: slots[1],
    });
    ownIds.add(ob.id);
    session.obstacles.push(ob);
  };

  const despawn = (i: number): void => {
    const v = vehicles[i];
    if (!v) return;
    render.free(v.def.type, v.slot, v.g);
    const k = session.obstacles.indexOf(v.ob);
    if (k >= 0) session.obstacles.splice(k, 1);
    ownIds.delete(v.ob.id);
    vehicles.splice(i, 1);
  };

  const fill = (): void => {
    // One vehicle per human in turn (offline: the player alone), so every member of an online room gets
    // traffic around it; the budget of vehicles is shared by the whole field.
    const hs = session.humans;
    if (hs.length === 0) return;
    for (let tries = 0; tries < target * 6 && vehicles.length < target; tries++) {
      const h = hs[tries % hs.length];
      const spot = chooseSpot(world, rng, Math.max(START_CLEAR, h.s + AHEAD_NEAR + 120), h.s + far + SPAWN_BAND);
      if (spot) spawn(spot);
    }
  };

  const here = new Vector3(), there = new Vector3();

  /** Is the rider within earshot of a human (offline: of the player)? */
  const nearHuman = (r: RiderState, within: number): boolean => {
    for (const h of session.humans) {
      if (Math.abs(r.s - h.s) < within) return true;
    }
    return false;
  };
  /**
   * First s ≥ `far` ahead of the player that is also `far` away in a straight line (on a curve the road comes
   * closer than its length); null when even FOG_PUSH m more is not enough (try again on a later tick).
   */
  const fogStart = (p: RiderState): number | null => {
    track.toWorld(p.s, p.x, 0, here);
    // A curve eats the straight line: on a winding road the spot `far` away in a straight line can lie well
    // beyond `far` along the road, so the search goes up to FOG_PUSH further (a spawn is never brought closer
    // than `far`: it must stay in the fog).
    for (let s = p.s + far; s <= p.s + far + FOG_PUSH; s += 10) {
      if (track.toWorld(Math.min(s, track.length), 0, 0, there).distanceTo(here) >= far) return s;
    }
    return null;
  };

  /** Is the vehicle still in the band of some human (in front of it or just behind)? */
  const inBand = (v: Vehicle): boolean => {
    for (const h of session.humans) {
      const ds = v.ob.s - h.s;
      if (ds >= -BEHIND - 10 && ds <= far + FOG_PUSH + SPAWN_BAND + 20) return true;
    }
    return false;
  };

  const manage = (): void => {
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i] as Vehicle;
      if (!inBand(v) || v.ob.s < 5 || (v.dir > 0 && v.ob.s > track.length - 25)) despawn(i);
    }
    if (vehicles.length >= target) return;
    // One vehicle per human in turn: the traffic follows every member of the room.
    const hs = session.humans;
    if (hs.length === 0) return;
    const h = hs[spawnTurn % hs.length];
    spawnTurn++;
    const s0 = fogStart(h);
    if (s0 === null) return;
    const spot = chooseSpot(world, rng, Math.max(START_CLEAR, s0), s0 + SPAWN_BAND);
    if (spot) spawn(spot);
  };

  /** Nearest vehicle/rider ahead in v's lane, and a rider worth honking at. */
  const surroundings = (v: Vehicle, out: Surroundings): Surroundings => {
    out.leaderGap = Infinity; out.leaderSpeed = v.cruise; out.riderAhead = null;
    for (const o of vehicles) {
      if (o === v || o.dir !== v.dir || Math.abs(o.ob.x - v.ob.x) > 1.8) continue;
      const gap = (o.ob.s - v.ob.s) * v.dir - (o.def.length + v.def.length) / 2;
      if (gap > -0.5 && gap < out.leaderGap) { out.leaderGap = gap; out.leaderSpeed = o.speed; }
    }
    // A solid obstacle that is not a vehicle (the work-zone wall, a crate, the tipped-over truck) is a
    // stopped leader in the lane it covers: the vehicle brakes for it instead of driving through it.
    const list = road.list;
    const i0 = lowerBound(list, v.ob.s - 60);
    const i1 = lowerBound(list, v.ob.s + 60);
    for (let i = i0; i < i1; i++) {
      const b = list[i]!;
      if (Math.abs(b.x - v.ob.x) > v.ob.halfWidth + b.halfWidth) continue;
      const gap = (b.s - v.ob.s) * v.dir - (b.halfLength + v.def.length / 2);
      if (gap > -0.5 && gap < out.leaderGap) { out.leaderGap = gap; out.leaderSpeed = 0; }
    }
    for (const r of session.riders) {
      if (Math.abs(r.x - v.ob.x) > v.ob.halfWidth + 1.1) continue;
      const gap = (r.s - v.ob.s) * v.dir - v.def.length / 2 - 0.9;
      if (gap < -0.5 || gap > 40) continue;
      const along = r.speed * v.dir;
      const stopped = r.mode === 'crashed' || r.mode === 'busted' || along < 2;
      if (v.dir > 0 && (stopped || along < v.speed) && gap < out.leaderGap) { out.leaderGap = gap; out.leaderSpeed = Math.max(0, along); }
      if (gap < 16 && nearHuman(r, AUDIBLE)) out.riderAhead = r;
    }
    return out;
  };

  /**
   * The lateral position a vehicle holds to get around the solid obstacle ahead of it: the free lane
   * beside the obstacle (the open lane of the work zone). Null when the road ahead is clear.
   */
  const openLane = (v: Vehicle): number | null => {
    if (!nextBlocker(road, v.ob.s, v.dir, v.def.length / 2, MERGE_RANGE)) return null;
    const hw = halfWidth(v.ob.s);
    const margin = v.def.width / 2 + 0.2;
    // The free room over the stretch the vehicle still has to cross: the open lane slides sideways as
    // the road goes on, so it has to be where the *next* rows are open, not where this one is.
    let lo = -hw + margin;
    let hi = hw - margin;
    for (let d = 0; d <= LEAD; d += LEAD / 3) {
      const bands = freeBands(road, v.ob.s + v.dir * d, hw);
      if (!bands.length) return null;
      const band = nearestBand(bands, v.ob.x);
      lo = Math.max(lo, band[0] + margin);
      hi = Math.min(hi, band[1] - margin);
    }
    if (lo >= hi) return null;        // no room at all: the vehicle stops in front of the wall
    // Each direction keeps to its own side of the open lane, so the two ways never meet head on.
    const centre = (lo + hi) / 2;
    const from = v.dir > 0 ? Math.max(lo, centre + BAND_SPLIT) : lo;
    const to = v.dir > 0 ? hi : Math.min(hi, centre - BAND_SPLIT);
    if (from >= to) return (lo + hi) / 2;   // the lane is too narrow to share: keep to its middle
    return Math.max(from, Math.min(to, v.ob.x));
  };

  /** The band that holds (or is nearest to) the lateral position x. */
  const nearestBand = (bands: ReadonlyArray<readonly [number, number]>, x: number): readonly [number, number] => {
    let best = bands[0]!;
    let bestD = Infinity;
    for (const band of bands) {
      if (x >= band[0] && x <= band[1]) return band;
      const d = x < band[0] ? band[0] - x : x - band[1];
      if (d < bestD) { bestD = d; best = band; }
    }
    return best;
  };

  /** Is the lateral position `x` free of traffic and of riders for the next stretch of road? */
  const laneClear = (v: Vehicle, x: number): boolean => {
    for (const o of vehicles) {
      if (o === v || o.dir !== v.dir) continue;
      const along = (o.ob.s - v.ob.s) * v.dir;
      if (along < -4 || along > 20) continue;
      if (Math.abs(o.ob.x - x) < o.ob.halfWidth + v.ob.halfWidth + 0.8) return false;
    }
    for (const r of session.riders) {
      const along = (r.s - v.ob.s) * v.dir;
      if (along < -4 || along > 20) continue;
      if (Math.abs(r.x - x) < 2) return false;
    }
    return true;
  };

  const maybeChangeLane = (v: Vehicle, env: Surroundings): void => {
    // A solid obstacle ahead: the vehicle steers into the free lane beside it, and waits for a gap
    // (blinkers on) when the lane is not free yet.
    const open = openLane(v);
    if (open !== null) {
      if (Math.abs(open - v.ob.x) < 0.05) {
        v.hold = false;
        if (v.merging) { v.merging = false; v.xTarget = v.ob.x; }
        return;
      }
      if (laneClear(v, open)) {
        if (!v.merging) startMove(v, open, true);
        else v.xTarget = open;
        v.hold = false;
      } else {
        // The gap is not there yet: hold the line and wait for it.
        if (!v.merging) startMove(v, v.ob.x, true);
        v.hold = true;
      }
      return;
    }
    // The road ahead is clear: the ordinary traffic lane change.
    if (v.merging) { v.merging = false; v.xTarget = v.ob.x; }
    if (Math.abs(v.xTarget - v.ob.x) > 0.25 || v.hazard > 0 || halfWidth(v.ob.s) < 5.6) return;
    const blocked = env.leaderGap < 30 && env.leaderSpeed < v.cruise - 1.5;
    if (!blocked && v.laneCd > 0) return;
    v.laneCd = rng.range(12, 30);
    const to = v.dir * (Math.abs(v.lane) === 1 ? 2 : 1);
    if (spotIsFree({ ...world, riders: nearRiders(v) }, v.ob.s + v.dir * 4, to, v.def.length / 2 - 8)) {
      v.lane = to;
      startMove(v, laneX(to, halfWidth(v.ob.s)), false);
    }
  };

  const nearRiders = (v: Vehicle): RiderState[] => session.riders.filter((r) => Math.abs(r.s - v.ob.s) < 30);

  const env: Surroundings = { leaderGap: Infinity, leaderSpeed: 0, riderAhead: null };
  const pos = new Vector3(), quat = new Quaternion(), one = new Vector3(1, 1, 1), body = new Matrix4();

  const offHit = app.bus.on('rider:obstacleHit', ({ obstacleId }) => {
    const v = vehicles.find((o) => o.ob.id === obstacleId);
    if (v) v.hazard = 3.5;
  });

  refreshRoad();
  fill();

  return {
    preStep(dt) {
      time += dt;
      spawnT -= dt;
      blockT -= dt;
      if (blockT <= 0) { blockT = BLOCK_REFRESH; refreshRoad(); }
      if (spawnT <= 0) { spawnT = SPAWN_EVERY; manage(); }
      for (const v of vehicles) {
        surroundings(v, env);
        v.gap = env.leaderGap;
        maybeChangeLane(v, env);
        // A vehicle that waits for a gap and stands still shows its hazard lights.
        if (v.hold && v.speed < 0.5) v.hazard = Math.max(v.hazard, 0.4);
        if (driveVehicle(v, env, dt, rng)) {
          app.bus.emit('traffic:honk', { obstacleId: v.ob.id, pos: track.toWorld(v.ob.s, v.ob.x, 1.2, new Vector3()) });
        }
      }
    },
    sync() {
      for (const v of vehicles) {
        const yaw = Math.atan2(v.vxl, v.dir * Math.max(v.speed, 0.5));
        trackPose(track, v.ob.s, v.ob.x, 0, yaw, 0, pos, quat);
        body.compose(pos, quat, one);
        const [blinkL, blinkR] = blinkers(v, time);
        render.pose(v.def.type, v.slot, v.g, { body, wheelAngle: v.wheelDist, blinkL, blinkR, braking: v.braking || v.hazard > 0 });
      }
      render.commit();
    },
    summary: () => vehicles.map((v) => ({
      id: v.ob.id, type: v.def.type, dir: v.dir, lane: v.lane, s: Math.round(v.ob.s), x: +v.ob.x.toFixed(2),
      v: +v.speed.toFixed(1), braking: v.braking, hazard: v.hazard > 0, tx: +v.xTarget.toFixed(2),
      merging: v.merging, hold: v.hold, gap: v.gap === Infinity ? -1 : +v.gap.toFixed(1),
    })),
    planZone(id, pieces) {
      // The wall of the zone, as the traffic must see it: every piece blocks its piece of the road.
      zones.set(id, pieces.map((p) => ({
        s: p.s, x: p.x, halfWidth: p.w / 2, halfLength: p.halfLength,
      })));
      refreshRoad();
    },
    dropZone(id) {
      if (!zones.delete(id)) return;
      refreshRoad();
    },
    carsIn(s0, s1) {
      const out: CarInfo[] = [];
      for (const v of vehicles) {
        if (v.ob.s < s0 || v.ob.s > s1) continue;
        out.push({
          id: v.ob.id, s: v.ob.s, x: v.ob.x, dir: v.dir,
          halfWidth: v.ob.halfWidth, halfLength: v.ob.halfLength,
        });
      }
      return out;
    },
    dispose() {
      offHit();
      for (let i = vehicles.length - 1; i >= 0; i--) despawn(i);
      render.dispose();
    },
  };
}
