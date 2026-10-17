// STUB kept by core for isolation tests (?stub=...) and as load fallback. The track unit owns index.ts: a procedural curvy, hilly road so every other unit can run.
// Contract: createTrack(app, id, rng) → Track (core/contracts.ts).
import {
  BufferAttribute, BufferGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh,
  MeshLambertMaterial, PlaneGeometry, Vector3,
} from 'three';
import type { AppContext, Track } from '../core/contracts';
import type { Rng } from '../core/rng';
import type { EnvLook, Surface, TrackFrame, TrackId, Vec3Like } from '../core/types';

const STEP = 1;
const HALF = 7;

export async function createTrack(app: AppContext, id: TrackId, rng: Rng): Promise<Track> {
  void app;
  const length = 3000;
  const phase = rng.range(0, 10);
  const n = Math.floor(length / STEP) + 1;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n), head = new Float32Array(n);
  let x = 0, y = 0, z = 0, h = 0;
  const curv = (s: number): number =>
    s < 120 ? 0 : 0.0042 * Math.sin(s / 170 + phase) + 0.0028 * Math.sin(s / 61 + phase * 2);
  const elev = (s: number): number => 5 * Math.sin(s / 240 + phase) + 1.6 * Math.sin(s / 83);
  for (let i = 0; i < n; i++) {
    const s = i * STEP;
    px[i] = x; py[i] = elev(s); pz[i] = z; head[i] = h;
    h += curv(s) * STEP;
    x += Math.sin(h) * STEP;
    z -= Math.cos(h) * STEP;
    y = py[i] ?? 0;
  }
  void y;
  const frameAt = (sIn: number, out?: TrackFrame): TrackFrame => {
    const s = Math.min(Math.max(sIn, 0), length);
    const f = s / STEP;
    const i = Math.min(Math.floor(f), n - 2);
    const t = f - i;
    const lerp = (a: Float32Array): number => (a[i] ?? 0) * (1 - t) + (a[i + 1] ?? 0) * t;
    const hh = lerp(head);
    const slope = ((py[i + 1] ?? 0) - (py[i] ?? 0)) / STEP;
    const tan = new Vector3(Math.sin(hh), slope, -Math.cos(hh)).normalize();
    const right = new Vector3(Math.cos(hh), 0, Math.sin(hh)).normalize();
    const up = new Vector3().crossVectors(right, tan).normalize();
    const o = out ?? ({} as TrackFrame);
    o.s = s;
    o.pos = { x: lerp(px), y: lerp(py), z: lerp(pz) };
    o.tangent = tan; o.up = up; o.right = right;
    o.curvature = curv(s); o.slope = slope; o.bank = 0; o.halfWidth = HALF;
    return o;
  };
  const tmp = frameAt(0);
  const toWorld = (s: number, lx: number, ly: number, out: Vector3): Vector3 => {
    const fr = frameAt(s, tmp);
    return out.set(
      fr.pos.x + fr.right.x * lx + fr.up.x * ly,
      fr.pos.y + fr.right.y * lx + fr.up.y * ly,
      fr.pos.z + fr.right.z * lx + fr.up.z * ly,
    );
  };
  const project = (p: Vec3Like, hintS?: number): { s: number; x: number; y: number } => {
    let best = 0, bestD = Infinity;
    const lo = hintS === undefined ? 0 : Math.max(0, hintS - 40);
    const hi = hintS === undefined ? length : Math.min(length, hintS + 40);
    const stride = hintS === undefined ? 5 : 1;
    for (let s = lo; s <= hi; s += stride) {
      const i = Math.round(s / STEP);
      const d = ((px[i] ?? 0) - p.x) ** 2 + ((pz[i] ?? 0) - p.z) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    const fr = frameAt(best, tmp);
    const dx = p.x - fr.pos.x, dy = p.y - fr.pos.y, dz = p.z - fr.pos.z;
    return { s: best, x: dx * fr.right.x + dy * fr.right.y + dz * fr.right.z, y: dx * fr.up.x + dy * fr.up.y + dz * fr.up.z };
  };
  const group = new Group();
  group.name = `track:${id}:stub`;
  group.add(buildRoad(n, frameAt));
  const ground = new Mesh(new PlaneGeometry(6000, 6000), new MeshLambertMaterial({ color: '#6aa84f' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -8;
  group.add(ground);
  const sun = new DirectionalLight('#fff4e0', 2.2);
  sun.position.set(80, 120, 40);
  group.add(sun, new HemisphereLight('#bfe3ff', '#4b6b3a', 1.2));
  const look: EnvLook = {
    name: 'stub',
    sky: { top: '#4aa3ff', horizon: '#cfe9ff', bottom: '#88b46a' },
    fog: { color: '#cfe9ff', near: 150, far: 900 },
    sun: { dir: { x: -0.5, y: -0.8, z: -0.3 }, color: '#fff4e0', intensity: 2.2 },
    ambient: { sky: '#bfe3ff', ground: '#4b6b3a', intensity: 1.2 },
    grade: { saturation: 1.1, contrast: 1.05, tint: '#ffffff', bloom: 0.2, night: false },
  };
  app.scene.background = new Color(look.sky.horizon);
  app.scene.fog = new Fog(look.fog.color, look.fog.near, look.fog.far);
  return {
    id, length, look, group, features: [],
    frameAt, toWorld, project,
    bounds: () => ({ halfWidth: HALF, left: HALF + 4, right: HALF + 4, leftKind: 'grass', rightKind: 'grass' }),
    surfaceAt: (_s: number, lx: number): Surface => (Math.abs(lx) <= HALF ? 'road' : Math.abs(lx) <= HALF + 4 ? 'grass' : 'wall'),
    update: () => undefined,
    dispose: () => {
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
    },
  };
}

function buildRoad(n: number, frameAt: (s: number) => TrackFrame): Mesh {
  const rows = Math.floor(n / 2);
  const pos = new Float32Array(rows * 4 * 3);
  const col = new Float32Array(rows * 4 * 3);
  const idx: number[] = [];
  const xs = [-HALF - 4, -HALF, HALF, HALF + 4];
  const grass = new Color('#5f9e46'), asphalt = new Color('#55575e'), line = new Color('#f2f2f2');
  for (let r = 0; r < rows; r++) {
    const fr = frameAt(r * 2);
    xs.forEach((lx, k) => {
      const o = (r * 4 + k) * 3;
      pos[o] = fr.pos.x + fr.right.x * lx;
      pos[o + 1] = fr.pos.y + fr.right.y * lx + (k === 0 || k === 3 ? -0.05 : 0);
      pos[o + 2] = fr.pos.z + fr.right.z * lx;
      const c = k === 0 || k === 3 ? grass : r % 6 < 3 && (k === 1 || k === 2) ? asphalt : asphalt;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    });
    if (r > 0) {
      for (let k = 0; k < 3; k++) {
        const a = (r - 1) * 4 + k, b = a + 1, c = r * 4 + k, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  void line;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
}
