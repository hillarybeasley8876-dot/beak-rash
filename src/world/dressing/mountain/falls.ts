// Sunset Pass waterfall (env-mountain): a two-tier fall in a rock notch on the far gorge wall. The
// upper fall drops from a lip ~22 m above the deck into a ledge pool just below deck level, so the
// lip, the whole drop, the foam and the mist read over the parapet from the entire bridge; the lower
// fall carries on from the ledge down to the river. The sheets face down the gorge toward the riders,
// turned toward the road; a dark wet-rock backing and granite stacks on both sides frame the notch.
import { Color, Vector3 } from 'three';
import { buildWaterfall } from '../../env/mountain-waterfall';
import { boulder } from '../../scenery/props/nature';
import { crag } from '../../scenery/props/rocks';
import type { Dress } from '../dress';
import { worldAt } from './util';

const TURN = 0.55;      // sheet facing: from straight down the gorge toward the road (rad)
const LIP_UP = 22;      // lip above the deck (m)
const POOL_DOWN = 1.5;  // ledge pool below the deck (m)
const WET = new Color('#3e3448');
const GRANITE = [new Color('#b4846f'), new Color('#93695f'), new Color('#7d5f62')] as const;
const UP = new Vector3(0, 1, 0);

export function waterfall(d: Dress, sWall: number, xc: number, width: number): void {
  const { ctx, b, rng } = d;
  const fr = ctx.q.frameVis(sWall);
  const t = new Vector3(fr.tangent.x, 0, fr.tangent.z).normalize(), r = new Vector3(fr.right.x, 0, fr.right.z).normalize();
  const out = t.clone().negate().multiplyScalar(Math.cos(TURN)).addScaledVector(r, -Math.sign(xc) * Math.sin(TURN)).normalize();
  const right = new Vector3().crossVectors(UP, out);
  const base = worldAt(ctx, sWall + 2, xc);
  const deckY = fr.pos.y, poolY = deckY - POOL_DOWN;
  const lip = new Vector3(base.x, deckY + LIP_UP, base.z);
  const upper = buildWaterfall(ctx, { lip, out, right, width, bottom: poolY });
  // Lower tier from the front of the ledge down to the river (no second mist: the gorge hides its foot).
  const lip2 = upper.foot.clone().addScaledVector(out, width * 0.45).setY(poolY + 0.4);
  buildWaterfall(ctx, { lip: lip2, out, right, width: width * 0.55, bottom: 0 }, false);
  notch(d, lip, upper.foot, out, right, width, poolY);
  // River rocks downstream under the bridge.
  for (let i = 0; i < 18; i++) {
    const p = worldAt(ctx, rng.range(sWall - 120, sWall - 6), rng.range(-70, 90));
    if (p.y > -1 || !d.place.claim(p.x, p.z, 2.5)) continue;
    const size = rng.range(2.2, 4);
    boulder(b.props.at(p.x, p.z), p.x, Math.max(p.y, -2.6), p.z, rng, size);
  }
  ctx.log(`waterfall at s=${Math.round(sWall)} x=${xc}: lip ${lip.y.toFixed(0)}, ledge pool ${poolY.toFixed(0)}, deck ${deckY.toFixed(0)}`);
}

/** Wet backing face behind the upper sheet, granite stacks on both sides, the ledge under the pool. */
function notch(d: Dress, lip: Vector3, foot: Vector3, out: Vector3, right: Vector3, width: number, poolY: number): void {
  const { rng, b } = d;
  const yaw = Math.atan2(out.x, out.z);
  const rock = (p: Vector3, sx: number, sy: number, sz: number, col: Color, flat = true): void =>
    crag(b.props.at(p.x, p.z), p.x, p.y, p.z, sx, sy, sz, yaw + rng.range(-0.25, 0.25), rng, col, flat);
  // Backing: dark wet rock right behind the sheet, from below the ledge up to just under the lip.
  const h = lip.y - 1 - (poolY - 2);
  for (let k = 0; k < 4; k++) {
    rock(lip.clone().addScaledVector(out, -2.6).setY(poolY - 2 + (k + 0.5) * (h / 4)), width * 0.62, h / 6, 2.4, WET, false);
  }
  // Notch walls: dense stacks of big granite masses on both sides, from deep in the gorge to above the lip.
  for (const side of [-1, 1]) {
    for (let y = poolY - 24; y < lip.y + 5; y += rng.range(4, 6)) {
      const sz = rng.range(5, 8);
      const p = lip.clone().addScaledVector(right, side * (width * 0.55 + sz * 0.7)).addScaledVector(out, rng.range(-3, 1)).setY(y);
      rock(p, sz * rng.range(0.9, 1.2), sz * rng.range(0.7, 1.0), sz, GRANITE[rng.int(0, 2)] as Color, false);
    }
  }
  // Buttress under the ledge pool (the lower fall pours down its face), the ledge, and rocks behind the lip.
  for (let k = 0; k < 5; k++) {
    const sz = rng.range(6, 9);
    rock(foot.clone().addScaledVector(out, -sz * 0.4).setY(poolY - 4 - k * 8), width * 0.7, sz, sz, GRANITE[rng.int(0, 2)] as Color, false);
  }
  rock(foot.clone().setY(poolY - 2.4), width * 0.8, 2.8, width * 0.55, GRANITE[1] as Color);
  for (const side of [-1, 0, 1]) {
    const p = lip.clone().addScaledVector(out, -6 - Math.abs(side) * 2).addScaledVector(right, side * width * 0.4).setY(lip.y - 0.5);
    rock(p, rng.range(3, 5), rng.range(2.5, 4), rng.range(3, 5), GRANITE[2] as Color);
  }
}
