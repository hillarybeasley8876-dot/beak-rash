// The sprint's billboard canyon: stacked LED screens and red/black P5 boards on steel scaffolds in
// front of both facade rows (angled toward the riders, neon-framed). Shared face helpers for p5.ts.
import { Color, Matrix4, Vector3 } from 'three';
import { box, trs } from '../../kit/shapes';
import { CPAL } from '../../scenery/props/city-kit';
import type { AtlasRect } from '../../scenery/signs/atlas';
import type { City } from './city';
import { P5_LINES } from './lines';
import { board, screenRect, sign } from './neon';
import { p5Face } from './neon-faces';
import { ahead, hdr, mount, towardRiders, zoneRuns } from './util';

const m = new Matrix4();
const SCREEN = { w: 6.4, h: 3.6 };
export const P5_ASPECT = 160 / 512;
/** Facade-parallel, angled ~15° toward oncoming riders. */
const CANYON_TURN = 1.31;
const FRAMES = [hdr('#ff2d95', 2.4), hdr('#22e8ff', 2.4), hdr('#ffe600', 2.0)];
const STRIP_L = hdr('#ff2d95', 2.2), STRIP_R = hdr('#22e8ff', 2.2);

/** P5 board atlas cell for line k (same cells as the rooftop boards and underpass posters). */
export function p5Rect(c: City, k: number): AtlasRect | null {
  const text = P5_LINES[k % P5_LINES.length] ?? '';
  return c.d.face(`roof:${text}:true`, () => p5Face(c.neonAtlas, c.d.rng.fork(k + 900), text));
}

/** Thin glowing frame around a face of size w × h centred at p. */
export function neonFrame(c: City, p: Vector3, yaw: number, w: number, h: number, col: Color): void {
  const buf = c.d.b.glow.at(p.x, p.z);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), t = 0.12;
  const q = ahead(p, yaw, 0.08);
  box(buf, trs(q.x, q.y + h / 2 + t, q.z, yaw, w + 2 * t, t, t, m), col);
  box(buf, trs(q.x, q.y - h / 2 - t, q.z, yaw, w + 2 * t, t, t, m), col);
  for (const s of [-1, 1]) box(buf, trs(q.x + rx * s * (w / 2 + t), q.y, q.z + rz * s * (w / 2 + t), yaw, t, h + 2 * t, t, m), col);
}

/** Steel scaffold: two legs and cross rails from the ground to `top`. */
function scaffold(c: City, p: Vector3, yaw: number, w: number, top: number): void {
  const buf = c.cb.body.at(p.x, p.z);
  buf.setAux(0);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (const s of [-0.42, 0.42]) box(buf, trs(p.x + rx * s * w, p.y + top / 2, p.z + rz * s * w, yaw, 0.22, top, 0.22, m), CPAL.trim);
  for (let y = 3.2; y < top; y += 3.6) box(buf, trs(p.x, p.y + y, p.z, yaw, w * 0.9, 0.12, 0.12, m), CPAL.trim);
}

/** One face on the scaffold: backing board, the face, a neon frame for screens. */
export function mounted(c: City, p: Vector3, yaw: number, w: number, h: number, rect: AtlasRect, screen: boolean, k: number): void {
  board(c, ahead(p, yaw, -0.12), yaw, w + 0.5, h + 0.5, 0.26);
  const batch = screen ? c.cb.screens : c.cb.neon;
  sign(batch.at(p.x, p.z), ahead(p, yaw, 0.04), yaw, w, h, rect, screen ? 1.15 : 1.3);
  if (screen) neonFrame(c, p, yaw, w + 0.5, h + 0.5, FRAMES[k % FRAMES.length] as Color);
}

/** Scaffold at (s, side) u m beyond the edge with faces by kind: 0 two screens, 1 screen over a low P5
 * board, 2 screen under a high P5 board, 3 tall double screen + P5 (finish flanks). False if no room. */
function scaffoldAt(c: City, art: HTMLImageElement[], s: number, side: -1 | 1, u: number, kind: number, k: number): boolean {
  const { ctx, place } = c.d;
  const mt = mount(c, s, side, u);
  if (!mt || mt.onDeck) return false;
  const yaw = towardRiders(ctx, s, side, CANYON_TURN);
  const legs = [-0.42, 0.42].map((f) => ahead(mt.sp.pos, yaw - Math.PI / 2, f * SCREEN.w));
  if (!legs.every((l) => place.free(l.x, l.z, 0.35, 0.1))) return false;
  for (const l of legs) place.claim(l.x, l.z, 0.35);
  const base = new Vector3(mt.sp.pos.x, mt.y, mt.sp.pos.z);
  const low = kind === 1 ? 7.6 : 6.4, top = kind === 1 ? 10.2 : kind === 3 ? 18.6 : 13.4;
  scaffold(c, base, yaw, SCREEN.w, top);
  const screenAt = (y: number, kk: number): void => {
    const rect = screenRect(c, kk, art);
    if (rect) mounted(c, base.clone().setY(mt.y + y), yaw, SCREEN.w, SCREEN.h, rect, true, kk);
  };
  const p5At = (y: number, kk: number): void => {
    const rect = p5Rect(c, kk);
    if (rect) mounted(c, base.clone().setY(mt.y + y), yaw, SCREEN.w, SCREEN.w * P5_ASPECT, rect, false, kk);
  };
  screenAt(low, k * 5 + 1);
  if (kind === 0 || kind === 3) screenAt(low + 4.8, k * 5 + 7);
  if (kind === 1) p5At(4.2, k);
  else if (kind === 2) p5At(low + 3.6, k);
  else if (kind === 3) { screenAt(low + 9.6, k * 5 + 3); p5At(4.2, k); }
  return true;
}

/** Low LED kerb lines along both edges (magenta left, cyan right): they streak in the wet road. */
function kerbStrips(c: City, s0: number, s1: number): void {
  const { ctx, field, b } = c.d;
  const a = new Vector3(), e = new Vector3();
  for (const side of [-1, 1] as const) {
    const col = side < 0 ? STRIP_L : STRIP_R;
    for (let s = s0; s < s1; s += 3) {
      const x = side * (field.bound(s, side) + 0.25);
      ctx.q.toWorld(s, x, 0.12, a);
      ctx.q.toWorld(Math.min(s1, s + 2.4), x, 0.12, e);
      const len = a.distanceTo(e), yaw = Math.atan2(e.x - a.x, e.z - a.z);
      box(b.glow.at(a.x, a.z), trs((a.x + e.x) / 2, a.y, (a.z + e.z) / 2, yaw, 0.08, 0.08, len, m), col);
    }
  }
}

/** Billboard canyon along the sprint (a scaffold every 13 m per side, sides staggered, LED kerb lines)
 * and tall double-screen scaffolds flanking the giant FINISH screen. */
export function billboardCanyon(c: City, art: HTMLImageElement[]): number {
  const { ctx } = c.d;
  let n = 0;
  for (const [s0, s1] of zoneRuns(ctx, ['sprint'])) {
    for (const side of [-1, 1] as const) {
      for (let s = s0 + (side < 0 ? 6 : 12.5); s < s1 - 6; s += 13) if (scaffoldAt(c, art, s, side, 2.0, n % 3, n)) n++;
    }
    kerbStrips(c, s0, s1);
  }
  for (const g of ctx.L.marks.filter((k) => k.kind === 'finishGantry')) {
    // The giant screen hangs 22 m past the gantry (gantries.ts); two tall scaffolds per side lead up to it.
    for (const ds of [-12, -27]) for (const side of [-1, 1] as const) if (scaffoldAt(c, art, g.s + ds, side, 2.4, 3, n)) n++;
  }
  return n;
}
