// The roadblock (SPEC §14, ★3): solid `barrier` obstacles across the whole drivable width with
// one 3.2 m gap at a seeded lane, plus the sawhorse meshes and the 「柯基执勤 POLICE」 sign.
// It goes up 220–300 m ahead of the player (never in a tunnel or on a bridge, never too close
// to the finish) and is taken down 20 s after the player has passed it.
import { Quaternion, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { Session } from '../../../core/contracts';
import type { Obstacle } from '../../../core/types';
import { trackPose } from '../pose';
import { buildRoadblockMesh, type RoadblockMesh } from './roadblock-mesh';
import { T } from './tuning';

export interface Roadblock {
  /** Where the block stands (m along the track). */
  s: number;
  /** The centre of the gap (m to the side of the centre line). */
  gapX: number;
  gapWidth: number;
  obstacles: Obstacle[];
  mesh: RoadblockMesh;
  /** Has the player gone past it? */
  passed: boolean;
  /** s since the player passed it. */
  sincePass: number;
}

let nextBarrierId = 8000;

/** The barriers that close the road except for the gap: [{x, width}] in track space. */
function barrierPlan(left: number, right: number, gapX: number, gapWidth: number): { x: number; width: number }[] {
  const half = gapWidth / 2;
  const out: { x: number; width: number }[] = [];
  const span = (from: number, to: number): void => {
    const len = to - from;
    if (len <= 0.05) return;
    const n = Math.max(1, Math.ceil(len / T.barrierWidth));
    const w = len / n;
    for (let i = 0; i < n; i++) out.push({ x: from + w * (i + 0.5), width: w });
  };
  span(left, gapX - half);
  span(gapX + half, right);
  return out;
}

/** Is this stretch of road inside a tunnel or on a bridge? */
function blocked(track: Session['track'], s: number): boolean {
  return track.features.some((f) => (f.kind === 'tunnel' || f.kind === 'bridge') && s > f.s0 - 5 && s < f.s1 + 5);
}

/** Put a block up ahead of the player; null when the road does not allow one. */
export function placeRoadblock(session: Session, rng: Rng): Roadblock | null {
  const { track, player } = session;
  for (let attempt = 0; attempt < 5; attempt++) {
    const ahead = rng.range(T.aheadMin, T.aheadMax);
    const s = player.s + ahead;
    if (s > track.length - T.finishMargin) continue;
    if (blocked(track, s)) continue;
    const b = track.bounds(s);
    // bounds() gives the drivable extent as two positive widths: the road runs from -left to +right.
    const left = -b.left, right = b.right;
    const half = T.gapWidth / 2;
    const lo = left + half + 0.3;
    const hi = right - half - 0.3;
    if (hi <= lo) continue;
    const gapX = rng.range(lo, hi);
    const plan = barrierPlan(left, right, gapX, T.gapWidth);
    if (plan.length < 2) continue;
    const obstacles: Obstacle[] = plan.map((p) => ({
      id: nextBarrierId++, kind: 'barrier', s, x: p.x, speed: 0,
      halfWidth: p.width / 2, halfLength: 0.35, height: 1.05, solid: true, active: true,
    }));
    const mesh = buildRoadblockMesh(plan, gapX);
    const pos = new Vector3(), quat = new Quaternion();
    trackPose(track, s, 0, 0, 0, 0, pos, quat);
    mesh.group.position.copy(pos);
    mesh.group.quaternion.copy(quat);
    session.world.add(mesh.group);
    for (const o of obstacles) session.obstacles.push(o);
    return { s, gapX, gapWidth: T.gapWidth, obstacles, mesh, passed: false, sincePass: 0 };
  }
  return null;
}

/** Take the block down: the barriers stop blocking the road and the meshes go away. */
export function removeRoadblock(rb: Roadblock, session: Session): void {
  for (const o of rb.obstacles) {
    o.active = false;
    const i = session.obstacles.indexOf(o);
    if (i >= 0) session.obstacles.splice(i, 1);
  }
  rb.mesh.group.removeFromParent();
  rb.mesh.dispose();
}

/** Is the player in a tunnel right now? (the heat cools twice as fast there) */
export function inTunnel(session: Session): boolean {
  return session.track.features.some((f) => f.kind === 'tunnel' && session.player.s > f.s0 && session.player.s < f.s1);
}
