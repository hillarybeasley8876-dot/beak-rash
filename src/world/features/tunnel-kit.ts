// Tunnel interior kit, on top of the shared shell (features/tunnel.ts) for every track with a TUNNEL_STYLES
// entry: yellow / black hazard chevrons over the dado inside both portals, cable trays along both spring
// lines, lane-control signals hung from the vault (green ↓ over the riders' lanes, red ✕ over the oncoming
// ones) and low green exit boxes with a white arrow toward the nearer portal. Unlit like the shell (same
// baked light) and written into its tube / lamp batches: no extra draw calls. Per-track fit-outs
// (dressing/*) add lamps, pools and signs; a track whose fit-out lines the whole tube sets its style to null.
import { Color, Matrix4, Vector3 } from 'three';
import type { TrackFeature, TrackId } from '../../core/types';
import type { WorldCtx } from '../ctx';
import type { MeshBuf } from '../geom';
import type { PropBatch } from '../kit/batch';
import { box } from '../kit/shapes';
import { quad, SHELL_LIGHT, vaultY, WALL_H } from './tunnel';

export interface TunnelStyle {
  /** Hazard chevrons on the dado this far (m) inside each portal. */
  hazard: number;
  /** Cable trays along both walls just under the spring line. */
  trays: boolean;
  /** Lane-signal rows every `signals` m (0 = none). */
  signals: number;
  /** Exit boxes every `exits` m, alternating walls (0 = none). */
  exits: number;
}

/** Per track; null = the track's own fit-out lines the tube (city: dressing/city/underpass.ts, vault.ts). */
export const TUNNEL_STYLES: Record<TrackId, TunnelStyle | null> = {
  coast: { hazard: 24, trays: true, signals: 48, exits: 30 },
  mountain: { hazard: 24, trays: true, signals: 60, exits: 36 },
  city: null,
};

const COL = {
  hazard: new Color('#ffd21f'), ink: new Color('#141418'), tray: new Color('#868b95'), trayLip: new Color('#5d616b'),
  cables: [new Color('#1d1d22'), new Color('#c8102e'), new Color('#e8b70f')], signal: new Color('#1b1d24'),
  go: new Color('#35ff8a').multiplyScalar(1.3), stop: new Color('#ff3b3b').multiplyScalar(1.3),
  exit: new Color('#17b85a').multiplyScalar(1.15), exitInk: new Color('#f6f6ee'),
};
const DADO = { y0: 0.14, y1: 1.06, stripe: 0.42, slant: 0.55 } as const;
const TRAY = { y: WALL_H - 0.1, depth: 0.42, lip: 0.12, step: 3 } as const;
const SIGNAL = { y: 5.0, size: 0.66, depth: 0.3, from: 30 } as const;
const EXIT = { y: 0.62, w: 0.9, h: 0.36 } as const;
const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3(), F = new Vector3(), m = new Matrix4();

/** Band y0..y1 on the plane at lateral x between s0..s1, facing the tube's axis. */
function wallQuad(ctx: WorldCtx, buf: MeshBuf, x: number, s0: number, s1: number, y0: number, y1: number, col: Color): void {
  const { q } = ctx;
  q.toWorld(s0, x, y0, A); q.toWorld(s1, x, y0, B); q.toWorld(s1, x, y1, C); q.toWorld(s0, x, y1, D);
  q.toWorld((s0 + s1) / 2, 0, (y0 + y1) / 2, F);
  quad(buf, A, B, C, D, col, F.sub(A));
}

/** Yellow / black chevron band over the dado of both walls in [a, b]: slanted stripes of both colours, so the
 *  band starts and ends on a stripe. */
function hazard(ctx: WorldCtx, tubes: PropBatch, halfW: number, a: number, b: number, k: number): void {
  const cols = [COL.hazard.clone().multiplyScalar(k), COL.ink.clone().multiplyScalar(k)];
  const { q } = ctx;
  for (const side of [-1, 1] as const) {
    const x = side * (halfW - 0.015);
    q.toWorld((a + b) / 2, x, 0, C);
    const buf = tubes.at(C.x, C.z);
    for (let s = a, i = 0; s + DADO.stripe + DADO.slant <= b; s += DADO.stripe, i++) {
      q.toWorld(s, x, DADO.y0, A); q.toWorld(s + DADO.stripe, x, DADO.y0, B);
      q.toWorld(s + DADO.stripe + DADO.slant, x, DADO.y1, C); q.toWorld(s + DADO.slant, x, DADO.y1, D);
      q.toWorld(s, 0, 0.6, F);
      quad(buf, A, B, C, D, cols[i % 2] ?? COL.ink, F.sub(A));
    }
  }
}

/** Steel trays (floor + lip, cables bulging over the lip) on brackets along both walls, in TRAY.step m rows
 *  that follow the road. */
function trays(ctx: WorldCtx, tubes: PropBatch, halfW: number, f: TrackFeature, k: number): void {
  const steel = COL.tray.clone().multiplyScalar(k), lip = COL.trayLip.clone().multiplyScalar(k);
  const cables = COL.cables.map((c) => c.clone().multiplyScalar(k));
  for (const side of [-1, 1] as const) {
    const wall = side * (halfW - 0.01), out = side * (halfW - TRAY.depth);
    for (let s = f.s0 + 1; s < f.s1 - 1; s += TRAY.step) {
      const s1 = Math.min(f.s1 - 1, s + TRAY.step);
      ctx.q.toWorld(s, wall, TRAY.y, C);
      const buf = tubes.at(C.x, C.z);
      // Floor seen from below (riders look up at it), lip facing the road, the cable bundle over the lip.
      ctx.q.toWorld(s, wall, TRAY.y, A); ctx.q.toWorld(s1, wall, TRAY.y, B); ctx.q.toWorld(s1, out, TRAY.y, C); ctx.q.toWorld(s, out, TRAY.y, D);
      quad(buf, A, B, C, D, steel, F.set(0, -1, 0));
      wallQuad(ctx, buf, out, s, s1, TRAY.y, TRAY.y + TRAY.lip, lip);
      cables.forEach((col, i) => {
        const y = TRAY.y + TRAY.lip + i * 0.03;
        wallQuad(ctx, buf, out + side * 0.03 * (i + 1), s, s1, y, y + 0.035, col);
      });
      // Bracket under the tray (a dark knee, facing oncoming riders).
      ctx.q.toWorld(s, wall, TRAY.y - 0.32, A); ctx.q.toWorld(s, out, TRAY.y - 0.01, B); ctx.q.toWorld(s, wall, TRAY.y - 0.01, C);
      ctx.q.toWorld(s - 1, 0, TRAY.y, F);
      const n = F.sub(A);
      const i0 = buf.vert(A, n, lip), i1 = buf.vert(B, n, lip), i2 = buf.vert(C, n, lip);
      buf.tri(i0, i1, i2);
      buf.tri(i0, i2, i1);
    }
  }
}

/** A row of lane-control signals across the vault at s (facing riders driving in). */
function signals(ctx: WorldCtx, tubes: PropBatch, lamps: PropBatch, halfW: number, s: number, k: number): void {
  const { q } = ctx;
  const hw = ctx.L.halfWidth, fr = q.frameVis(s);
  const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
  const body = COL.signal.clone().multiplyScalar(k);
  const r = new Vector3(fr.right.x, fr.right.y, fr.right.z), up = new Vector3(fr.up.x, fr.up.y, fr.up.z);
  const facing = new Vector3(-fr.tangent.x, -fr.tangent.y, -fr.tangent.z);
  for (const x of [-0.75 * hw, -0.25 * hw, 0.25 * hw, 0.75 * hw]) {
    const top = vaultY(x, halfW);
    if (top < SIGNAL.y + SIGNAL.size + 0.2) continue;
    const c = q.toWorld(s, x, SIGNAL.y + SIGNAL.size / 2, new Vector3());
    box(tubes.at(c.x, c.z), m.makeRotationY(yaw).scale(B.set(SIGNAL.size, SIGNAL.size, SIGNAL.depth)).setPosition(c), body);
    // Hanger up to the vault.
    const h = top - SIGNAL.y - SIGNAL.size;
    q.toWorld(s, x, SIGNAL.y + SIGNAL.size + h / 2, D);
    box(tubes.at(c.x, c.z), m.makeRotationY(yaw).scale(B.set(0.05, h, 0.05)).setPosition(D), body);
    // Symbol on the face toward the riders: ↓ over the riders' lanes (right), ✕ over the oncoming ones.
    const face = c.clone().addScaledVector(facing, SIGNAL.depth / 2 + 0.01);
    const sym = new Glyph(lamps.at(c.x, c.z), face, r, up, facing, SIGNAL.size / 2);
    if (x > 0) {
      sym.bar(0, 0.34, 0, -0.08, 0.12, COL.go);
      sym.tri(-0.38, 0.0, 0.38, 0.0, 0, -0.42, COL.go);
    } else {
      sym.bar(-0.36, -0.36, 0.36, 0.36, 0.08, COL.stop);
      sym.bar(-0.36, 0.36, 0.36, -0.36, 0.08, COL.stop);
    }
  }
}

/** Flat symbol shapes on a sign face: (u, v) in units of `scale` m from the centre, u along `r`, v along `up`. */
class Glyph {
  constructor(
    private readonly buf: MeshBuf, private readonly c: Vector3, private readonly r: Vector3, private readonly up: Vector3,
    private readonly n: Vector3, private readonly scale: number,
  ) {}

  private at(u: number, v: number, out: Vector3): Vector3 {
    return out.copy(this.c).addScaledVector(this.r, u * this.scale).addScaledVector(this.up, v * this.scale);
  }

  /** Bar from (u0, v0) to (u1, v1), half width w. */
  bar(u0: number, v0: number, u1: number, v1: number, w: number, col: Color): void {
    const l = Math.hypot(u1 - u0, v1 - v0) || 1, pu = (-(v1 - v0) / l) * w, pv = ((u1 - u0) / l) * w;
    this.at(u0 - pu, v0 - pv, A); this.at(u1 - pu, v1 - pv, B); this.at(u1 + pu, v1 + pv, C); this.at(u0 + pu, v0 + pv, D);
    quad(this.buf, A, B, C, D, col, this.n);
  }

  /** Triangle, front side toward the face normal. */
  tri(u0: number, v0: number, u1: number, v1: number, u2: number, v2: number, col: Color): void {
    this.at(u0, v0, A); this.at(u1, v1, B); this.at(u2, v2, C);
    const flip = F.subVectors(B, A).cross(D.subVectors(C, A)).dot(this.n) < 0;
    const i = this.buf.vert(A, this.n, col), j = this.buf.vert(B, this.n, col), k = this.buf.vert(C, this.n, col);
    if (flip) this.buf.tri(i, k, j); else this.buf.tri(i, j, k);
  }
}

/** Low exit box on the dado: green plate with a white arrow toward the nearer portal (dir −1 back / 1 ahead). */
function exitBox(ctx: WorldCtx, lamps: PropBatch, halfW: number, s: number, side: -1 | 1, dir: number): void {
  const { q } = ctx;
  const fr = q.frameVis(s);
  const n = new Vector3(-fr.right.x * side, 0, -fr.right.z * side).normalize();
  const along = new Vector3(fr.tangent.x, fr.tangent.y, fr.tangent.z), up = new Vector3(fr.up.x, fr.up.y, fr.up.z);
  const c = q.toWorld(s, side * (halfW - 0.02), EXIT.y + EXIT.h / 2, new Vector3());
  const buf = lamps.at(c.x, c.z);
  const g = new Glyph(buf, c, along, up, n, EXIT.h / 2);
  const hw = EXIT.w / EXIT.h;
  g.bar(-hw, 0, hw, 0, 1, COL.exit);
  const front = new Glyph(buf, c.clone().addScaledVector(n, 0.008), along, up, n, EXIT.h / 2);
  front.bar(-0.9 * dir, 0, 0.5 * dir, 0, 0.16, COL.exitInk);
  front.tri(0.35 * dir, 0.55, 0.35 * dir, -0.55, 1.05 * dir, 0, COL.exitInk);
}

/** Fit the shared interior to tunnel f (no-op for tracks without a style). */
export function tunnelInterior(ctx: WorldCtx, tubes: PropBatch, lamps: PropBatch, halfW: number, f: TrackFeature): void {
  const style = TUNNEL_STYLES[ctx.id];
  if (!style) return;
  const k = ctx.look.grade.night ? SHELL_LIGHT.night : SHELL_LIGHT.day;
  const zone = Math.min(style.hazard, (f.s1 - f.s0) / 3);
  hazard(ctx, tubes, halfW, f.s0 + 0.4, f.s0 + zone, k);
  hazard(ctx, tubes, halfW, f.s1 - zone, f.s1 - 0.4, k);
  if (style.trays) trays(ctx, tubes, halfW, f, k);
  if (style.signals > 0) for (let s = f.s0 + SIGNAL.from; s < f.s1 - 15; s += style.signals) signals(ctx, tubes, lamps, halfW, s, k);
  if (style.exits > 0) {
    const mid = (f.s0 + f.s1) / 2;
    let k2 = 0;
    for (let s = f.s0 + zone + 6; s < f.s1 - zone - 6; s += style.exits, k2++) exitBox(ctx, lamps, halfW, s, k2 % 2 ? 1 : -1, s < mid ? -1 : 1);
  }
}
