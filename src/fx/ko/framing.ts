// Shot choice for the KO director: a few framings per cinematic kind, scored by room (the eye stays
// inside the track bounds), occluders (no rider between the eye and the subject) and variety (never
// the same framing twice in a row). `confine` is the per-frame safety net while the shot runs.
import { Vector3 } from 'three';
import { clamp, DEG } from '../../core/math';
import { eyeAt, FIT_NDC, type ShotFraming } from './camera';
import type { Track } from '../../core/contracts';

type Kind = 'ko' | 'wrecked' | 'ult';

/** Framing template; angles in degrees, mirrored by `side`. */
export interface FramingDef {
  id: string;
  azimuth: number;
  orbit: number;
  dist: [number, number];
  height: [number, number];
  fov: [number, number];
  roll?: number;
  lookUp?: number;
  /** NDC y the subject sphere is centred on (+ = upper part of the frame). */
  bias?: number;
}

export const FRAMINGS: Record<Kind, FramingDef[]> = {
  // KO: low front three-quarter drifting out to the side · worm's-eye dolly · high 3/4 spin · side track
  // · rear three-quarter (the fallback when riders would ride into a front camera).
  ko: [
    { id: 'front34', azimuth: 30, orbit: 22, dist: [3.3, 2.6], height: [0.75, 1.0], fov: [52, 46], lookUp: 0, bias: 0.08 },
    { id: 'worm', azimuth: 22, orbit: 12, dist: [3.1, 2.5], height: [0.35, 0.45], fov: [60, 54], lookUp: 0, bias: 0.02 },
    { id: 'high', azimuth: 48, orbit: 34, dist: [3.3, 3.0], height: [3.0, 2.7], fov: [52, 47], lookUp: 0, bias: 0.1 },
    { id: 'side', azimuth: 86, orbit: 8, dist: [3.7, 3.1], height: [1.05, 1.15], fov: [50, 44], lookUp: 0, bias: 0.08 },
    { id: 'rear34', azimuth: 145, orbit: -10, dist: [3.5, 3.0], height: [1.5, 1.7], fov: [54, 48], lookUp: 0, bias: 0.06 },
  ],
  // Player wrecked: from the side with a dutch tilt; the high variant looks over a rider in the way.
  wrecked: [
    { id: 'side', azimuth: 92, orbit: -14, dist: [3.3, 2.8], height: [1.15, 1.35], fov: [56, 50], roll: 7, lookUp: 0, bias: 0.06 },
    { id: 'sideHigh', azimuth: 72, orbit: -10, dist: [3.3, 2.9], height: [2.5, 2.7], fov: [54, 48], roll: 5, lookUp: 0, bias: 0.08 },
  ],
  // SHOWTIME impact: a raised three-quarter view from behind and beside the hero victim (nearest the impact),
  // so the cluster spreads across the frame instead of stacking along the lens axis; the hero rides the
  // upper part (clear of the peak splash band) while the shot pushes in.
  ult: [
    { id: 'ult34', azimuth: 125, orbit: 7, dist: [6.6, 4.6], height: [1.8, 2.1], fov: [48, 46], lookUp: 0, bias: 0.22 },
    { id: 'ult34High', azimuth: 135, orbit: 6, dist: [7.0, 4.9], height: [2.8, 3.0], fov: [48, 46], lookUp: 0, bias: 0.22 },
  ],
};

/** SHOWTIME impact with nobody hit: a wide low shot of the impact point. */
export const ULT_WIDE: FramingDef = { id: 'wide', azimuth: 35, orbit: 16, dist: [7.0, 6.0], height: [1.6, 2.3], fov: [60, 54], lookUp: 0.6 };

/** Camera on the left (+1) or right (−1) of the subject. Heading −Z with +X right: azimuth > 0 = left. */
export function framingOf(def: FramingDef, side: 1 | -1, heading: Vector3, duration: number): ShotFraming {
  return {
    heading, duration, azimuth: side * def.azimuth * DEG, orbit: side * def.orbit * DEG,
    dist: def.dist, height: def.height, fov: def.fov, roll: def.roll === undefined ? undefined : side * def.roll * DEG, lookUp: def.lookUp,
    bias: def.bias,
  };
}

/** Default framing of a kind (sandbox replays): the first template, on the given side. */
export function shotFor(kind: Kind, heading: Vector3, cameraLeft: boolean, duration: number): ShotFraming {
  return framingOf(FRAMINGS[kind][0]!, cameraLeft ? 1 : -1, heading, duration);
}

const EDGE = 0.8; // m the eye keeps inside bounds() (wall faces sit a little inside them)

/** How far (m) a world point lies outside the drivable bounds, 0 when inside. */
function outside(track: Track, p: Vector3, hintS: number): number {
  const q = track.project(p, hintS);
  const b = track.bounds(q.s);
  return Math.max(0, q.x - (b.right - EDGE), -b.left + EDGE - q.x);
}

const HEAD_UP = 0.7; // m from the subject point to the face, for the second sight line
const SUBJECT_R = 0.8; // rough angular-size radii (m) of the subject and of another rider
const RIDER_R = 0.7;

/**
 * How badly a rider at p hides the subject seen from `eye` (angular overlap with rough body radii):
 * 2 = nearer than the subject and right over it, 1 = partly over it, 0.5 = crowding it from just behind.
 */
function blocks(p: Vector3, eye: Vector3, focus: Vector3, ab: Vector3, ap: Vector3): number {
  ab.subVectors(focus, eye);
  ap.subVectors(p, eye);
  const len = ab.length();
  const dp = ap.length();
  if (len < 1e-3 || dp < 1e-3) return 0;
  if (dp >= len) return p.distanceTo(focus) < 1.2 ? 0.5 : 0;
  const ang = Math.acos(clamp(ab.dot(ap) / (len * dp), -1, 1));
  const overlap = Math.atan(SUBJECT_R / len) + Math.atan(RIDER_R / dp);
  if (ang < overlap * 0.6) return 2;
  return ang < overlap ? 1 : 0;
}

export interface PickInput {
  kind: Kind;
  track: Track;
  /** Subject point (world), its road height and its track position. */
  focus: Vector3;
  ground: number;
  s: number;
  heading: Vector3;
  duration: number;
  /** Riders that must not stand between the eye and the subject (world body point + velocity). */
  others: Array<{ readonly pos: Vector3; readonly vel: Vector3 }>;
  /** Subject velocity (a wrecked body keeps ~70 % of its speed, so riders close in on a front camera). */
  focusVel: Vector3;
  /** Side the attacker rule prefers (+1 left / −1 right). */
  prefer: 1 | -1;
  /** Framing id used last time (variety), and a cosmetic random source. */
  avoid: string | null;
  rand: () => number;
  /** Candidate templates (default FRAMINGS[kind]). */
  defs?: FramingDef[];
  /** Radius of the subject sphere the shot will fit (the eye backs off to at least that distance). */
  fitRadius?: number;
  /** Filled with every candidate's score (debug). */
  trace?: string[];
}

/** Score every framing × side and return the best (lowest penalty) with its id. */
export function pickFraming(o: PickInput): { framing: ShotFraming; id: string } {
  const eye = new Vector3();
  const ab = new Vector3();
  const ap = new Vector3();
  const moved = new Vector3();
  const head = new Vector3();
  let best: { framing: ShotFraming; id: string; score: number } | null = null;
  for (const def of o.defs ?? FRAMINGS[o.kind]) {
    for (const side of [o.prefer, -o.prefer as 1 | -1]) {
      const framing = framingOf(def, side, o.heading, o.duration);
      const minDist = (o.fitRadius ?? 0) / ((FIT_NDC - Math.abs(def.bias ?? 0)) * Math.tan((def.fov[0] * DEG) / 2));
      let score = side === o.prefer ? 0 : 0.6;
      if (def.id === o.avoid) score += 1.5;
      let room = 0;
      let occ = 0;
      for (const t of [0, o.duration * 0.5, o.duration]) {
        eyeAt(framing, o.focus, o.ground, t, eye, minDist);
        room += 4 * outside(o.track, eye, o.s);
        // Riders drift relative to the subject while the slow-mo plays (~0.3 s of sim per real second).
        for (const r of o.others) {
          moved.subVectors(r.vel, o.focusVel).multiplyScalar(0.3 * t).add(r.pos);
          // Blocked only if the line to the head is blocked too (a high eye looks over a rider beside the victim).
          const hit = Math.min(blocks(moved, eye, o.focus, ab, ap), blocks(moved, eye, head.copy(o.focus).setY(o.focus.y + HEAD_UP), ab, ap));
          occ += hit * (t === 0 ? 3 : 1.5);
        }
      }
      score += room + occ + o.rand() * 0.8;
      o.trace?.push(`${def.id}${side > 0 ? 'L' : 'R'}:${score.toFixed(1)}(b${room.toFixed(1)},o${occ.toFixed(1)})`);
      if (!best || score < best.score) best = { framing, id: def.id, score };
    }
  }
  return best ?? { framing: shotFor(o.kind, o.heading, o.prefer > 0, o.duration), id: '' };
}

/**
 * Per-frame bounds clamp for a running shot: an eye that drifts outside the drivable bounds swings
 * toward the road at the same distance from the subject, and rises when squeezed (looks over the
 * wall), so a wall never fills the frame.
 */
export function makeConfine(track: Track, hintS: () => number): (eye: Vector3, focus: Vector3) => void {
  const out = new Vector3();
  return (eye, focus) => {
    const s0 = hintS();
    const e = track.project(eye, s0);
    const b = track.bounds(e.s);
    const lo = -b.left + EDGE;
    const hi = b.right - EDGE;
    if (e.x >= lo && e.x <= hi) return;
    const f = track.project(focus, s0);
    const x = clamp(e.x, lo, hi);
    const ds = e.s - f.s;
    const dx = e.x - f.x;
    const nx = x - f.x;
    const ns = (ds < 0 ? -1 : 1) * Math.sqrt(Math.max(0, ds * ds + dx * dx - nx * nx));
    const lift = Math.min(1.6, Math.abs(e.x - x) * 0.6);
    track.toWorld(f.s + ns, x, 0, out);
    eye.set(out.x, Math.max(eye.y, out.y + 0.35) + lift, out.z);
  };
}
