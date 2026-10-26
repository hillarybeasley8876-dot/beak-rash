// Drivable-edge boundaries drawn exactly at bounds(): guard rails, red/white barriers, promenade
// seawalls, stone walls, bridge parapets, market kerbs with bollards, quay coping with mooring posts.
// Rock walls / tunnels / open water need no extra geometry (terrain or the tunnel draws them).
import { Color, Matrix4, Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { PropBatch } from '../kit/batch';
import { edgeRow, extrudeEdge, type Profile } from '../kit/extrude';
import { box, cylinder, trs } from '../kit/shapes';
import { pile } from '../scenery/props/marine';
import { EDGE_KINDS } from '../layout/sides';
import type { EdgeKind } from '../layout/types';
import type { TerrainField } from '../terrain/field';

const C = (hex: string): Color => new Color(hex);
const PAL = {
  red: C('#e5191c'), white: C('#f3f1ea'), steel: C('#c9d1d9'), steelDark: C('#8d97a3'), post: C('#56606b'),
  wall: C('#f4eee0'), cap: C('#d6c4a2'), stoneA: C('#bcae96'), stoneB: C('#a99a82'), stoneC: C('#cbbfa6'),
  concrete: C('#d9d8d1'), kerb: C('#cfc2aa'), black: C('#1c1c22'), yellow: C('#ffd21f'),
  /** The water town: whitewashed walls, dark tile caps and granite kerb blocks. */
  granite: C('#9ea5a7'), graniteDark: C('#868d90'), plaster: C('#f1ebdd'), tile: C('#3c4149'),
};

const BARRIER: Profile = [[0, 0], [0, 0.07], [0.1, 0.3], [0.16, 0.82], [0.44, 0.82], [0.5, 0.3], [0.6, 0.07], [0.6, 0]];
const RAIL: Profile = [[0.04, 0.42], [0, 0.5], [0.04, 0.58], [0, 0.66], [0.04, 0.74], [0.11, 0.74], [0.11, 0.42]];
const SEAWALL: Profile = [[0, 0], [0, 0.62], [0.05, 0.7], [0.42, 0.7], [0.47, 0.62], [0.47, 0]];
const STONE: Profile = [[0, 0], [0.05, 0.52], [0.13, 0.6], [0.47, 0.6], [0.55, 0.5], [0.6, 0]];
const PARAPET: Profile = [[0, 0], [0, 0.86], [0.04, 0.92], [0.34, 0.92], [0.38, 0.86], [0.38, 0]];
const KERB: Profile = [[0, 0], [0, 0.16], [0.04, 0.2], [0.3, 0.2], [0.3, 0]];
const COPING: Profile = [[0, 0], [0, 0.05], [0.38, 0.05], [0.38, -0.25]];
/** The water town's street edge: a long granite kerb, then a low whitewashed wall with a dark tile cap. */
const WT_STREET: Profile = [
  [0, 0], [0, 0.18], [0.3, 0.18], [0.3, 0],
  [0.6, 0], [0.6, 0.52], [0.68, 0.6], [1.0, 0.6], [1.08, 0.52], [1.08, 0],
];
/** The water town's bridge parapet: a low stone wall with a coping, no railings. */
const WT_PARAPET: Profile = [[0, 0], [0, 0.78], [0.06, 0.86], [0.36, 0.86], [0.42, 0.78], [0.42, 0]];
/** The water town's quay: a stone coping with a lip, overhanging the drop into the canal. */
const WT_QUAY: Profile = [[0, 0], [0, 0.09], [0.42, 0.09], [0.46, 0.02], [0.46, -0.3]];

/** Runs of one edge kind along a side: [kind, s0, s1]. */
function runs(ctx: WorldCtx, side: -1 | 1): Array<[EdgeKind, number, number]> {
  const { L } = ctx;
  const sd = side < 0 ? L.sides.left : L.sides.right;
  const out: Array<[EdgeKind, number, number]> = [];
  let cur = sd.edge[0] ?? 0, start = L.sMin;
  for (let i = 1; i <= L.n; i++) {
    const e = i < L.n ? sd.edge[i] ?? 0 : -1;
    if (e === cur) continue;
    out.push([EDGE_KINDS[cur] ?? 'rail', start, L.sMin + i - 1]);
    cur = e;
    start = L.sMin + i - 1;
  }
  return out;
}

export function buildEdges(ctx: WorldCtx, field: TerrainField): void {
  const batch = new PropBatch(ctx, 'edges');
  const bound = (s: number, side: -1 | 1): number => field.bound(s, side);
  const m = new Matrix4();
  const p = new Vector3();
  /** Place a unit shape every `every` metres along a run, `u` outward from the edge. */
  const along = (side: -1 | 1, s0: number, s1: number, every: number, u: number, fn: (x: number, y: number, z: number, ry: number) => void): void => {
    for (let s = Math.ceil(s0 / every) * every; s <= s1; s += every) {
      const r = edgeRow(ctx, s, side, bound);
      p.copy(r.pos).addScaledVector(r.rh, u);
      fn(p.x, p.y, p.z, Math.atan2(r.tan.x, r.tan.z));
    }
  };
  for (const side of [-1, 1] as const) {
    for (const [kind, s0, s1] of runs(ctx, side)) {
      const ex = (prof: Profile, col: (face: number, s: number) => Color, closed = false, step?: number): void =>
        extrudeEdge(ctx, batch, side, s0, s1, prof, bound, col, { closed, step });
      switch (kind) {
        case 'barrier':
          ex(BARRIER, (_f, s) => (Math.floor(s / 4) % 2 === 0 ? PAL.red : PAL.white));
          break;
        case 'rail':
          ex(RAIL, (f) => (f < 4 ? PAL.steel : PAL.steelDark), true);
          along(side, s0 + 1, s1 - 1, 4, 0.2, (x, y, z, ry) => box(batch.at(x, z), trs(x, y + 0.37, z, ry, 0.1, 0.78, 0.12, m), PAL.post));
          break;
        case 'seawall':
          ex(SEAWALL, (f) => (f >= 1 && f <= 3 ? PAL.cap : PAL.wall));
          break;
        case 'stone':
          // The water town's lanes: a granite kerb and a whitewashed wall with a tile cap.
          if (ctx.id === 'watertown') {
            ex(WT_STREET, (f, s) => (f <= 2 ? (Math.floor(s / 2.4) % 2 === 0 ? PAL.granite : PAL.graniteDark)
              : f === 3 ? PAL.kerb : f <= 5 ? PAL.plaster : f <= 7 ? PAL.tile : PAL.plaster));
          } else {
            ex(STONE, (f, s) => (f >= 2 && f <= 2 ? PAL.cap : [PAL.stoneA, PAL.stoneB, PAL.stoneC][Math.floor(s / 1.3) % 3] ?? PAL.stoneA));
          }
          break;
        case 'parapet':
          if (ctx.id === 'watertown') {
            // A stone parapet on the town's bridges: no railings, no red posts.
            ex(WT_PARAPET, (f) => (f >= 1 && f <= 3 ? PAL.stoneC : PAL.stoneA));
            break;
          }
          ex(PARAPET, (f) => (f >= 1 && f <= 3 ? PAL.white : PAL.concrete));
          along(side, s0 + 1, s1 - 1, 2.5, 0.19, (x, y, z, ry) => box(batch.at(x, z), trs(x, y + 1.02, z, ry, 0.07, 0.22, 0.07, m), PAL.red));
          extrudeEdge(ctx, batch, side, s0, s1, [[0.12, 1.12], [0.12, 1.2], [0.26, 1.2], [0.26, 1.12]], bound, () => PAL.red, { closed: true });
          break;
        case 'stalls':
          ex(KERB, () => PAL.kerb);
          along(side, s0 + 1.5, s1 - 1, 3, 0.15, (x, y, z) => {
            cylinder(batch.at(x, z), trs(x, y, z, 0, 0.11, 0.78, 0.11, m), PAL.red, 8, 1, 1, true, PAL.white);
            cylinder(batch.at(x, z), trs(x, y + 0.5, z, 0, 0.115, 0.14, 0.115, m), PAL.white, 8, 1, 1, false);
          });
          break;
        case 'quay':
          if (ctx.id === 'watertown') {
            // A stone quay: the coping at the kerb and the wall that drops into the canal.
            // 1 m rows: the coping is only 9 cm high, and over a jump hill's sag a 2 m chord lifts it above that.
            ex(WT_QUAY, (f) => (f === 1 ? PAL.stoneC : f <= 3 ? PAL.stoneA : PAL.stoneB), false, 1);
            // Mooring posts stand in the canal, a little above the water.
            along(side, s0 + 4, s1 - 4, 13, 0.8, (x, y, z) => {
              pile(batch.at(x, z), x, y - 1.1, z);
              cylinder(batch.at(x, z), trs(x, y - 1.1, z, 0, 0.13, 0.55, 0.13, m), PAL.black, 8);
            });
            break;
          }
          // Bollards stand on mooring piles 0.7 m off the coping, clear of the drop line.
          ex(COPING, () => PAL.kerb);
          along(side, s0 + 3, s1 - 3, 11, 0.7, (x, y, z) => {
            pile(batch.at(x, z), x, y, z);
            cylinder(batch.at(x, z), trs(x, y, z, 0, 0.16, 0.42, 0.16, m), PAL.black, 10, 1, 0.8);
            cylinder(batch.at(x, z), trs(x, y + 0.42, z, 0, 0.2, 0.08, 0.2, m), PAL.black, 10);
          });
          break;
        default:
          break;
      }
    }
  }
  batch.finish();
}
