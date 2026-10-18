// Layered ridge silhouettes (env-mountain): four rings of flat-coloured mountain profiles around
// the camera, deep plum in front fading to pale lilac toward the sky (atmospheric perspective),
// drawn right after the sky dome without depth so every real object covers them. They follow the
// camera like the dome (infinitely far), so they read as distant ranges from anywhere on the pass.
import { Color, DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { MeshBuf } from '../geom';
import { Noise2 } from '../terrain/noise';

interface Layer { r: number; base: number; amp: number; col: string; back: string; freq: number; seed: number }

// Heights are metres above the camera's eye level at radius r. `col` = front-lit (away from the sun),
// `back` = backlit silhouette against the sunset. The front layer matches the fog colour so fogged
// hills melt into it; farther layers get paler and pinker (atmospheric perspective).
const LAYERS: Layer[] = [
  { r: 1700, base: 70, amp: 330, col: '#efcbd2', back: '#c58fb2', freq: 2.2, seed: 11 },
  { r: 1600, base: 45, amp: 240, col: '#ddb0c4', back: '#a874a4', freq: 3.1, seed: 23 },
  { r: 1500, base: 22, amp: 160, col: '#cf9db7', back: '#8c5f95', freq: 4.3, seed: 37 },
  { r: 1400, base: 2, amp: 95, col: '#c48aa6', back: '#6f4a84', freq: 6.0, seed: 51 },
];
const SEGS = 720;
const BOTTOM = -260;

/** Ridge profile height at azimuth a (0..2π): ridged noise, peaks sharpened, one sunset gap. */
function profile(n: Noise2, L: Layer, a: number, sunAz: number): number {
  const t = a / (Math.PI * 2);
  const x = Math.cos(a) * L.freq, z = Math.sin(a) * L.freq;
  const ridge = n.ridge(x, z, 4);
  let h = L.base + L.amp * Math.pow(ridge, 1.7) + L.amp * 0.18 * n.fbm(x * 3.1, z * 3.1, 2);
  // The sun sets into a saddle: the two front layers dip near its azimuth.
  const da = Math.abs(Math.atan2(Math.sin(a - sunAz), Math.cos(a - sunAz)));
  const gap = Math.exp(-((da / 0.22) ** 2));
  h *= 1 - gap * (L.r < 1550 ? 0.75 : 0.45);
  return h + 4 * Math.sin(t * Math.PI * 2 * 40);
}

export function buildRidges(ctx: WorldCtx): void {
  const look = ctx.look;
  const sun = new Vector3(-look.sun.dir.x, -look.sun.dir.y, -look.sun.dir.z);
  const sunAz = Math.atan2(sun.z, sun.x);
  const buf = new MeshBuf();
  const nrm = new Vector3(0, 0, 1), p = new Vector3();
  const rng = new Rng(0x91d6e);
  for (const L of LAYERS) {
    const n = new Noise2(L.seed + rng.int(0, 999));
    const front = new Color(L.col), back = new Color(L.back), col = new Color();
    const base = buf.count;
    for (let i = 0; i <= SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      const h = profile(n, L, a, sunAz);
      // Toward the sun the ranges turn into darker violet silhouettes.
      const facing = Math.max(0, Math.cos(a - sunAz));
      col.copy(front).lerp(back, facing * facing);
      buf.vert(p.set(Math.cos(a) * L.r, BOTTOM, Math.sin(a) * L.r), nrm, col);
      buf.vert(p.set(Math.cos(a) * L.r, h, Math.sin(a) * L.r), nrm, col);
    }
    for (let i = 0; i < SEGS; i++) {
      const a = base + i * 2;
      buf.quad(a, a + 2, a + 3, a + 1);
    }
  }
  const mat = ctx.own(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, depthWrite: false, depthTest: false, fog: false }));
  const mesh = new Mesh(ctx.own(buf.build()), mat);
  mesh.name = 'ridges';
  mesh.renderOrder = -98;
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  ctx.onUpdate((_dtSim, _dtReal, camera) => {
    mesh.position.copy(camera.position);
  });
}
