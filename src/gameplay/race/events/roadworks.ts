// 施工改道 roadworks (SPEC §19): a 140 m work zone where barriers close every lane but one and the open
// lane swaps sides at the half (a chicane). The wall is built from short pieces on one grid along the road:
// every piece is posed with trackPose at its own centre, so it follows the curves and the slopes, and the
// pieces leave a small gap instead of butting into each other (butted ends overlapped on every bend and
// their coplanar faces flickered). Cones line the closed side, a 前方施工 请绕行 sign and two capybara
// workers in hard hats stand by. The zone is cleared 20 s after the player drove past.
import { Group, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { Session } from '../../../core/contracts';
import type { Obstacle } from '../../../core/types';
import { ROADWORKS_SIGN } from '../../../data/event-lines';
import { box, cone, cylinder, rbox, sphere } from '../traffic/kit';
import type { ZonePiece } from '../traffic/blocks';
import { trackPose } from '../pose';
import { trailingS } from '../humans';
import type { WorkZone } from '../ctx';
import { disposeProp, PropPool, propMesh, signProp } from './props';
import { spotFree, clearOfTraffic } from './spot';
import { Lifetime } from './lifetime';
import { EVENT_TUNING as T } from './tuning';
import type { EventProps, EventSetup } from './types';

const F = T.roadworks;

/** The sign board and its post (the board's height and the post's length, in metres). */
const SIGN_H = 0.9;
const SIGN_POST = 1.6;
/** m of extra room a held-back piece needs around it (riders coming up to it included) before it goes up. */
const DEFER_CLEAR = 3;

/** The centre of the open lane at `at`: it tapers from the right side of the road to the left one. */
function bandCentre(session: Session, zone0: number, at: number): number {
  const b = session.track.bounds(at);
  const t = Math.max(0, Math.min(1, (at - zone0) / F.zone));
  const shift = Math.min(F.laneShift, b.halfWidth - F.gapInset - F.gapWidth / 2);
  return shift * (1 - 2 * t);
}

/**
 * The open lane of the work zone: the AI is told about it when the zone is announced, so it rides the lane
 * instead of the racing line (the wall goes up 60 m later, and the closed side is a dead end).
 */
export function roadworksLane(session: Session, s: number): WorkZone {
  const zone0 = s - F.lead;
  return {
    s0: zone0,
    s1: zone0 + F.zone,
    half: F.gapWidth / 2,
    centre: (at: number) => bandCentre(session, zone0, at),
  };
}

/** The grid the wall stands on: the pitch of its rows and how many rows the zone holds. */
function wallGrid(): { pitch: number; rows: number } {
  const pitch = F.pieceLength + F.pieceGap;
  return { pitch, rows: Math.ceil((F.zone + F.pieceLength / 2) / pitch) };
}

/**
 * How far the work zone reaches around the event's spot (metres, before and after it). This is the REAL
 * extent of the pieces the zone builds — the whole grid of the wall, the taper at its head and the pieces
 * that are held back for a car included — so a spot can be planned clear of a jump's run-up (plan.ts).
 */
export function roadworksSpan(): { before: number; after: number } {
  const { pitch, rows } = wallGrid();
  const half = F.pieceLength / 2;
  return { before: F.lead + half, after: (rows - 1) * pitch + half - F.lead };
}

/**
 * The pieces of the work-zone wall. The traffic has to know them before the wall goes up: the cars merge
 * into the open lane while the zone is still only announced, so none of them is caught in a closed lane
 * when the barriers appear.
 */
export function roadworksPieces(session: Session, s: number): ZonePiece[] {
  const zone0 = s - F.lead;
  const { pitch, rows } = wallGrid();
  const pieces: ZonePiece[] = [];
  for (let i = 0; i < rows; i++) {
    const rowS = zone0 + i * pitch;
    const b = session.track.bounds(rowS);
    const c = bandCentre(session, zone0, rowS);
    const gapL = c - F.gapWidth / 2;
    const gapR = c + F.gapWidth / 2;
    for (const [from, to] of [[-b.left, gapL], [gapR, b.right]] as const) {
      const run = to - from;
      if (run <= 0.05) continue;
      const n = Math.max(1, Math.ceil(run / F.pieceWidth));
      const w = run / n;
      for (let k = 0; k < n; k++) {
        pieces.push({ s: rowS, x: from + w * (k + 0.5), w, halfLength: F.pieceLength / 2 });
      }
    }
  }
  return pieces;
}

/** One barrier piece: a short red/white block on a jersey foot, `pieceLength` long and `pieceWidth` wide. */
function barrierModel(): BufferGeometry[] {
  const W = F.pieceWidth, L = F.pieceLength, H = F.blockHeight;
  const foot = 0.2;
  const n = Math.max(2, Math.round(L / 1.05));
  const seg = L / n;
  const parts: BufferGeometry[] = [box([W, foot, L], '#d8d8dd', [0, foot / 2 + F.base, 0])];
  for (let i = 0; i < n; i++) {
    const z = -L / 2 + seg * (i + 0.5);
    parts.push(box([W, H - foot, seg * 0.9], i % 2 === 0 ? '#e5191c' : '#f4f4f6', [0, foot + (H - foot) / 2 + F.base, z]));
    // a concrete-grey cap: from the chase camera a black top read as a hole in the road
    parts.push(box([W + 0.05, 0.12, seg * 0.9], '#b9bcc4', [0, H + 0.06 + F.base, z]));
  }
  return parts;
}

/** A traffic cone. Its foot never touches the asphalt: a face flush with the road z-fights with it. */
function coneModel(): BufferGeometry[] {
  return [
    box([0.44, 0.06, 0.44], '#e8622a', [0, 0.03 + F.base, 0]),
    cone(0.19, 0.62, '#f59a23', [0, 0.36 + F.base, 0], undefined, 10),
    cylinder(0.13, 0.16, 0.1, '#f4f4f6', [0, 0.36 + F.base, 0], undefined, 10),
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
  const group = new Group();
  group.name = 'race:event:roadworks';
  session.world.add(group);

  const zone0 = s - F.lead;
  const zone1 = zone0 + F.zone;
  const half = zone0 + F.zone / 2;
  // One grid of short pieces along the road: every piece leaves a small gap to the next one.
  const { pitch, rows } = wallGrid();
  const coneRows = Math.max(1, Math.round(F.coneEvery / pitch));
  const barriers = new PropPool(barrierModel(), F.pieceCap, 0.03);
  const cones = new PropPool(coneModel(), F.coneCap, 0.02);
  group.add(barriers.mesh, cones.mesh);

  const obstacles: Obstacle[] = [];
  const matrix = new Matrix4();
  const pos = new Vector3(), quat = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  let nextId = idBase;

  // The cars that are on the road when the wall goes up keep their road: the pieces under them and the
  // ones on their way out of the zone go up later, behind them (a car must never end up in a dead end).
  const cars = setup.traffic?.carsIn(zone0, zone1) ?? [];
  const pieces = roadworksPieces(session, s);
  const deferred = new Map<ZonePiece, number>();
  for (const car of cars) {
    for (const piece of pieces) {
      const ahead = (piece.s - car.s) * car.dir;
      const inLane = Math.abs(car.x - piece.x) < car.halfWidth + piece.w / 2;
      const onPiece = Math.abs(car.s - piece.s) < car.halfLength + piece.halfLength && inLane;
      const onPath = ahead > 0 && ahead < F.zone && inLane;
      if (onPiece || onPath) deferred.set(piece, car.id);
    }
  }

  const putUp = (piece: ZonePiece): void => {
    const ob: Obstacle = {
      id: nextId++, kind: 'barrier', s: piece.s, x: piece.x, speed: 0,
      halfWidth: piece.w / 2, halfLength: piece.halfLength, height: F.blockHeight, solid: true, active: true,
    };
    obstacles.push(ob);
    session.obstacles.push(ob);
    trackPose(track, piece.s, piece.x, 0, 0, 0, pos, quat);
    scale.set(piece.w / F.pieceWidth, 1, 1);
    const slot = barriers.alloc();
    if (slot >= 0) barriers.set(slot, matrix.compose(pos, quat, scale));
  };

  for (let i = 0; i < rows; i++) {
    const rowS = zone0 + i * pitch;
    const c = bandCentre(session, zone0, rowS);
    const gapL = c - F.gapWidth / 2;
    for (const piece of pieces) {
      if (piece.s !== rowS) continue;
      if (deferred.has(piece)) continue;
      // A rider standing in the way gets a hole in the wall instead of a barrier.
      if (!spotFree(session, piece.s, piece.x, piece.halfLength, piece.w / 2)) continue;
      // A car that is already on that piece of road keeps it: the wall goes up around it.
      if (!clearOfTraffic(session, piece.s, piece.x, piece.halfLength, piece.w / 2)) continue;
      putUp(piece);
    }
    // A cone marks the edge of the open lane.
    if (i % coneRows === 0) {
      trackPose(track, rowS, gapL + 0.45, 0, 0, 0, pos, quat);
      scale.set(1, 1, 1);
      const cslot = cones.alloc();
      if (cslot >= 0) cones.set(cslot, matrix.compose(pos, quat, scale));
    }
  }
  barriers.commit();
  cones.commit();

  // The sign in front of the zone, on the driver's side, and the crew waving at the drivers.
  const head = track.bounds(zone0 - 6);
  const sign = signProp(ROADWORKS_SIGN, 2.6, SIGN_H, SIGN_POST);
  trackPose(track, zone0 - 6, head.right - 1.2, SIGN_H / 2 + SIGN_POST + F.base, 0, 0, pos, quat);
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
    // The crew stands on the verge, behind the wall: the road itself is closed.
    const wx = at < half ? -(wb.left + 1.4) : wb.right + 1.4;
    trackPose(track, at, wx, F.base, 0, 0, pos, quat);
    w.position.copy(pos);
    w.quaternion.copy(quat);
    group.add(w);
    workers.push(w);
  }

  const life = new Lifetime(F.linger, zone1 + 15);
  let t = 0;
  let gone = false;
  /** Has the car that holds a piece back left the zone (or is it gone)? */
  const carLeft = (carId: number): boolean => {
    const ob = session.obstacles.find((o) => o.id === carId);
    if (!ob) return true;
    return ob.s < zone0 - 12 || ob.s > zone1 + 12;
  };
  return {
    update(dt) {
      t += dt;
      // The crew waves the drivers on.
      for (let i = 0; i < workers.length; i++) {
        const w = workers[i];
        if (w) w.rotation.y = Math.sin(t * 2.6 + i * 1.7) * 0.22;
      }
      // The pieces held back for a car go up once the car has left the zone.
      if (deferred.size) {
        for (const [piece, carId] of deferred) {
          if (!carLeft(carId)) continue;
          // ... and nobody is on that spot or about to ride into it (no wall springs up in a rider's face),
          // and no other car has driven onto it meanwhile.
          if (!spotFree(session, piece.s, piece.x, piece.halfLength + DEFER_CLEAR, piece.w / 2)) continue;
          if (!clearOfTraffic(session, piece.s, piece.x, piece.halfLength, piece.w / 2)) continue;
          deferred.delete(piece);
          putUp(piece);
        }
        barriers.commit();
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
