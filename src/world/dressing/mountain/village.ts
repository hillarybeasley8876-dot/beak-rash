// Sunset Pass village + race-event dressing: mountain houses facing the road, lantern strings across
// the road, lantern posts along the shore, and start / finish truss gantries hung with paper lanterns.
import { Vector3 } from 'three';
import { gantry } from '../../scenery/props/event';
import { lantern, lanternPost, lanternString } from '../../scenery/props/mountain-deco';
import { mountainHouse } from '../../scenery/props/mountain-house';
import { faceQuad } from '../../scenery/signs/boards';
import type { Dress } from '../dress';
import { lanternGantryFace } from './faces';

/** A row of houses beyond the edge on `side` (u = setback range); a second row higher up when `rows` = 2. */
export function houses(d: Dress, side: -1 | 1, s0: number, s1: number, u0 = 2.5, u1 = 5.5, rows = 2): void {
  const { place, rng, b } = d;
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let s = s0 + rng.range(4, 9); s < s1 - 5; s += rng.range(11, 15)) {
      const u = row === 0 ? rng.range(u0, u1) : rng.range(u1 + 9, u1 + 16);
      const sp = place.spot(s, side, u);
      const w = rng.range(6, 8.5), dd = rng.range(5.5, 7);
      // Footprint centre sits d/2 behind the front point (away from the road).
      const cx = sp.pos.x + Math.sin(sp.faceRoad) * dd * 0.5, cz = sp.pos.z + Math.cos(sp.faceRoad) * dd * 0.5;
      if (place.slopeRange(sp, dd, w) > 3.2 || !place.free(cx, cz, Math.max(w, dd) * 0.62, 4)) continue;
      mountainHouse(b.props.at(cx, cz), b.glow.at(cx, cz), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, rng, { w, d: dd, sink: 2.2, floors: row === 0 ? undefined : 1 });
      n++;
    }
  }
  console.info(`[mountain] houses ${Math.round(s0)}-${Math.round(s1)} side ${side}: ${n}`);
}

/** Lantern strings across the road every `every` m (tall timber poles on both sides). */
export function lanternStrings(d: Dress, s0: number, s1: number, every: number): void {
  const { place, rng, b } = d;
  for (let s = s0; s <= s1; s += every) {
    if (d.ctx.q.edgeKindAt(s, -1) === 'tunnel') continue;
    const l = place.spot(s, -1, 0.7), r = place.spot(s, 1, 0.7);
    const top = Math.max(d.field.edgeY(s, -1), d.field.edgeY(s, 1)) + 6.6;
    for (const p of [l, r]) {
      const base = Math.min(p.pos.y, d.field.edgeY(s, p.side));
      if (!place.claim(p.pos.x, p.pos.z, 0.4)) continue;
      lanternPost(b.props.at(p.pos.x, p.pos.z), b.glow.at(p.pos.x, p.pos.z), p.pos.x, base, p.pos.z, p.faceRoad, rng, top - base);
    }
    const a = new Vector3(l.pos.x, top - 0.25, l.pos.z), c = new Vector3(r.pos.x, top - 0.25, r.pos.z);
    lanternString(b.props.at(a.x, a.z), b.glow.at(a.x, a.z), b.cloth.at(a.x, a.z), a, c, 0.9, 2.4, rng);
  }
}

/** Lantern posts alternating sides (shore promenade). */
export function lanternPosts(d: Dress, s0: number, s1: number, every: number): void {
  const { place, rng, b } = d;
  let k = 0;
  for (let s = s0; s <= s1; s += every / 2) {
    const side: -1 | 1 = k++ % 2 ? 1 : -1;
    const sp = place.spot(s, side, 0.8);
    const y = Math.min(sp.pos.y, d.field.edgeY(s, side) + 0.3);
    if (!place.claim(sp.pos.x, sp.pos.z, 0.5)) continue;
    lanternPost(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, sp.faceRoad, rng);
  }
}

/** Truss gantry over the road at s with lantern-board headers (riders' side + back) and lanterns. */
export function lanternGantry(d: Dress, s: number, word: string, sub: string, backWord: string, backSub: string): void {
  const { place, b, atlas, rng } = d;
  const l = place.spot(s, -1, 1.1), r = place.spot(s, 1, 1.1);
  place.claim(l.pos.x, l.pos.z, 1.2);
  place.claim(r.pos.x, r.pos.z, 1.2);
  const g = gantry(b.props.at(l.pos.x, l.pos.z), l.pos, r.pos, 6.4);
  const toRiders = place.spot(s, 1, 0).along + Math.PI;
  const frontFaces = Math.cos(g.yaw - toRiders) > 0;
  const fr = lanternGantryFace(atlas, word, sub), bk = lanternGantryFace(atlas, backWord, backSub);
  const w = g.span + 0.6, h = Math.min(2.5, w / 6);
  if (fr) faceQuad(b.faces.at(g.front.x, g.front.z), frontFaces ? g.front : g.back, frontFaces ? g.yaw : g.yaw + Math.PI, w, h, fr);
  if (bk) faceQuad(b.faces.at(g.back.x, g.back.z), frontFaces ? g.back : g.front, frontFaces ? g.yaw + Math.PI : g.yaw, w, h, bk);
  // One row of paper lanterns under the beam (below the header, never in front of it).
  const n = Math.max(4, Math.round(g.span / 2.6));
  const dir = new Vector3().subVectors(r.pos, l.pos).setY(0).normalize();
  const mid = new Vector3().addVectors(l.pos, r.pos).multiplyScalar(0.5);
  const beamY = Math.min(l.pos.y, r.pos.y) + 6.4 - 0.12;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const x = mid.x + dir.x * t * g.span, z = mid.z + dir.z * t * g.span;
    lantern(b.props.at(x, z), b.glow.at(x, z), x, beamY, z, rng, i % 2 ? 0.7 : 0.8);
  }
}
