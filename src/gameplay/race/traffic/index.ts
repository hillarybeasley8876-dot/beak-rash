// Traffic manager: spawns/despawns vehicles around the player, drives them, keeps session.obstacles in
// sync (physics collides with them), honks, and poses the instanced meshes after each substep.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { BILLBOARD_LINES } from '../../../data/memes';
import type { Session } from '../../../core/contracts';
import type { RiderState } from '../../../core/types';
import { trackPose } from '../pose';
import { blinkers, driveVehicle, laneX, startLaneChange, type Surroundings, type Vehicle } from './driver';
import { MAX_VEHICLES, TrafficRender } from './render';
import { AHEAD_NEAR, aheadFar, BASE_WINDOW, BEHIND, chooseSpot, spotIsFree, START_CLEAR, type SpawnSpot, type SpawnWorld } from './spawner';

const SPAWN_EVERY = 0.25;
const SPAWN_BAND = 50;         // m: new vehicles appear in [far, far + band] ahead of the player
const FOG_PUSH = 60;           // m: a spawn may move this far past `far` so a curve cannot bring it into clear view
const AUDIBLE = 80;            // m from the player for honks to be worth an event

export interface Traffic {
  preStep(dt: number): void;
  /** Pose the meshes from the current state (after each sim substep). */
  sync(): void;
  summary(): Array<Record<string, unknown>>;
  dispose(): void;
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
  const world: SpawnWorld = { length: track.length, halfWidth, riders: session.riders, vehicles };
  let nextId = 1000;
  let spawnT = 0;
  let time = 0;

  const spawn = (spot: SpawnSpot): void => {
    const slots = render.alloc(spot.def.type, spot.color);
    if (!slots) return;
    const ob = {
      id: nextId++, kind: spot.def.kind, s: spot.s, x: laneX(spot.lane, halfWidth(spot.s)), speed: spot.dir * spot.cruise,
      halfWidth: spot.def.width / 2, halfLength: spot.def.length / 2, height: spot.def.height, solid: true, active: true,
    };
    vehicles.push({
      def: spot.def, ob, dir: spot.dir, color: spot.color, lane: spot.lane, fromLane: spot.lane, laneT: 1, blinkT: 0,
      cruise: spot.cruise, speed: spot.cruise, braking: false, hazard: 0, honkCd: rng.range(0, 2),
      laneCd: rng.range(6, 25), wheelDist: 0, vxl: 0, slot: slots[0], g: slots[1],
    });
    session.obstacles.push(ob);
  };

  const despawn = (i: number): void => {
    const v = vehicles[i];
    if (!v) return;
    render.free(v.def.type, v.slot, v.g);
    const k = session.obstacles.indexOf(v.ob);
    if (k >= 0) session.obstacles.splice(k, 1);
    vehicles.splice(i, 1);
  };

  const fill = (): void => {
    const p = session.player;
    for (let tries = 0; tries < target * 6 && vehicles.length < target; tries++) {
      const spot = chooseSpot(world, rng, Math.max(START_CLEAR, p.s + AHEAD_NEAR + 120), p.s + far + SPAWN_BAND);
      if (spot) spawn(spot);
    }
  };

  const here = new Vector3(), there = new Vector3();
  /**
   * First s ≥ `far` ahead of the player that is also `far` away in a straight line (on a curve the road comes
   * closer than its length); null when even FOG_PUSH m more is not enough (try again on a later tick).
   */
  const fogStart = (p: RiderState): number | null => {
    track.toWorld(p.s, p.x, 0, here);
    for (let s = p.s + far; s <= p.s + far + FOG_PUSH; s += 10) {
      if (track.toWorld(Math.min(s, track.length), 0, 0, there).distanceTo(here) >= far) return s;
    }
    return null;
  };

  const manage = (): void => {
    const p = session.player;
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i] as Vehicle;
      const ds = v.ob.s - p.s;
      if (ds < -BEHIND - 10 || ds > far + FOG_PUSH + SPAWN_BAND + 20 || v.ob.s < 5 || (v.dir > 0 && v.ob.s > track.length - 25)) despawn(i);
    }
    if (vehicles.length >= target) return;
    const s0 = fogStart(p);
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
    for (const r of session.riders) {
      if (Math.abs(r.x - v.ob.x) > v.ob.halfWidth + 1.1) continue;
      const gap = (r.s - v.ob.s) * v.dir - v.def.length / 2 - 0.9;
      if (gap < -0.5 || gap > 40) continue;
      const along = r.speed * v.dir;
      const stopped = r.mode === 'crashed' || r.mode === 'busted' || along < 2;
      if (v.dir > 0 && (stopped || along < v.speed) && gap < out.leaderGap) { out.leaderGap = gap; out.leaderSpeed = Math.max(0, along); }
      if (gap < 16 && Math.abs(r.s - session.player.s) < AUDIBLE) out.riderAhead = r;
    }
    return out;
  };

  const maybeChangeLane = (v: Vehicle, env: Surroundings): void => {
    if (v.laneT < 1 || v.hazard > 0 || halfWidth(v.ob.s) < 5.6) return;
    const blocked = env.leaderGap < 30 && env.leaderSpeed < v.cruise - 1.5;
    if (!blocked && v.laneCd > 0) return;
    v.laneCd = rng.range(12, 30);
    const to = v.dir * (Math.abs(v.lane) === 1 ? 2 : 1);
    if (spotIsFree({ ...world, riders: nearRiders(v) }, v.ob.s + v.dir * 4, to, v.def.length / 2 - 8)) startLaneChange(v, to);
  };

  const nearRiders = (v: Vehicle): RiderState[] => session.riders.filter((r) => Math.abs(r.s - v.ob.s) < 30);

  const env: Surroundings = { leaderGap: Infinity, leaderSpeed: 0, riderAhead: null };
  const pos = new Vector3(), quat = new Quaternion(), one = new Vector3(1, 1, 1), body = new Matrix4();

  const offHit = app.bus.on('rider:obstacleHit', ({ obstacleId }) => {
    const v = vehicles.find((o) => o.ob.id === obstacleId);
    if (v) v.hazard = 3.5;
  });

  fill();

  return {
    preStep(dt) {
      time += dt;
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = SPAWN_EVERY; manage(); }
      for (const v of vehicles) {
        surroundings(v, env);
        maybeChangeLane(v, env);
        if (driveVehicle(v, env, halfWidth(v.ob.s), dt, rng)) {
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
      v: +v.speed.toFixed(1), braking: v.braking, hazard: v.hazard > 0,
    })),
    dispose() {
      offHit();
      for (let i = vehicles.length - 1; i >= 0; i--) despawn(i);
      render.dispose();
    },
  };
}
