// Folded flank wings: the classic resting-bird wing lying along each side of the body (coverts in front,
// scalloped secondaries below, pointed primaries crossing over the tail) — shrink-wrapped onto the body's
// SDF so it hugs any torso shape, skinned to the body bones. Reads strongly from the chase cam.
import { Vector3 } from 'three';
import type { CharacterBuilder, Influences } from './builder';
import { Painter } from './paint';
import { Field, type Prim, type V3 } from './sdf';
import { gridPanel } from './panel';
import { flipWinding, positionsOf, setPositions } from './shapes';

export interface FlankWingOpts {
  /** Wing root (front, near the shoulder) and primaries tip (past the tail), left side, bind space. */
  root: V3;
  tip: V3;
  /** Max depth (chord) of the folded wing. */
  width: number;
  /** Colour by position: u 0..1 root → tip, q 0..1 lower → upper edge (rows sit at q = ROWS). */
  paint: (u: number, q: number) => number;
  /** Body primitives the wing hugs (shape + skin weights), and the gap above their surface. */
  body: readonly Prim[];
  offset?: number;
  thick?: number;
  /** Depth of the trailing-edge scallops (fraction of width). */
  scallop?: number;
  /** u positions (0..1) of colour borders, so grid columns land on them. */
  breaks?: readonly number[];
}

/** Row fractions across the wing: the tight pair gives a crisp colour band at q ≈ 0.24. */
export const ROWS = [0, 0.22, 0.26, 0.6, 1] as const;

/** Upper edge of the folded wing (v in metres, u 0..1 root → tip). */
function topEdge(u: number, w: number): number {
  return w * (u < 0.3 ? 0.06 + 0.4 * Math.sin((Math.PI / 2) * (u / 0.3)) : 0.46 - 0.42 * Math.pow((u - 0.3) / 0.7, 1.2));
}

/** Lower edge: rounded coverts, scalloped secondaries, then three pointed primaries. */
function bottomEdge(u: number, w: number, sc: number): number {
  const env = u < 0.35 ? 0.2 + 0.8 * Math.sin((Math.PI / 2) * (u / 0.35)) : u < 0.72 ? 1 - 0.15 * ((u - 0.35) / 0.37) : 0.85 * Math.pow(1 - (u - 0.72) / 0.28, 0.7);
  if (u < 0.72) return -w * env * (1 + sc * (Math.abs(Math.sin((Math.PI * 5 * u) / 0.72)) - 0.6));
  const f = (((u - 0.72) / 0.28) * 3) % 1;
  return -w * env * (1 - 0.45 * f);
}

export function addFlankWing(b: CharacterBuilder, side: -1 | 1, o: FlankWingOpts): void {
  const mir = (p: V3): Vector3 => new Vector3(side === -1 ? p[0] : -p[0], p[1], p[2]);
  const root = mir(o.root), tip = mir(o.tip);
  const L = root.distanceTo(tip), w = o.width;
  const dir = tip.clone().sub(root).normalize();
  const up = new Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  const field = new Field(o.body, 0.25);
  const painter = new Painter(field);
  const off = o.offset ?? 0.012;
  const sc = o.scallop ?? 0.3;
  const geo = gridPanel(L, (u) => topEdge(u, w), (u) => bottomEdge(u, w, sc), { cols: 18, rows: 4, rowAt: ROWS, thick: o.thick ?? 0.018, breaks: o.breaks });
  const src = positionsOf(geo), out = new Float32Array(src.length);
  const weights: Influences[] = [], colors: number[] = [];
  const p = new Vector3(), g = new Vector3(), e = 0.004;
  const grad = (q: Vector3): Vector3 => g.set(
    field.at(q.x + e, q.y, q.z) - field.at(q.x - e, q.y, q.z),
    field.at(q.x, q.y + e, q.z) - field.at(q.x, q.y - e, q.z),
    field.at(q.x, q.y, q.z + e) - field.at(q.x, q.y, q.z - e),
  ).normalize();
  for (let i = 0; i < src.length / 3; i++) {
    const u = src[i * 3] ?? 0, v = src[i * 3 + 1] ?? 0, z = src[i * 3 + 2] ?? 0;
    p.copy(root).addScaledVector(dir, u).addScaledVector(up, v);
    const start = p.clone();
    for (let k = 0; k < 6; k++) {
      const d = field.at(p.x, p.y, p.z);
      if (d > 1e8) break;
      p.addScaledVector(grad(p), -(d - off));
    }
    // Primaries past the body stay near their plane instead of collapsing onto the tail.
    const pull = p.clone().sub(start), maxPull = 0.09;
    if (pull.length() > maxPull) p.copy(start).addScaledVector(pull.normalize(), maxPull);
    p.addScaledVector(grad(p), z);
    out.set([p.x, p.y, p.z], i * 3);
    weights.push(painter.weightsAt(p.x, p.y, p.z, false));
    const uu = u / L, lo = bottomEdge(uu, w, sc);
    colors.push(o.paint(uu, (v - lo) / Math.max(1e-6, topEdge(uu, w) - lo)));
  }
  if (side === 1) flipWinding(geo);
  setPositions(geo, out);
  b.part({ geometry: geo, color: (_x, _y, _z, _a, _b, _c, i) => colors[i] ?? 0xffffff, bone: (_x, _y, _z, i) => weights[i] ?? [[0, 1]], outline: 0.75 });
  geo.dispose();
}
