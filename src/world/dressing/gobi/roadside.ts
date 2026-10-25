// Roadside dressing: telegraph poles and wires, meme billboards, road signs, distance markers,
// chevrons, warnings, the camel caravans and the dust devils.
import { Group, Matrix4, Vector3 } from 'three';
import { MeshBuf } from '../../geom';
import { box, cylinder, trs } from '../../kit/shapes';
import { billboard, postSign } from '../../scenery/signs/boards';
import { billboardFace, chevronFace, distanceFace, roadSignFace, warnFace } from '../../scenery/signs/faces';
import { bufMesh } from './batch';
import { camel, dustDevil, rod } from './critters';
import { C } from './kit';
import type { GobiCtx } from './gctx';

const m = new Matrix4();

/** Yaw for a face looking back down the road at riders on `side`. */
export function towardRiders(g: GobiCtx, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = g.ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return Math.atan2(-nx, -nz);
}

/** Smallest u (beyond the drivable edge) for a board of width w so it stays clear of the road. */
function clearU(g: GobiCtx, s: number, side: -1 | 1, yaw: number, w: number): number {
  const fr = g.ctx.q.frameVis(s);
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const across = Math.abs(Math.cos(yaw) * (fr.right.x / rl) - Math.sin(yaw) * (fr.right.z / rl));
  return (w / 2) * across + 1.4;
}

/** Telegraph poles with sagging wires, marching along one side of the highway. */
export function poles(g: GobiCtx, s0: number, len: number, side: -1 | 1): void {
  const step = 46;
  const h = 8.4;
  let prev: Vector3[] | null = null;
  for (let s = s0; s < s0 + len; s += step) {
    const sp = g.place.spot(s, side, 7.5);
    if (!g.place.free(sp.pos.x, sp.pos.z, 0.6, 1)) { prev = null; continue; }
    const buf = g.props.at(sp.pos.x, sp.pos.z);
    cylinder(buf, trs(sp.pos.x, sp.pos.y - 0.3, sp.pos.z, 0, 0.16, h, 0.13, m), C.mudDark, 6);
    const tops: Vector3[] = [];
    // Two crossarms across the road, each with two wires.
    for (const armY of [h - 0.5, h - 1.6]) {
      box(buf, trs(sp.pos.x, sp.pos.y + armY, sp.pos.z, sp.faceRoad, 3.4, 0.16, 0.16, m), C.mudDark);
      for (const sgn of [-1, 1]) {
        tops.push(new Vector3(
          sp.pos.x + Math.cos(sp.faceRoad) * sgn * 1.5,
          sp.pos.y + armY + 0.22,
          sp.pos.z - Math.sin(sp.faceRoad) * sgn * 1.5,
        ));
      }
    }
    if (prev) {
      for (let i = 0; i < prev.length && i < tops.length; i++) {
        const a = prev[i] as Vector3, b = tops[i] as Vector3;
        if (a.distanceTo(b) > step * 1.6) continue;
        const mid = new Vector3().lerpVectors(a, b, 0.5);
        mid.y -= 1.7;
        rod(g.thin.at(a.x, a.z), a, mid, 0.05, C.black, 4);
        rod(g.thin.at(a.x, a.z), mid, b, 0.05, C.black, 4);
      }
    }
    prev = tops;
  }
}

/** Meme billboards along the highway (the gobi's own lines plus the shared ones). */
export function billboards(g: GobiCtx, lines: string[], art: HTMLImageElement[]): void {
  const L = g.ctx.L.length;
  const pool = g.ctx.raceRng.shuffle([...lines, ...g.ctx.raceRng.shuffle(lines)]);
  let k = 0;
  for (let s = 190; s < L - 120; s += g.rng.range(150, 260)) {
    const side = g.rng.chance(0.55) ? 1 : -1;
    const yaw = towardRiders(g, s, side, 0.75);
    const u = clearU(g, s, side, yaw, 11) + g.rng.range(0, 3);
    const sp = g.place.spot(s, side, u);
    if (sp.pos.y < 0.3 || !g.place.free(sp.pos.x, sp.pos.z, 6, 4)) continue;
    const line = pool[k % pool.length] ?? '戈壁欢迎你';
    const img = art.length ? art[k % art.length] ?? null : null;
    const rect = g.face(`bb:${line}:${img?.src ?? ''}`, () => billboardFace(g.atlas, g.rng.fork(k + 1), line, img));
    k++;
    if (!rect) continue;
    billboard(g.props.at(sp.pos.x, sp.pos.z), g.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, 10, img ? 5.6 : 5, 3, rect);
  }
}

/** One billboard at an exact spot (the layout marks pick where the jokes stand). */
export function billboardAt(g: GobiCtx, s: number, side: -1 | 1, line: string, art: HTMLImageElement[]): void {
  const yaw = towardRiders(g, s, side, 0.75);
  const u = clearU(g, s, side, yaw, 11) + 1.5;
  const sp = g.place.spot(s, side, u);
  if (sp.pos.y < 0.3 || !g.place.free(sp.pos.x, sp.pos.z, 6, 4)) return;
  const img = art.length ? art[0] ?? null : null;
  const rect = g.face(`bb:${line}:${img?.src ?? ''}`, () => billboardFace(g.atlas, g.rng.fork(line.length + s), line, img));
  if (!rect) return;
  billboard(g.props.at(sp.pos.x, sp.pos.z), g.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, 10, img ? 5.6 : 5, 3, rect);
}

/** A road sign on a post (the layout marks pick the corner). */
export function roadSign(g: GobiCtx, s: number, side: -1 | 1, text: string, glyph = ''): void {
  const yaw = towardRiders(g, s, side, 0.25);
  const w = glyph ? 1.3 : 2.6;
  const u = clearU(g, s, side, yaw, w + 0.2);
  const sp = g.place.spot(s, side, u);
  if (!g.place.claim(sp.pos.x, sp.pos.z, 0.7)) return;
  const rect = g.face(`sign:${text}:${glyph}`, () => (glyph ? warnFace(g.atlas, glyph, text) : roadSignFace(g.atlas, text)));
  if (!rect) return;
  postSign(g.props.at(sp.pos.x, sp.pos.z), g.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw,
    glyph ? 1.3 : 2.6, glyph ? 1.5 : 1.6, 1.6, rect);
}

/** A warning sign before a jump (ramp / crest). */
export function warning(g: GobiCtx, s: number, side: -1 | 1, glyph: string, caption: string): void {
  roadSign(g, s, side, caption, glyph);
}

/** Distance-to-finish markers every 500 m. */
export function distanceMarkers(g: GobiCtx): void {
  const L = g.ctx.L.length;
  for (let togo = 500; togo < L - 120; togo += 500) {
    const s = L - togo;
    const side: -1 | 1 = g.ctx.q.edgeKindAt(s, 1) === 'stone' ? -1 : 1;
    const yaw = towardRiders(g, s, side, 0.25);
    const sp = g.place.spot(s, side, clearU(g, s, side, yaw, 1.3));
    if (!g.place.claim(sp.pos.x, sp.pos.z, 0.6)) continue;
    const rect = g.face(`km:${togo}`, () => distanceFace(g.atlas, `${(togo / 1000).toFixed(1)} KM`));
    if (!rect) continue;
    postSign(g.props.at(sp.pos.x, sp.pos.z), g.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, 1.2, 0.95, 1.1, rect);
  }
}

/** Chevron boards on the outside of a bend. */
export function chevrons(g: GobiCtx, side: -1 | 1, s0: number, s1: number): void {
  const rect = g.face('chevron', () => chevronFace(g.atlas));
  if (!rect) return;
  for (let s = s0 + 8; s < s1; s += 22) {
    const k = g.ctx.q.frameVis(s).curvature;
    const yaw = towardRiders(g, s, side, 0.2);
    const sp = g.place.spot(s, side, clearU(g, s, side, yaw, 1));
    if (!g.place.claim(sp.pos.x, sp.pos.z, 0.5)) continue;
    postSign(g.props.at(sp.pos.x, sp.pos.z), g.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, yaw, 0.9, 0.9, 0.55, rect, k < 0);
  }
}

/** A camel caravan ambling along the shoulder. */
export function camelCaravan(g: GobiCtx, s: number, side: -1 | 1): void {
  const n = g.rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const ss = s + i * g.rng.range(7, 12);
    const u = g.rng.range(5, 12);
    const sp = g.place.spot(ss, side, u);
    if (!g.place.free(sp.pos.x, sp.pos.z, 2.2, 1.5)) continue;
    camel(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad + g.rng.range(-0.3, 0.3), g.rng, g.rng.range(0.9, 1.15));
  }
}

/** Dust devils: thin sand funnels that spin on the spot. */
export function dustDevils(g: GobiCtx, s: number, side: -1 | 1, count: number): void {
  for (let i = 0; i < count; i++) {
    const ss = s + i * g.rng.range(30, 70);
    const u = g.rng.range(18, 70);
    const sp = g.place.spot(ss, side, u);
    if (!g.place.free(sp.pos.x, sp.pos.z, 3, 2)) continue;
    const h = g.rng.range(7, 14);
    const holder = new Group();
    holder.position.set(sp.pos.x, sp.pos.y, sp.pos.z);
    holder.name = 'gobi-dustdevil';
    g.group.add(holder);
    const buf: MeshBuf = new MeshBuf();
    dustDevil(buf, 0, 0, 0, g.rng, h);
    bufMesh(g.ctx, holder, 'gobi-dustdevil-funnel', buf, 0.02);
    g.spin.push({ obj: holder, speed: g.rng.range(0.5, 1.5) * (g.rng.chance(0.5) ? 1 : -1) });
  }
}
