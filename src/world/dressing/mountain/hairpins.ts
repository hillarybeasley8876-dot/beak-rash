// Sunset Pass hairpin landmarks (env-mountain): each switchback gets its own identity on its inner
// island (the outside drops away below the rail; the island is what the chase cam looks across), big
// enough to read from 40–60 m, each on its own ground cover:
//   H1 a red paifang gate at the island tip, the wayside shrine behind it, stone lanterns along the curb, gravel;
//   H2 a timber viewing deck with cheering spectators and flags, a camper van, a flower meadow;
//   H3 a mossy granite spire with a trickle of water, boulders and a cairn, on scree.
import { Color, Matrix4, Vector3 } from 'three';
import { buildWaterfall } from '../../env/mountain-waterfall';
import { flatAxes } from '../../env/mountain-frame';
import { paintGround, type GroundCover } from '../../env/mountain-grade';
import { sphere, trs } from '../../kit/shapes';
import { fan, flagPole, pennants } from '../../scenery/props/event';
import { camperVan, paifang, rockSpire, stoneLantern, timberDeck } from '../../scenery/props/mountain-hairpin';
import { binocular, shrine } from '../../scenery/props/mountain-roadside';
import { boulder } from '../../scenery/props/nature';
import { flowerClump } from '../../scenery/props/cover';
import type { Spot } from '../../scenery/place';
import type { Dress } from '../dress';
import { flatSpot } from './landmarks';
import { scenicSign } from './signage';
import { zones } from './util';

const SHRINE_SIGN = ['山神庙 保佑不摔车', 'MOUNTAIN SHRINE'] as const;
const VIEW_SIGN = ['观景台 拍照请靠边', 'VIEWPOINT'] as const;
export const HAIRPIN_TEXTS = [...SHRINE_SIGN, ...VIEW_SIGN];
const STONE = new Color('#b3a899');
const CAIRN = [STONE, new Color('#9d9387'), new Color('#c9bfae')];
const VAN = [new Color('#7fd1c1'), new Color('#ff8a5c')] as const;
const FLAG = [new Color('#e5191c'), new Color('#ffd23a')] as const;
const m = new Matrix4();

interface Island { sMid: number; cx: number; cz: number; R: number }

/** The hairpin bend around s: mid-bend s, the bend centre (world) on the inner side, and its radius. */
function island(d: Dress, s: number, side: -1 | 1): Island | null {
  const z = zones(d.ctx, 'hairpin').find((zz) => s >= zz.s0 - 1 && s <= zz.s1 + 1);
  if (!z) {
    console.warn(`[mountain] no hairpin zone at s ${Math.round(s)}`);
    return null;
  }
  const sMid = (z.s0 + z.s1) / 2;
  const fr = d.ctx.q.frameVis(sMid);
  const R = 1 / Math.max(1e-3, Math.abs(fr.curvature));
  const a = flatAxes(fr);
  return { sMid, cx: fr.pos.x + a.rx * side * R, cz: fr.pos.z + a.rz * side * R, R };
}

/** Island ground cover up to ~2.5 m short of the inner curb. */
function cover(d: Dress, isl: Island, side: -1 | 1, kind: GroundCover): void {
  paintGround(d.ctx, d.field.noise, isl.cx, isl.cz, isl.R - d.field.bound(isl.sMid, side) - 2.5, kind);
}

/** Hairpin 1: paifang gate at the island tip, the shrine behind it, stone lanterns along the inner curb. */
export function shrineSite(d: Dress, s: number, side: -1 | 1): void {
  const isl = island(d, s, side);
  if (!isl) return;
  cover(d, isl, side, 'gravel');
  const { place, b } = d;
  const gate = flatSpot(d, 'paifang', isl.sMid, 3.8, 5, 8, side, 2.5);
  if (gate && place.claim(gate.pos.x, gate.pos.z, 3.8)) paifang(b.props.at(gate.pos.x, gate.pos.z), gate.pos.x, gate.pos.y - 0.15, gate.pos.z, gate.faceRoad);
  const sp = flatSpot(d, 'shrine', isl.sMid, 1.8, (gate?.u ?? 6) + 5, (gate?.u ?? 6) + 9, side, 1.5);
  if (sp && place.claim(sp.pos.x, sp.pos.z, 2.2)) {
    shrine(b.props.at(sp.pos.x, sp.pos.z), b.glow.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad, d.rng);
  }
  const zone = zones(d.ctx, 'hairpin').find((zz) => isl.sMid > zz.s0 && isl.sMid < zz.s1);
  for (let ss = (zone?.s0 ?? s) + 5; ss < (zone?.s1 ?? s) - 4; ss += 8.5) {
    const p = place.spot(ss, side, 0.9);
    if (!place.claim(p.pos.x, p.pos.z, 0.5)) continue;
    stoneLantern(b.props.at(p.pos.x, p.pos.z), b.glow.at(p.pos.x, p.pos.z), p.pos.x, Math.min(p.pos.y, d.field.edgeY(ss, side)), p.pos.z, p.faceRoad);
  }
  scenicSign(d, s - 16, side, SHRINE_SIGN[0], SHRINE_SIGN[1]);
  d.ctx.log(`hairpin 1 at s ${Math.round(isl.sMid)}: gate u ${gate?.u ?? '-'}, shrine u ${sp?.u ?? '-'}`);
}

/** Deck on the spot (local X along the road, -Z toward it): eight cheering fans, two flags with pennants, a coin binocular. */
function deckWithFans(d: Dress, sp: Spot): void {
  const { b, rng } = d;
  const c = Math.cos(sp.faceRoad), sn = Math.sin(sp.faceRoad), y = sp.pos.y;
  const at = (lx: number, lz: number): [number, number] => [sp.pos.x + lx * c + lz * sn, sp.pos.z - lx * sn + lz * c];
  timberDeck(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, y, sp.pos.z, sp.faceRoad, 9.5, 4.6);
  for (let i = 0; i < 8; i++) {
    const [x, z] = at(-3.6 + (i % 4) * 2.3 + (i < 4 ? 0 : 1.1), i < 4 ? -1.2 : 0.6);
    fan(b.crowd.at(x, z), x, y + 0.5, z, sp.faceRoad, rng);
  }
  const tops: Vector3[] = [];
  FLAG.forEach((col, k) => {
    const [x, z] = at(k ? 4.4 : -4.4, 1.9);
    flagPole(b.props.at(x, z), b.cloth.at(x, z), x, y + 0.5, z, 5, sp.faceRoad, col, rng);
    tops.push(new Vector3(x, y + 5.3, z));
  });
  const [ta, tb] = tops;
  if (ta && tb) pennants(b.cloth.at(ta.x, ta.z), ta, tb, 0.9, rng);
  const [bx, bz] = at(3.3, -1.5);
  binocular(b.props.at(bx, bz), bx, y + 0.5, bz, sp.faceRoad + Math.PI);
}

/** Hairpin 2: viewing deck with spectators and flags, a camper van parked beside it, a flower meadow. */
export function viewpointLayby(d: Dress, s: number, side: -1 | 1): void {
  const isl = island(d, s, side);
  if (!isl) return;
  cover(d, isl, side, 'meadow');
  const { place, b, rng } = d;
  const sp = flatSpot(d, 'viewing deck', isl.sMid, 4.6, 5, 9, side, 2.5);
  if (sp && place.claim(sp.pos.x, sp.pos.z, 4.6)) deckWithFans(d, sp);
  const van = flatSpot(d, 'camper van', isl.sMid - 16, 3, 4, 8, side, 1.5);
  if (van && place.claim(van.pos.x, van.pos.z, 3)) camperVan(b.props.at(van.pos.x, van.pos.z), van.pos.x, van.pos.y, van.pos.z, van.along, VAN[0], VAN[1]);
  const reach = isl.R - d.field.bound(isl.sMid, side) - 3;
  for (let i = 0; i < 48; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * reach;
    const x = isl.cx + Math.cos(a) * r, z = isl.cz + Math.sin(a) * r;
    if (!place.free(x, z, 0.4, 1.2)) continue;
    flowerClump(b.cover.at(x, z), x, d.ctx.groundWorld(x, z), z, rng);
  }
  scenicSign(d, s - 16, side, VIEW_SIGN[0], VIEW_SIGN[1]);
  d.ctx.log(`hairpin 2 at s ${Math.round(isl.sMid)}: deck ${sp ? `${Math.round(sp.s)}/${sp.u}` : '-'}, van ${van ? `${Math.round(van.s)}/${van.u}` : '-'}`);
}

/** A thin trickle down the road-facing side of the spire, from about mid-height. */
function trickle(d: Dress, sp: Spot, top: number): void {
  const toRoad = new Vector3(-Math.sin(sp.faceRoad), 0, -Math.cos(sp.faceRoad));
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), toRoad);
  const lip = new Vector3(sp.pos.x, sp.pos.y + (top - sp.pos.y) * 0.6, sp.pos.z).addScaledVector(toRoad, 1.25);
  buildWaterfall(d.ctx, { lip, out: toRoad, right, width: 0.9, bottom: sp.pos.y + 0.05, reach: 0.3 }, false);
}

/** Hairpin 3: mossy granite spire (7.5 m) with a trickle of water, boulders round it and a cairn, on scree. */
export function rockOutcrop(d: Dress, s: number, side: -1 | 1): void {
  const isl = island(d, s, side);
  if (!isl) return;
  cover(d, isl, side, 'scree');
  const { place, rng, b, ctx } = d;
  const sp = flatSpot(d, 'outcrop', isl.sMid, 4, 6, 11, side, 6);
  if (!sp || !place.claim(sp.pos.x, sp.pos.z, 2.6)) return;
  const spire = rockSpire(b.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, rng, 7.5);
  ctx.log(`hairpin 3 at s ${Math.round(isl.sMid)}: spire ${Math.round(sp.s)}/${sp.u}`);
  trickle(d, sp, spire.top);
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(3.4, 7);
    const x = sp.pos.x + Math.cos(a) * r, z = sp.pos.z + Math.sin(a) * r;
    const size = rng.range(1.4, 3.2);
    if (!place.free(x, z, size * 0.7, size * 0.7 + 1.5)) continue;
    boulder(b.props.at(x, z), x, ctx.groundWorld(x, z) - size * 0.3, z, rng, size);
  }
  const cx = sp.pos.x + Math.sin(sp.faceRoad) * 3.2, cz = sp.pos.z + Math.cos(sp.faceRoad) * 3.2;
  if (!place.free(cx, cz, 0.6, 1.2)) return;
  let y = ctx.groundWorld(cx, cz);
  for (let k = 0; k < 4; k++) {
    const r = 0.42 - k * 0.08;
    sphere(b.props.at(cx, cz), trs(cx, y + r * 0.6, cz, rng.range(0, 3), r, r * 0.62, r * 0.9, m), CAIRN[k % CAIRN.length] ?? STONE, 8, 5);
    y += r * 1.1;
  }
}
