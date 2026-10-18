// Sunset Pass gorge (env-mountain): the vermilion suspension bridge over the slot canyon, a waterfall
// pouring from a rock spout on the far wall beside the road, and boulders in the river below.
import { Vector3 } from 'three';
import { buildWaterfall } from '../../env/mountain-waterfall';
import { suspensionBridge, type Anchor, type DeckPoint } from '../../scenery/props/mountain-bridge';
import { boulder } from '../../scenery/props/nature';
import type { Dress } from '../dress';
import { worldAt } from './util';

function deckPoint(d: Dress, s: number): DeckPoint {
  const fr = d.ctx.q.frameVis(s);
  return {
    c: new Vector3(fr.pos.x, fr.pos.y, fr.pos.z),
    r: new Vector3(fr.right.x, 0, fr.right.z).normalize(),
    t: new Vector3(fr.tangent.x, 0, fr.tangent.z).normalize(),
  };
}

/** Lowest ground under both tower legs at s. */
function legGround(d: Dress, s: number, half: number): number {
  return Math.min(d.ctx.ground(s, -half), d.ctx.ground(s, half));
}

/** Suspension bridge over the gorge zone [s0, s0 + len]: towers on both rims, anchors 22 m behind. */
export function gorgeBridge(d: Dress, s0: number, len: number): void {
  const { ctx, b, place, rng } = d;
  const sA = s0 - 1.2, sB = s0 + len + 1.2;
  const n = 2 * Math.round((sB - sA) / 8.4);
  const deck: DeckPoint[] = [];
  for (let i = 0; i <= n; i++) deck.push(deckPoint(d, sA + ((sB - sA) * i) / n));
  const half = d.field.bound(s0 + len / 2, 1) + 0.95;
  const anchor = (s: number): Anchor => {
    const p = deckPoint(d, s);
    const g = legGround(d, s, half);
    return { at: p.c.setY(Math.min(g, p.c.y)), block: g < p.c.y + 1.5 };
  };
  for (const s of [sA, sB, sA - 22, sB + 22]) {
    for (const side of [-1, 1]) {
      const w = worldAt(ctx, s, side * half);
      place.claim(w.x, w.z, 2.2);
    }
  }
  const mid = deck[n / 2] as DeckPoint;
  const cx = mid.c.x, cz = mid.c.z;
  suspensionBridge(b.props.at(cx, cz), b.thin.at(cx, cz), b.glow.at(cx, cz), b.cloth.at(cx, cz), deck, {
    half, towerH: 24, ground0: legGround(d, sA, half), ground1: legGround(d, sB, half),
    anchors: [anchor(sA - 22), anchor(sB + 22)],
  }, rng);
  console.info(`[mountain] gorge bridge ${Math.round(sA)}-${Math.round(sB)}, ${n} panels, deck y ${mid.c.y.toFixed(1)}`);
}

/** Waterfall on the far gorge wall at lateral xc (pours toward the bridge), rock spout, river rocks. */
export function waterfall(d: Dress, sWall: number, xc: number, width: number): void {
  const { ctx, b, rng } = d;
  const fr = deckPoint(d, sWall);
  const rimY = ctx.ground(sWall + 4, xc);
  const lipW = worldAt(ctx, sWall - 1.5, xc);
  const lip = new Vector3(lipW.x, rimY + 3.5, lipW.z);
  const out = fr.t.clone().negate();
  buildWaterfall(ctx, { lip, out, right: fr.r, width, bottom: 0 });
  // Spout: big boulders framing the lip, one behind it.
  for (const [ds, dx, size] of [[3, -(width / 2 + 2.6), 6.5], [3.5, width / 2 + 2.4, 5.8], [8, 0, 7], [5, -(width / 2 + 7), 5]] as Array<[number, number, number]>) {
    const p = worldAt(ctx, sWall + ds, xc + dx);
    boulder(b.props.at(p.x, p.z), p.x, p.y - size * 0.3, p.z, rng, size);
  }
  // River rocks: around the plunge pool and down the river under the bridge.
  for (let i = 0; i < 26; i++) {
    const near = i < 8;
    const s = near ? sWall - rng.range(3, 16) : rng.range(sWall - 120, sWall - 6);
    const x = near ? xc + rng.range(-width, width) : rng.range(-70, 90);
    const p = worldAt(ctx, s, x);
    if (p.y > -1 || !d.place.claim(p.x, p.z, 2.5)) continue;
    const size = rng.range(2.2, near ? 5 : 4);
    boulder(b.props.at(p.x, p.z), p.x, Math.max(p.y, -2.6), p.z, rng, size);
  }
}
