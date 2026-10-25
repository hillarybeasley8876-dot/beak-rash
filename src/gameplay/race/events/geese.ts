// 大鹅过马路 geese (SPEC §19): a column of seven small toon geese waddles across the road at 1.2 m/s.
// Touching one wobbles the rider for half a second and takes 20 % of their speed; the goose flaps away.
// Threading the whole flock untouched is free (the STYLE chain is wired later).
import { Group, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { Obstacle, RiderState } from '../../../core/types';
import { cone, cylinder, sphere } from '../traffic/kit';
import { trackPose } from '../pose';
import { disposeProp, PropPool } from './props';
import { freeSpot } from './spot';
import { Lifetime } from './lifetime';
import { EVENT_TUNING as T } from './tuning';
import type { EventProps, EventSetup } from './types';

const F = T.geese;

interface Goose {
  ob: Obstacle;
  dir: 1 | -1;
  phase: number;
  alive: boolean;
}

/** A small goose: white body, long neck, orange beak. Faces −Z, about 0.5 m tall. */
function gooseModel(): BufferGeometry[] {
  const white = '#f6f4ef';
  return [
    sphere(0.21, white, [0, 0.24, 0], [1, 0.82, 1.3], 10),
    sphere(0.13, '#d8d4cb', [0.16, 0.26, 0.02], [0.5, 0.7, 1.1], 8),
    cylinder(0.07, 0.1, 0.34, white, [0, 0.46, -0.13], [0.45, 0, 0], 8),
    sphere(0.12, white, [0, 0.6, -0.24], [1, 1, 1.05], 10),
    cone(0.07, 0.24, '#f59a23', [0, 0.58, -0.38], [-Math.PI / 2, 0, 0], 8),
    sphere(0.03, '#111111', [-0.09, 0.63, -0.27], [1, 1, 1], 6),
    sphere(0.03, '#111111', [0.09, 0.63, -0.27], [1, 1, 1], 6),
    cylinder(0.03, 0.03, 0.16, '#f59a23', [-0.07, 0.06, -0.02], undefined, 6),
    cylinder(0.03, 0.03, 0.16, '#f59a23', [0.07, 0.06, -0.02], undefined, 6),
  ];
}

/** The flock, waddling across the road. */
export function createGeese(setup: EventSetup): EventProps {
  const { session, s, rng, idBase } = setup;
  const { track } = session;
  const bus = session.app.bus;
  const player = session.player;
  const group = new Group();
  group.name = 'race:event:geese';
  session.world.add(group);

  const pool = new PropPool(gooseModel(), F.count, 0.02);
  group.add(pool.mesh);

  const bounds = track.bounds(s);
  const edge = Math.max(1.5, bounds.halfWidth - 0.6);
  const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const geese: Goose[] = [];
  for (let i = 0; i < F.count; i++) {
    const t = F.count > 1 ? i / (F.count - 1) : 0.5;
    const gs = s - F.spread / 2 + F.spread * t;
    // The flock starts at one edge of the road and waddles across (about 6 s), a little staggered.
    const gx = dir * (-edge + rng.range(0, 1.2));
    // A goose never appears inside a rider.
    const at = freeSpot(session, gs, gx, 0.3, 0.3) ?? gs;
    const ob: Obstacle = {
      id: idBase + i, kind: 'goose', s: at, x: gx, speed: 0,
      halfWidth: 0.3, halfLength: 0.3, height: 0.5, solid: false, active: true,
    };
    const goose: Goose = { ob, dir, phase: rng.range(0, Math.PI * 2), alive: true };
    geese.push(goose);
    session.obstacles.push(ob);
  }

  const life = new Lifetime(F.linger, s + F.spread / 2 + 12);
  const matrix = new Matrix4();
  const pos = new Vector3(), quat = new Quaternion();
  const one = new Vector3(1, 1, 1);
  let t = 0;
  let gone = false;

  const hide = (slot: number): void => {
    matrix.makeScale(0, 0, 0);
    pool.set(slot, matrix);
  };

  return {
    update(dt) {
      t += dt;
      for (let i = 0; i < geese.length; i++) {
        const g = geese[i];
        if (!g.alive) continue;
        g.ob.x += g.dir * F.speed * dt;
        if (g.ob.x > edge) { g.ob.x = edge; g.dir = -1; }
        if (g.ob.x < -edge) { g.ob.x = -edge; g.dir = 1; }
        const bob = Math.sin(t * 7.5 + g.phase) * 0.045;
        trackPose(track, g.ob.s, g.ob.x, bob, g.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0, pos, quat);
        pool.set(i, matrix.compose(pos, quat, one));
        touch(g, i, session.riders);
      }
      pool.commit();
      if (life.update(player.s, dt)) gone = true;
    },
    get done() {
      return gone;
    },
    dispose() {
      for (const g of geese) {
        g.ob.active = false;
        const i = session.obstacles.indexOf(g.ob);
        if (i >= 0) session.obstacles.splice(i, 1);
      }
      pool.dispose();
      disposeProp(group);
    },
  };

  /** A rider that runs a goose over: a wobble, 20 % of the speed and an indignant honk. */
  function touch(g: Goose, slot: number, riders: readonly RiderState[]): void {
    for (const r of riders) {
      if (r.mode !== 'racing' && r.mode !== 'finished') continue;
      if (Math.abs(r.s - g.ob.s) > F.touchS || Math.abs(r.x - g.ob.x) > F.touch) continue;
      session.physics.applyImpulse(r, { forward: -r.speed * F.speedLoss });
      if (!r.statuses.some((st) => st.id === 'wobble')) {
        r.statuses.push({ id: 'wobble', time: F.wobble, strength: 1, source: null });
      }
      bus.emit('traffic:honk', { obstacleId: g.ob.id, pos: track.toWorld(g.ob.s, g.ob.x, 0.5, new Vector3()) });
      g.alive = false;
      g.ob.active = false;
      const i = session.obstacles.indexOf(g.ob);
      if (i >= 0) session.obstacles.splice(i, 1);
      hide(slot);
      return;
    }
  }
}
