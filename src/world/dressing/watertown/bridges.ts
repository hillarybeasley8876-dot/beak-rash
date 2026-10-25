// Water Town bridges and water: the humpback stone arch that carries the road over a canal (the
// jumpCrest features) and the canal / river surfaces.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature } from '../../../core/types';
import type { MeshBuf } from '../../geom';
import { box, trs } from '../../kit/shapes';
import type { Dress } from '../dress';
import { quad } from './props';

const C = (h: string): Color => new Color(h);
const PAL = {
  stone: C('#cdc4b1'),
  stoneDark: C('#b3a992'),
  stoneLight: C('#dbd3c2'),
  water: C('#6d8f88'),
  waterDark: C('#5b7d78'),
};

const A = new Vector3(), B = new Vector3(), Cc = new Vector3(), D = new Vector3();

/** Quad with the normal forced upwards (the water and the flat tops). */
function quadUp(buf: MeshBuf, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color): void {
  const nrm = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
  if (nrm.y < 0) quad(buf, a, d, c, b, col);
  else quad(buf, a, b, c, d, col);
}

/** The stone humpback arch under a jumpCrest: a circular arch springing from the canal bed with
 *  spandrel walls up to the road deck and a solid stone parapet along the sides. */
export function humpbackArch(d: Dress, f: TrackFeature): void {
  const { ctx } = d;
  const q = ctx.q;
  const s0 = f.s0, s1 = f.s1, crest = (s0 + s1) / 2;
  const fr = q.frameVis(crest);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1;
  const tx = fr.tangent.x / tl, tz = fr.tangent.z / tl;
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const rx = fr.right.x / rl, rz = fr.right.z / rl;
  const bed = d.field.ground(crest, 1).step;          // the canal bed (absolute)
  const deckOf = (s: number): number => q.frameVis(s).pos.y - 0.45;
  const crown = deckOf(crest) - 0.05;
  const half = (s1 - s0) / 2;
  const rise = Math.max(0.8, crown - bed);
  const R = (half * half + rise * rise) / (2 * rise);
  const yc = crown - R;
  const th0 = Math.asin(Math.min(1, half / R));
  const W = ctx.L.halfWidth + 1.6;                     // the masonry's width
  const SEG = 18, THICK = 0.8;
  const PARAPET = 0.55;   // the masonry rises above the deck: a solid stone parapet
  /** World point at (s along the bridge, lateral x, absolute y). */
  const pt = (s: number, x: number, y: number, out: Vector3): Vector3 =>
    out.set(fr.pos.x + tx * (s - crest) + rx * x, y, fr.pos.z + tz * (s - crest) + rz * x);
  const buf = d.b.props.at(fr.pos.x, fr.pos.z);
  const inner = (i: number): { z: number; y: number } => {
    const th = -th0 + (2 * th0 * i) / SEG;
    return { z: R * Math.sin(th), y: yc + R * Math.cos(th) };
  };
  const outer = (i: number): { z: number; y: number } => {
    const th = -th0 + (2 * th0 * i) / SEG;
    return { z: (R + THICK) * Math.sin(th), y: yc + (R + THICK) * Math.cos(th) };
  };
  for (let i = 0; i < SEG; i++) {
    const i0 = inner(i), i1 = inner(i + 1), o0 = outer(i), o1 = outer(i + 1);
    // The arch ring on both faces, the intrados between them and the spandrel walls above.
    for (const side of [-1, 1]) {
      const x = side * W;
      const col = i % 2 ? PAL.stone : PAL.stoneLight;
      const a = pt(crest + i0.z, x, i0.y, new Vector3());
      const b = pt(crest + i0.z, x, o0.y, new Vector3());
      const c = pt(crest + i1.z, x, o1.y, new Vector3());
      const e = pt(crest + i1.z, x, i1.y, new Vector3());
      if (side > 0) quad(buf, a, b, c, e, col);
      else quad(buf, a, e, c, b, col);
      const top0 = deckOf(crest + i0.z) + PARAPET, top1 = deckOf(crest + i1.z) + PARAPET;
      const f = pt(crest + i0.z, x, top0, new Vector3());
      const g = pt(crest + i1.z, x, top1, new Vector3());
      if (side > 0) quad(buf, b, f, g, c, PAL.stone);
      else quad(buf, b, c, g, f, PAL.stone);
    }
    quad(buf, pt(crest + i0.z, -W, i0.y, A), pt(crest + i0.z, W, i0.y, B), pt(crest + i1.z, W, i1.y, Cc), pt(crest + i1.z, -W, i1.y, D), PAL.stoneDark);
  }
  // The deck soffit between the two faces.
  for (let s = s0; s < s1; s += 4) {
    const e = Math.min(s + 4, s1);
    const y0 = deckOf(s), y1 = deckOf(e);
    quad(buf, pt(s, -W, y0, A), pt(s, W, y0, B), pt(e, W, y1, Cc), pt(e, -W, y1, D), PAL.stoneDark);
  }
}

/**
 * The stone bridge over a canal: stone piers, beams and a deck, in place of the shared red steel
 * arch. The water is only a couple of metres under the road here, so the bridge is a low slab on
 * piers with the stone parapets along its edges (the shared 'parapet' edge draws them).
 */
export function stoneBridge(d: Dress, f: TrackFeature): void {
  const q = d.ctx.q;
  const s0 = f.s0, s1 = f.s1, mid = (s0 + s1) / 2;
  const fr = q.frameVis(mid);
  // The heights are relative to the road: the deck's underside half a metre under the tarmac and
  // the canal bed well below the water.
  const deck = -0.5;
  const bed = -1.8 - fr.pos.y;
  const half = d.ctx.L.halfWidth;
  const piers = Math.max(3, Math.round((s1 - s0) / 19));
  const buf = d.b.props.at(fr.pos.x, fr.pos.z);
  const p = new Vector3();
  for (let i = 0; i <= piers; i++) {
    const s = s0 + ((s1 - s0) * i) / piers;
    const f2 = q.frameVis(s);
    const ry = Math.atan2(f2.tangent.x, f2.tangent.z);
    for (const side of [-1, 1] as const) {
      const x = side * (half - 0.6);
      q.toWorld(s, x, (deck + bed) / 2, p);
      box(buf, trs(p.x, p.y, p.z, ry, 1.6, deck - bed, 1.5, new Matrix4()), i % 2 ? PAL.stone : PAL.stoneLight);
    }
  }
  // The deck: a stone slab under the road, with a fascia along its edges.
  for (let s = s0; s < s1; s += 6) {
    const e = Math.min(s + 6, s1);
    const xa = -(half + 0.6), xb = half + 0.6;
    const a = q.toWorld(s, xa, deck, new Vector3()), b = q.toWorld(s, xb, deck, new Vector3());
    const c = q.toWorld(e, xb, deck, new Vector3()), d2 = q.toWorld(e, xa, deck, new Vector3());
    quad(buf, a, d2, c, b, PAL.stoneDark);
    for (const [x, col] of [[xa, PAL.stone], [xb, PAL.stoneLight]] as Array<[number, Color]>) {
      const a2 = q.toWorld(s, x, deck, new Vector3()), b2 = q.toWorld(s, x, deck - 0.7, new Vector3());
      const c2 = q.toWorld(e, x, deck - 0.7, new Vector3()), d3 = q.toWorld(e, x, deck, new Vector3());
      quad(buf, a2, b2, c2, d3, col);
    }
  }
}

/** Water surface: a flat sheet over the track-space band (s0..s1), one quad per step. The lateral
 *  span of the sheet follows `xAt`, so it can follow the canal as the road curves. */
export function waterSheet(d: Dress, s0: number, s1: number, xAt: (s: number) => [number, number], step = 6): void {
  const q = d.ctx.q;
  for (let s = s0; s < s1; s += step) {
    const e = Math.min(s + step, s1);
    const fr0 = q.frameVis(s), fr1 = q.frameVis(e);
    const rl0 = Math.hypot(fr0.right.x, fr0.right.z) || 1, rl1 = Math.hypot(fr1.right.x, fr1.right.z) || 1;
    const [x0, x1] = xAt(s);
    const [y0, y1] = xAt(e);
    const a = new Vector3(fr0.pos.x + (fr0.right.x / rl0) * x0, 0.08, fr0.pos.z + (fr0.right.z / rl0) * x0);
    const b = new Vector3(fr0.pos.x + (fr0.right.x / rl0) * x1, 0.08, fr0.pos.z + (fr0.right.z / rl0) * x1);
    const c = new Vector3(fr1.pos.x + (fr1.right.x / rl1) * y1, 0.08, fr1.pos.z + (fr1.right.z / rl1) * y1);
    const e2 = new Vector3(fr1.pos.x + (fr1.right.x / rl1) * y0, 0.08, fr1.pos.z + (fr1.right.z / rl1) * y0);
    const buf = d.b.props.at(a.x, a.z);
    const col = Math.floor(s / 12) % 2 ? PAL.water : PAL.waterDark;
    quadUp(buf, a, b, c, e2, col);
  }
}
