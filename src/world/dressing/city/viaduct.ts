// Expressway viaduct: deck slab with a neon fascia line under the parapets, underside, T-piers where
// the deck stands high, a solid embankment wall where it is still low (ramp foot).
import { Color, Matrix4, Vector3 } from 'three';
import { rowsBetween } from '../../geom';
import { box, trs } from '../../kit/shapes';
import type { City } from './city';
import { inFeature, quadToward, runsWhere } from './geo';
import { hdr } from './util';

const COL = { deck: new Color('#8e8c98'), under: new Color('#55535f'), pier: new Color('#7d7b88'), cap: new Color('#6c6a78'), wall: new Color('#77758a') };
const DECK_T = 1.6;
const m = new Matrix4();
const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3();

/** Viaduct deck slab, neon fascia line, piers (embankment wall where the deck is low). */
export function viaduct(c: City): void {
  const { ctx, field, b } = c.d;
  const { q } = ctx;
  const deckAt = (s: number): boolean => field.ground(s, -1).detached && field.ground(s, 1).detached && !inFeature(ctx, 'bridge', s, 2)
    && q.edgeKindAt(s, -1) === 'parapet';
  const fr = q.frameVis(0);
  const neon = hdr('#22e8ff', 2.4);
  for (const [s0, s1] of runsWhere(ctx, deckAt)) {
    const rows = rowsBetween(s0, s1 + 2, 3);
    for (let r = 0; r < rows.length - 1; r++) {
      const sa = rows[r] ?? 0, sb = rows[r + 1] ?? 0;
      q.frameVis(sa, fr);
      const buf = b.props.at(fr.pos.x, fr.pos.z);
      const ground = c.d.place.spot(sa, c.d.side(1), 0.5).pos.y;
      const low = fr.pos.y - ground < DECK_T + 3.2;
      for (const side of [-1, 1] as const) {
        const x = side * (field.bound(sa, side) + 0.4);
        const facing = new Vector3(fr.right.x * side, 0, fr.right.z * side);
        const bottom = low ? ground - fr.pos.y - 0.3 : -DECK_T;
        q.toWorld(sa, x, 0.0, A); q.toWorld(sb, x, 0.0, B); q.toWorld(sb, x, bottom, C); q.toWorld(sa, x, bottom, D);
        quadToward(buf, A, B, C, D, low ? COL.wall : COL.deck, facing);
        q.toWorld(sa, x * 1.002, -0.42, A); q.toWorld(sb, x * 1.002, -0.42, B); q.toWorld(sb, x * 1.002, -0.3, C); q.toWorld(sa, x * 1.002, -0.3, D);
        quadToward(b.glow.at(A.x, A.z), A, B, C, D, neon, facing);
      }
      if (low) continue;
      const xl = -(field.bound(sa, -1) + 0.4), xr = field.bound(sa, 1) + 0.4;
      q.toWorld(sa, xl, -DECK_T, A); q.toWorld(sa, xr, -DECK_T, B); q.toWorld(sb, xr, -DECK_T, C); q.toWorld(sb, xl, -DECK_T, D);
      quadToward(buf, A, B, C, D, COL.under, new Vector3(0, -1, 0));
    }
    piers(c, s0, s1);
  }
}

/** T-piers every ~26 m where the deck stands high enough above the street. */
function piers(c: City, s0: number, s1: number): void {
  const { ctx, b } = c.d;
  const fr = ctx.q.frameVis(s0), p = new Vector3();
  for (let s = s0 + 12; s < s1 - 6; s += 26) {
    ctx.q.frameVis(s, fr);
    const ground = c.d.place.spot(s, c.d.side(1), 0.5).pos.y;
    const top = fr.pos.y - DECK_T;
    if (top - ground < 3.2) continue;
    const ry = Math.atan2(fr.tangent.x, fr.tangent.z);
    ctx.q.toWorld(s, 0, 0, p);
    const buf = b.props.at(p.x, p.z);
    box(buf, trs(p.x, (ground + top - 1.2) / 2, p.z, ry, 2.2, top - 1.2 - ground, 2.2, m), COL.pier);
    box(buf, trs(p.x, top - 0.6, p.z, ry + Math.PI / 2, 2.4, 1.2, 13, m), COL.cap);
    c.lots.claimDisc(p.x, p.z, 2);
  }
}

