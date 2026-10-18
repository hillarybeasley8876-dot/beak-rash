// Tunnel vault skin (env-city): the track's baked vault reads as bright daytime concrete, so the city
// lines it with dark navy panels, cable trays along both spring lines and a red P5 stripe with white
// pinstripes at the crown. Sits 3 cm inside the vault, under the track's lamp strips (6 cm).
import { Color, Vector3 } from 'three';
import { vaultY, WALL_H } from '../../features/tunnel';
import { MeshBuf } from '../../geom';
import type { City } from './city';
import { quadToward, quadUV, texMesh } from './geo';
import { hdr } from './util';
import { CONCRETE_M, concreteTexture } from './wall-tex';

const STEPS = 12;
const INSET = 0.03;
const NAVY = [new Color('#3a4572'), new Color('#333d66')];
const TRAY = new Color('#1b1d26');
const STRIPE = hdr('#e5191c', 1.05), PIN = hdr('#f4f1ea', 0.9);
const A = new Vector3(), B = new Vector3(), C = new Vector3(), D = new Vector3(), F = new Vector3();

/** Navy panel skin, cable trays and the crown stripe over [s0, s1] of a tunnel of half width halfW. */
export function vaultSkin(c: City, s0: number, s1: number, halfW: number): void {
  const { ctx, b } = c.d;
  const { q } = ctx;
  const skin = new MeshBuf();
  const xs: number[] = [];
  for (let i = 0; i <= STEPS; i++) xs.push((-1 + (2 * i) / STEPS) * (halfW - INSET));
  const arc: number[] = [0];
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1] ?? 0, x1 = xs[i] ?? 0;
    arc.push((arc[i - 1] ?? 0) + Math.hypot(x1 - x0, vaultY(x1, halfW) - vaultY(x0, halfW)));
  }
  for (let sa = s0; sa < s1 - 0.01; sa += 2) {
    const sb = Math.min(s1, sa + 2);
    const panel = NAVY[Math.floor((sa - s0) / 4) % 2] ?? (NAVY[0] as Color);
    q.toWorld((sa + sb) / 2, 0, WALL_H, F);
    for (let i = 0; i < STEPS; i++) {
      const x0 = xs[i] ?? 0, x1 = xs[i + 1] ?? 0;
      const y0 = vaultY(x0, halfW) - INSET, y1 = vaultY(x1, halfW) - INSET;
      const pts = [q.toWorld(sa, x0, y0, new Vector3()), q.toWorld(sb, x0, y0, new Vector3()), q.toWorld(sb, x1, y1, new Vector3()), q.toWorld(sa, x1, y1, new Vector3())];
      const u0 = (arc[i] ?? 0) / CONCRETE_M, u1 = (arc[i + 1] ?? 0) / CONCRETE_M;
      const facing = new Vector3().subVectors(F, pts[0] as Vector3);
      quadUV(skin, pts, [[u0, sa / CONCRETE_M], [u0, sb / CONCRETE_M], [u1, sb / CONCRETE_M], [u1, sa / CONCRETE_M]], facing, panel);
    }
    // Cable trays just above the spring lines (bottom + inner face).
    for (const side of [-1, 1] as const) {
      const xo = side * (halfW - 0.12), xi = side * (halfW - 0.6), yb = WALL_H + 0.15, yt = WALL_H + 0.45;
      q.toWorld(sa, xo, yb, A); q.toWorld(sb, xo, yb, B); q.toWorld(sb, xi, yb, C); q.toWorld(sa, xi, yb, D);
      quadToward(b.props.at(A.x, A.z), A, B, C, D, TRAY, new Vector3(0, -1, 0));
      q.toWorld(sa, xi, yb, A); q.toWorld(sb, xi, yb, B); q.toWorld(sb, xi, yt, C); q.toWorld(sa, xi, yt, D);
      quadToward(b.props.at(A.x, A.z), A, B, C, D, TRAY, F.clone().sub(A));
    }
    // Crown stripe: red band with white pinstripes, facing down.
    for (const [xa, xb, col] of [[-0.32, 0.32, STRIPE], [-0.46, -0.4, PIN], [0.4, 0.46, PIN]] as Array<[number, number, Color]>) {
      const y = vaultY((xa + xb) / 2, halfW) - INSET - 0.012;
      q.toWorld(sa, xa, y, A); q.toWorld(sb, xa, y, B); q.toWorld(sb, xb, y, C); q.toWorld(sa, xb, y, D);
      quadToward(b.glow.at(A.x, A.z), A, B, C, D, col, new Vector3(0, -1, 0));
    }
  }
  texMesh(ctx, 'city:vault', skin, ctx.own(concreteTexture(ctx.app.renderer)));
}
