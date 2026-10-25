// Where the easter eggs hide (SPEC §21). The spots are seeded from the track id only, so the same egg is in the
// same place in every race on that track; the race seed only decides whether the pelican god shows up.
import { hashString } from '../../core/rng';
import type { Track } from '../../core/contracts';
import type { TrackFeature } from '../../core/types';
import { DUCK, EASEL } from './tuning';

export interface Spot {
  s: number;        // m along the track
  x: number;        // m from the centre line (+ = right)
  side: -1 | 1;     // which side of the road it sits on
}

/** A seeded number in [lo, hi) from a string key (never Math.random: the egg must stay put). */
export function seededRange(key: string, lo: number, hi: number): number {
  return lo + (hashString(key) / 0x100000000) * (hi - lo);
}

/** The s of an egg, nudged forward until it is not on a bridge, in a tunnel or on a ramp. */
function clearSpot(track: Track, s: number): number {
  const blocked = (at: number): boolean => track.features.some((f) =>
    (f.kind === 'ramp' || f.kind === 'tunnel' || f.kind === 'bridge') && at > f.s0 - 4 && at < f.s1 + 4);
  let out = Math.min(Math.max(s, 5), track.length - 5);
  for (let i = 0; i < 32 && blocked(out); i++) out = out + 6 > track.length - 5 ? out - 6 : out + 6;
  return out;
}

/** A track feature of kind 'secret' with this data id (the layouts may place an egg themselves). */
function secretFeature(track: Track, id: string): TrackFeature | null {
  for (const f of track.features) if (f.kind === 'secret' && f.data?.id === id) return f;
  return null;
}

/** The rubber duck: on the asphalt near one edge, off the racing line, reachable on the bike. */
export function duckSpot(track: Track): Spot {
  const key = `duck|${track.id}`;
  const authored = secretFeature(track, 'duck');
  if (authored) {
    // The layout placed the duck itself: the middle of its stretch, on the edge of its lane.
    const s = (authored.s0 + authored.s1) / 2;
    const hw = track.frameAt(s).halfWidth;
    const off = Math.abs(authored.x0) >= Math.abs(authored.x1) ? authored.x0 : authored.x1;
    const x = Math.max(-hw + 0.4, Math.min(hw - 0.4, off));
    return { s, x, side: x < 0 ? -1 : 1 };
  }
  const s = clearSpot(track, track.length * seededRange(`${key}|s`, DUCK.sFrom, DUCK.sTo));
  const hw = track.frameAt(s).halfWidth;
  const side: -1 | 1 = hashString(`${key}|side`) % 2 === 0 ? -1 : 1;
  const inset = seededRange(`${key}|x`, DUCK.edgeIn, DUCK.edgeOut);
  return { s, x: side * Math.max(0.6, hw - inset), side };
}

/**
 * The SVG easel: past the drivable edge on the side that has a proper verge there (grass or dirt, never the
 * sea), so it stands on solid ground and cannot be ridden into.
 */
export function easelSpot(track: Track): Spot {
  const key = `svg|${track.id}`;
  const authored = secretFeature(track, 'svg');
  if (authored) {
    const s = (authored.s0 + authored.s1) / 2;
    const b = track.bounds(s);
    const side: -1 | 1 = authored.x0 < 0 ? -1 : 1;
    const bound = side > 0 ? b.right : b.left;
    return { s, x: side * (bound + EASEL.beyond), side };
  }
  const s = clearSpot(track, track.length * seededRange(`${key}|s`, EASEL.sFrom, EASEL.sTo));
  const side: -1 | 1 = vergeSide(track, s, key);
  const b = track.bounds(s);
  const bound = side > 0 ? b.right : b.left;
  return { s, x: side * (bound + EASEL.beyond), side };
}

/** The side with the better ground for a prop: grass or dirt first, then whatever the seed picks. */
function vergeSide(track: Track, s: number, key: string): -1 | 1 {
  const rank = (side: -1 | 1): number => {
    const b = track.bounds(s);
    const bound = side > 0 ? b.right : b.left;
    const surf = track.surfaceAt(s, side * Math.max(0, bound - 0.3));
    if (surf === 'grass') return 3;
    if (surf === 'dirt') return 2;
    if (surf === 'sand') return 1;
    if (surf === 'water' || surf === 'wall') return -1;
    return 0;
  };
  const left = rank(-1);
  const right = rank(1);
  if (left !== right) return left > right ? -1 : 1;
  return hashString(`${key}|side`) % 2 === 0 ? -1 : 1;
}

/** The heading of the track at s, turned towards the centre line (a prop faces the road). */
export function yawToRoad(track: Track, s: number, side: -1 | 1): number {
  const r = track.frameAt(s).right;
  const k = side > 0 ? -1 : 1;
  return Math.atan2(r.x * k, r.z * k);
}
