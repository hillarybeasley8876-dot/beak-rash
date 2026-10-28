// 水果摊 stalls (SPEC §19): three or four market stalls stand on the edge of the road with their fruit
// boxes and awnings. A rider who runs into one above 6 m/s smashes it: 15 % of the speed, fruit in the
// air, a few coins and an indignant sloth shouting about his watermelons.
import { Group, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { Obstacle, RiderState } from '../../../core/types';
import { STALL_LINES } from '../../../data/event-lines';
import { box, cone, rbox, sphere } from '../traffic/kit';
import { trackPose } from '../pose';
import { trailingS } from '../humans';
import { disposeProp, PropPool, propMesh } from './props';
import { freeSpot } from './spot';
import { Lifetime } from './lifetime';
import { EVENT_TUNING as T } from './tuning';
import type { EventProps, EventSetup } from './types';

const F = T.stalls;

interface Stall {
  ob: Obstacle;
  group: Group;
  smashed: boolean;
}

/** A market stall: a table with fruit crates under a striped awning. */
function stallModel(): BufferGeometry[] {
  const parts: BufferGeometry[] = [
    box([1.3, 0.12, 1.0], '#b06a3b', [0, 0.92, 0]),
    box([1.5, 0.1, 1.2], '#e5191c', [0, 2.02, 0]),
    box([1.52, 0.14, 0.14], '#f4f4f6', [0, 1.9, 0.6]),
  ];
  for (const x of [-0.58, 0.58]) {
    for (const z of [-0.42, 0.42]) parts.push(box([0.09, 1.1, 0.09], '#8a8a92', [x, 1.5, z]));
    parts.push(box([0.12, 0.88, 0.12], '#7a4a28', [x, 0.45, 0]));
  }
  parts.push(box([0.52, 0.28, 0.62], '#c98a4b', [-0.3, 1.12, 0]));
  parts.push(box([0.52, 0.28, 0.62], '#c98a4b', [0.32, 1.12, 0.05]));
  parts.push(sphere(0.14, '#f7b733', [-0.38, 1.33, -0.1], [1, 0.9, 1.1], 8));
  parts.push(sphere(0.14, '#6fbf4a', [-0.2, 1.33, 0.08], [1, 0.9, 1.1], 8));
  parts.push(sphere(0.14, '#e8604a', [0.26, 1.33, -0.05], [1, 0.9, 1.1], 8));
  parts.push(sphere(0.14, '#f7b733', [0.42, 1.33, 0.1], [1, 0.9, 1.1], 8));
  return parts;
}

/** The stall owner: a shaggy sloth in an apron. */
function slothModel(): BufferGeometry[] {
  const fur = '#7a5c3a';
  return [
    rbox([0.58, 0.8, 0.62], fur, [0, 0.78, 0], 0.22),
    rbox([0.44, 0.38, 0.42], '#8a6a45', [0, 1.3, -0.08], 0.14),
    sphere(0.1, '#3a2a1a', [-0.12, 1.32, -0.28], [1.2, 0.8, 0.5], 6),
    sphere(0.1, '#3a2a1a', [0.12, 1.32, -0.28], [1.2, 0.8, 0.5], 6),
    box([0.24, 0.05, 0.05], '#5a4028', [0, 1.2, -0.3]),
    box([0.5, 0.5, 0.06], '#3fbf8f', [0, 0.72, -0.3]),
    cone(0.09, 0.7, fur, [-0.36, 0.8, -0.05], [0, 0, 0.12], 8),
    cone(0.09, 0.7, fur, [0.36, 0.8, -0.05], [0, 0, -0.12], 8),
  ];
}

/** The fruit that flies when a stall is smashed. */
function debrisModel(): BufferGeometry[] {
  return [
    box([0.26, 0.26, 0.26], '#c98a4b', [0, 0, 0]),
    sphere(0.13, '#f7b733', [0.22, 0.06, 0.1], [1, 0.9, 1.1], 8),
    sphere(0.12, '#6fbf4a', [-0.2, -0.05, 0.16], [1, 0.9, 1.1], 8),
  ];
}

interface Piece {
  s: number;
  x: number;
  y: number;
  vs: number;
  vx: number;
  vy: number;
  spin: number;
  life: number;
}

/** The market: the stalls on the road edge and their sloth owners. */
export function createStalls(setup: EventSetup): EventProps {
  const { session, s, rng, idBase } = setup;
  const { track } = session;
  const bus = session.app.bus;
  const group = new Group();
  group.name = 'race:event:stalls';
  session.world.add(group);

  const count = rng.int(F.count[0], F.count[1]);
  const side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const stalls: Stall[] = [];
  const obstacles: Obstacle[] = [];
  const places: Array<{ at: number; x: number }> = [];
  const pos = new Vector3(), quat = new Quaternion();

  for (let i = 0; i < count; i++) {
    const ss = s + i * 6.5;
    const b = track.bounds(ss);
    const x = side * (b.halfWidth - 0.7);
    // A stall never appears inside a rider.
    const at = freeSpot(session, ss, x, F.length / 2, F.width / 2) ?? ss;
    places.push({ at, x });
  }
  // The market keeps its order along the road (the stalls are listed from the near one to the far one).
  places.sort((a, c) => a.at - c.at);
  for (let i = 0; i < places.length; i++) {
    const { at, x } = places[i];
    const g = new Group();
    g.add(propMesh(stallModel(), 0.03));
    const owner = propMesh(slothModel(), 0.03);
    owner.position.set(side * 1.15, 0, 0.25);
    g.add(owner);
    trackPose(track, at, x, 0, 0, 0, pos, quat);
    g.position.copy(pos);
    g.quaternion.copy(quat);
    group.add(g);
    const ob: Obstacle = {
      id: idBase + i, kind: 'stall', s: at, x, speed: 0,
      halfWidth: F.width / 2, halfLength: F.length / 2, height: F.height, solid: false, active: true,
    };
    obstacles.push(ob);
    session.obstacles.push(ob);
    stalls.push({ ob, group: g, smashed: false });
  }

  const debris = new PropPool(debrisModel(), 18, 0.02);
  group.add(debris.mesh);
  const pieces: Piece[] = [];
  const matrix = new Matrix4();
  const scale = new Vector3(1, 1, 1);
  const life = new Lifetime(F.linger, s + count * 6.5 + 12);
  let gone = false;

  const smash = (stall: Stall, r: RiderState): void => {
    stall.smashed = true;
    session.physics.applyImpulse(r, { forward: -r.speed * F.speedLoss });
    // The owner shouts while his stall is still there (the HUD anchors the bubble on the obstacle).
    bus.emit('npc:say', { obstacleId: stall.ob.id, character: 'sloth', text: rng.pick(STALL_LINES) });
    stall.ob.active = false;
    stall.group.visible = false;
    const coins = rng.int(F.coins[0], F.coins[1]);
    for (let i = 0; i < coins; i++) {
      bus.emit('pickup:spawn', { kind: 'coin', s: stall.ob.s + rng.range(-1.2, 1.2), x: stall.ob.x + rng.range(-1.2, 1.2) });
    }
    if (rng.chance(F.crateChance)) {
      bus.emit('pickup:spawn', { kind: 'crate', s: stall.ob.s + 1, x: stall.ob.x + side * 0.8 });
    }
    for (let i = 0; i < 6 && pieces.length < 18; i++) {
      pieces.push({
        s: stall.ob.s + rng.range(-0.4, 0.4), x: stall.ob.x + rng.range(-0.5, 0.5), y: 1.1,
        vs: rng.range(-3, 5), vx: rng.range(-3, 3), vy: rng.range(2, 5), spin: rng.range(-6, 6), life: 1.2,
      });
    }
  };

  return {
    update(dt) {
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        if (!p) continue;
        p.life -= dt;
        p.vy -= 12 * dt;
        p.s += p.vs * dt;
        p.x += p.vx * dt;
        p.y = Math.max(0.1, p.y + p.vy * dt);
        if (p.life <= 0) pieces.splice(i, 1);
      }
      // The fruit is drawn again every frame: the pool starts over, so only the pieces in the air show.
      debris.reset();
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (!p) continue;
        trackPose(track, p.s, p.x, p.y, 0, p.spin, pos, quat);
        const slot = debris.alloc();
        if (slot >= 0) debris.set(slot, matrix.compose(pos, quat, scale));
      }
      debris.commit();
      for (const stall of stalls) {
        if (stall.smashed) continue;
        for (const r of session.riders) {
          // A rider sliding through at speed takes the stall with them, wrecked or not.
          if (r.speed <= F.smashSpeed) continue;
          if (Math.abs(r.s - stall.ob.s) > stall.ob.halfLength + 0.5) continue;
          if (Math.abs(r.x - stall.ob.x) > stall.ob.halfWidth + 0.45) continue;
          smash(stall, r);
          break;
        }
      }
      if (life.update(trailingS(session), dt)) gone = true;
    },
    get done() {
      return gone;
    },
    dispose() {
      for (const ob of obstacles) {
        ob.active = false;
        const i = session.obstacles.indexOf(ob);
        if (i >= 0) session.obstacles.splice(i, 1);
      }
      debris.dispose();
      disposeProp(group);
    },
  };
}
