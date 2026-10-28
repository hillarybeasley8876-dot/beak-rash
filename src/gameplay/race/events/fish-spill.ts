// 鱼车侧翻 fishSpill (SPEC §19): a 鹈鹕海鲜 fish truck brakes and tips onto its side, blocking its lane.
// Behind it the spilled fish and coins cover two lanes and three slick patches make the fish lethal to
// grip. The wreck is cleared 25 s after the player drove past.
import { Group, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { clamp } from '../../../core/math';
import type { Obstacle } from '../../../core/types';
import { box, cone, cylinder, rbox, sphere } from '../traffic/kit';
import { trackPose } from '../pose';
import { leadingHuman, trailingS } from '../humans';
import { disposeProp, PropPool, propMesh } from './props';
import { freeSpot } from './spot';
import { Lifetime } from './lifetime';
import { EVENT_TUNING as T } from './tuning';
import type { EventProps, EventSetup } from './types';

const F = T.fishSpill;

/** The 鹈鹕海鲜 truck: a white reefer with a cartoon fish on the roof. Faces −Z, wheels on the ground. */
function truckModel(): BufferGeometry[] {
  const W = F.truckWidth, L = F.truckLength;
  const body = '#f7f8fa';
  const parts: BufferGeometry[] = [
    box([W - 0.35, 0.4, L - 0.5], '#1d1d22', [0, 0.6, 0]),
    rbox([W - 0.1, 1.95, 2.1], body, [0, 1.62, -L / 2 + 1.05], 0.3),
    box([W - 0.45, 0.8, 0.12], '#8fb6dd', [0, 2.1, -L / 2 + 0.02]),
    rbox([W, 2.45, L - 2.3], body, [0, 2.05, 1.05], 0.14),
    box([0.07, 2.1, 0.07], '#8e98a4', [0, 2.05, L / 2 - 0.05]),
    box([W - 0.3, 0.1, 0.1], '#8e98a4', [0, 2.6, L / 2 - 0.05]),
    // the fish on the roof
    sphere(1, '#8fb6dd', [0, 3.95, 0.7], [0.52, 0.58, 1.7]),
    cone(0.6, 0.85, '#5f8fc4', [0, 3.95, 2.5], [-Math.PI / 2, 0, 0]),
    cone(0.28, 0.6, '#5f8fc4', [0, 4.6, 0.7], [0, 0, 0]),
    sphere(0.16, '#ffffff', [-0.42, 4.1, -0.2]),
    sphere(0.16, '#ffffff', [0.42, 4.1, -0.2]),
    sphere(0.08, '#111111', [-0.53, 4.12, -0.26]),
    sphere(0.08, '#111111', [0.53, 4.12, -0.26]),
  ];
  for (const z of [-2.5, 1.5, 2.7]) {
    for (const x of [-(W / 2 - 0.12), W / 2 - 0.12]) {
      parts.push(cylinder(0.5, 0.5, 0.3, '#1d1d22', [x, 0.5, z], [0, 0, Math.PI / 2], 12));
      parts.push(cylinder(0.22, 0.22, 0.34, '#c9ced6', [x, 0.5, z], [0, 0, Math.PI / 2], 10));
    }
  }
  return parts;
}

/** The wrecked fish truck, the spilled coins and the slick patches. */
export function createFishSpill(setup: EventSetup): EventProps {
  const { session, s, rng, idBase } = setup;
  const { track } = session;
  const bus = session.app.bus;
  // The truck stops in the lane next to the LEADING human (it was in the way and tipped over): that human's
  // own lane stays open, the wreck blocks the lane beside it (offline: the player, the only human).
  const lead = leadingHuman(session);
  const group = new Group();
  group.name = 'race:event:fishSpill';
  session.world.add(group);

  const bounds = track.bounds(s);
  const playerX = clamp(lead ? lead.x : 0, -bounds.halfWidth + 1.4, bounds.halfWidth - 1.4);
  const side = playerX <= 0 ? -1 : 1;
  const laneX = clamp(playerX + side * F.laneGap, -bounds.halfWidth + 1.2, bounds.halfWidth - 1.2);

  const pivot = new Group();
  pivot.position.set(-F.truckWidth / 2, 0, 0);
  const body = propMesh(truckModel(), 0.05);
  body.position.set(F.truckWidth / 2, 0, 0);
  pivot.add(body);
  group.add(pivot);
  const pos = new Vector3(), quat = new Quaternion();
  const truckS = freeSpot(session, s, laneX, F.truckLength / 2, F.truckWidth / 2) ?? s;
  trackPose(track, truckS, laneX, 0, 0, 0, pos, quat);
  group.position.copy(pos);
  group.quaternion.copy(quat);

  const obstacles: Obstacle[] = [];
  // The wreck never spawns inside a rider: it stops a little further on if the spot is taken.
  const truck: Obstacle = {
    id: idBase, kind: 'truck', s: truckS, x: laneX, speed: 0,
    halfWidth: F.truckWidth / 2, halfLength: F.truckLength / 2, height: F.truckHeight, solid: true, active: true,
  };
  obstacles.push(truck);
  session.obstacles.push(truck);

  // The spill behind the truck: coins and fish over two lanes, three slick patches on the fish.
  const laneA = playerX;
  const laneB = laneX;
  const at = (i: number, n: number): number => truckS - F.pickupBack + (F.pickupSpan * (i + 0.5)) / n;
  const coins = rng.int(F.coins[0], F.coins[1]);
  for (let i = 0; i < coins; i++) {
    bus.emit('pickup:spawn', { kind: 'coin', s: at(i, coins), x: i % 2 === 0 ? laneA : laneB });
  }
  for (let i = 0; i < F.fish; i++) {
    bus.emit('pickup:spawn', { kind: 'fish', s: at(i, F.fish) - 6, x: i % 2 === 0 ? laneB : laneA });
  }
  const slicks = new PropPool([cylinder(F.oilWidth, F.oilWidth, 0.04, '#241f2e', [0, 0.02, 0], undefined, 16)], F.oil, 0.02);
  group.add(slicks.mesh);
  const matrix = new Matrix4();
  for (let i = 0; i < F.oil; i++) {
    const s2 = truckS - F.pickupBack + 8 + i * (F.pickupSpan / F.oil);
    const x = i % 2 === 0 ? laneA : laneB;
    const at = freeSpot(session, s2, x, F.oilLength / 2, F.oilWidth / 2) ?? s2;
    const ob: Obstacle = {
      id: idBase + 1 + i, kind: 'oil', s: at, x, speed: 0,
      halfWidth: F.oilWidth / 2, halfLength: F.oilLength / 2, height: 0.04, solid: false, active: true,
    };
    obstacles.push(ob);
    session.obstacles.push(ob);
    const p = new Vector3(), q = new Quaternion();
    trackPose(track, at, x, 0, 0, 0, p, q);
    slicks.set(slicks.alloc(), matrix.compose(p, q, new Vector3(1, 1, 1)));
  }
  slicks.commit();

  // The truck brakes and goes over: the roll starts when the player is close enough to watch it.
  const fall = laneX >= 0 ? -1 : 1;      // it falls away from the centre line, onto the shoulder
  const life = new Lifetime(F.linger, truckS + F.truckLength / 2 + 12);
  let tip = -1;
  let wait = 0;
  let gone = false;

  return {
    update(dt) {
      wait += dt;
      const l = leadingHuman(session);
      if (tip < 0 && ((l !== null && l.s > truckS - F.tipDist) || wait > 8)) tip = 0;
      if (tip >= 0 && tip < F.tipTime) {
        tip += dt;
        const t = Math.min(1, tip / F.tipTime);
        pivot.rotation.z = fall * (Math.PI / 2) * (t * t * (3 - 2 * t));
      }
      // The wreck is cleared when the LAST human has driven past it.
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
      disposeProp(group);
    },
  };
}
