// 施工改道 roadworks (SPEC §19): a 140 m work zone where barriers close every lane but one and the open
// lane swaps sides at the half (a chicane). Cones line the closed side, a 前方施工 请绕行 sign and two
// capybara workers in hard hats stand by. The zone is cleared 20 s after the player drove past.
import { Group, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { Obstacle } from '../../../core/types';
import { ROADWORKS_SIGN } from '../../../data/event-lines';
import { box, cone, cylinder, rbox, sphere } from '../traffic/kit';
import { trackPose } from '../pose';
import { disposeProp, PropPool, propMesh, signProp } from './props';
import { spotFree } from './spot';
import { Lifetime } from './lifetime';
import { EVENT_TUNING as T } from './tuning';
import type { EventProps, EventSetup } from './types';

const F = T.roadworks;

/** One barrier unit: a stretch of red/white blocks with a jersey-barrier foot. */
function barrierModel(): BufferGeometry[] {
  const W = F.blockWidth;
  const parts: BufferGeometry[] = [box([W, 0.22, F.rowEvery], '#d8d8dd', [0, 0.11, 0])];
  const n = Math.round(F.rowEvery / 2);
  for (let i = 0; i < n; i++) {
    const z = -F.rowEvery / 2 + 1 + i * 2;
    parts.push(box([W, 0.78, 1.85], i % 2 === 0 ? '#e5191c' : '#f4f4f6', [0, 0.61, z]));
    parts.push(box([W + 0.04, 0.12, 1.85], '#0b0b0f', [0, 0.94, z]));
  }
  return parts;
}

/** A traffic cone. */
function coneModel(): BufferGeometry[] {
  return [
    box([0.44, 0.06, 0.44], '#e8622a', [0, 0.03, 0]),
    cone(0.19, 0.62, '#f59a23', [0, 0.36, 0], undefined, 10),
    cylinder(0.13, 0.16, 0.1, '#f4f4f6', [0, 0.36, 0], undefined, 10),
  ];
}

/** A capybara worker: brown barrel, boxy head, yellow hard hat and a hi-vis vest. */
function workerModel(): BufferGeometry[] {
  const fur = '#8a6a4a';
  return [
    rbox([0.72, 0.6, 1.15], fur, [0, 0.62, 0], 0.22),
    rbox([0.44, 0.38, 0.5], fur, [0, 0.86, -0.55], 0.14),
    box([0.3, 0.2, 0.16], '#6d5238', [0, 0.78, -0.82]),
    sphere(0.06, '#3a2a1a', [-0.13, 0.94, -0.72], [1, 1, 0.6], 6),
    sphere(0.06, '#3a2a1a', [0.13, 0.94, -0.72], [1, 1, 0.6], 6),
    sphere(0.08, fur, [-0.19, 1.05, -0.5], [1, 1, 0.7], 6),
    sphere(0.08, fur, [0.19, 1.05, -0.5], [1, 1, 0.7], 6),
    rbox([0.78, 0.5, 0.7], '#ff8a00', [0, 0.68, 0.05], 0.16),
    cylinder(0.24, 0.26, 0.24, '#ffd23f', [0, 1.08, -0.55], undefined, 12),
    cylinder(0.3, 0.3, 0.05, '#ffd23f', [0, 0.99, -0.55], undefined, 12),
    box([0.16, 0.3, 0.16], fur, [-0.22, 0.15, -0.3]),
    box([0.16, 0.3, 0.16], fur, [0.22, 0.15, -0.3]),
    box([0.16, 0.3, 0.16], fur, [-0.22, 0.15, 0.3]),
    box([0.16, 0.3, 0.16], fur, [0.22, 0.15, 0.3]),
  ];
}

/** The work zone: the barrier wall, the cones, the sign and the crew. */
export function createRoadworks(setup: EventSetup): EventProps {
  const { session, s, idBase } = setup;
  const { track } = session;
  const player = session.player;
  const group = new Group();
  group.name = 'race:event:roadworks';
  session.world.add(group);

  const zone0 = s - F.lead;
  const zone1 = zone0 + F.zone;
  const half = zone0 + F.zone / 2;
  const barriers = new PropPool(barrierModel(), 96, 0.03);
  const cones = new PropPool(coneModel(), 24, 0.02);
  group.add(barriers.mesh, cones.mesh);

  const obstacles: Obstacle[] = [];
  const matrix = new Matrix4();
  const pos = new Vector3(), quat = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  let nextId = idBase;

  // The open lane tapers from the right to the left across the zone (a chicane the AI can follow).
  const rows = Math.floor(F.zone / F.rowEvery) + 1;
  for (let i = 0; i < rows; i++) {
    const rowS = zone0 + i * F.rowEvery;
    const b = track.bounds(rowS);
    const hw = b.halfWidth;
    const gapW = F.gapWidth;
    const t = rows > 1 ? i / (rows - 1) : 0;
    const c = Math.min(F.laneShift, hw - F.gapInset - gapW / 2) * (1 - 2 * t);
    const gapL = c - gapW / 2;
    const gapR = c + gapW / 2;
    for (const [from, to] of [[-b.left, gapL], [gapR, b.right]] as const) {
      const run = to - from;
      if (run <= 0.05) continue;
      const n = Math.max(1, Math.ceil(run / F.blockWidth));
      const w = run / n;
      for (let k = 0; k < n; k++) {
        const x = from + w * (k + 0.5);
        // A rider standing in the way gets a hole in the wall instead of a barrier.
        if (!spotFree(session, rowS, x, F.rowEvery / 2, w / 2)) continue;
        const ob: Obstacle = {
          id: nextId++, kind: 'barrier', s: rowS, x, speed: 0,
          halfWidth: w / 2, halfLength: F.rowEvery / 2, height: F.blockHeight, solid: true, active: true,
        };
        obstacles.push(ob);
        session.obstacles.push(ob);
        trackPose(track, rowS, x, 0, 0, 0, pos, quat);
        scale.set(w / F.blockWidth, 1, 1);
        const slot = barriers.alloc();
        if (slot >= 0) barriers.set(slot, matrix.compose(pos, quat, scale));
      }
    }
    // A cone marks the edge of the open lane.
    trackPose(track, rowS, gapL + 0.45, 0, 0, 0, pos, quat);
    scale.set(1, 1, 1);
    const cslot = cones.alloc();
    if (cslot >= 0) cones.set(cslot, matrix.compose(pos, quat, scale));
  }
  barriers.commit();
  cones.commit();

  // The sign at the head of the zone, on the closed side, and the crew waving at the drivers.
  const head = track.bounds(zone0 + 4);
  const signX = zone0 + 4 < half ? -head.left + 0.9 : head.right - 0.9;
  const sign = signProp(ROADWORKS_SIGN, 2.6, 0.9, 1.6);
  trackPose(track, zone0 + 4, signX, 2.3, 0, 0, pos, quat);
  sign.position.copy(pos);
  sign.quaternion.copy(quat);
  group.add(sign);

  const workers: Group[] = [];
  for (const at of [zone0 + 22, half + 16]) {
    const wb = track.bounds(at);
    const w = new Group();
    const body = propMesh(workerModel(), 0.03);
    body.position.y = 0;
    w.add(body);
    const wx = at < half ? -wb.left + 1.1 : wb.right - 1.1;
    trackPose(track, at, wx, 0, 0, 0, pos, quat);
    w.position.copy(pos);
    w.quaternion.copy(quat);
    group.add(w);
    workers.push(w);
  }

  const life = new Lifetime(F.linger, zone1 + 15);
  let t = 0;
  let gone = false;
  return {
    update(dt) {
      t += dt;
      // The crew waves the drivers on.
      for (let i = 0; i < workers.length; i++) {
        const w = workers[i];
        if (w) w.rotation.y = Math.sin(t * 2.6 + i * 1.7) * 0.22;
      }
      if (life.update(player.s, dt)) gone = true;
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
      barriers.dispose();
      cones.dispose();
      const tex = sign.userData.texture as { dispose(): void } | undefined;
      const mat = sign.userData.signMaterial as { dispose(): void } | undefined;
      tex?.dispose();
      mat?.dispose();
      disposeProp(group);
    },
  };
}
