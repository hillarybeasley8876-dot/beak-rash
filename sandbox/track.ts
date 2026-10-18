// Track sandbox: build a track without the game and look at it.
//   /sandbox/track.html?track=coast&s=1200&x=2      chase-style view at s (5 m behind, 2.1 m up)
//   &view=aerial                                     overview of the whole track
//   &view=high&s=1500                                45° view from 60 m up near s
//   &fly=1                                           animated fly-through at 20 m/s
//   &sheet=0,400,800,…                               contact sheet of chase views (tiles)
// window.__trk = { ready, track, view(s, x, mode), stats(), rebuild(), pick(), rayX(), three, dispose() }
import { PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { Rng } from '../src/core/rng';
import type { AppContext, Track } from '../src/core/contracts';
import type { Quality, TrackId } from '../src/core/types';
import { createTrack } from '../src/world/track';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const quality = (params.get('quality') ?? 'high') as Quality;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
const scene = new Scene();
const camera = new PerspectiveCamera(66, 16 / 9, 0.1, 2400);

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

const app = { renderer, scene, camera, canvas, quality, params } as unknown as AppContext;

type Mode = 'chase' | 'aerial' | 'high' | 'side' | 'from';
const tmp = new Vector3(), look = new Vector3();
let fogBackup: Scene['fog'] = null;

function view(track: Track, s: number, x = 0, mode: Mode = 'chase'): void {
  // Aerial views see past the fog: switch it off and stretch the sea plane.
  const aerial = mode === 'aerial';
  scene.fog = aerial ? null : fogBackup;
  camera.far = aerial ? 12000 : 2400;
  camera.updateProjectionMatrix();
  const sea = track.group.getObjectByName('sea');
  if (sea) sea.scale.setScalar(aerial ? 5 : 1);
  if (aerial) {
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (let t = 0; t <= track.length; t += 50) {
      track.toWorld(t, 0, 0, tmp);
      box.minX = Math.min(box.minX, tmp.x); box.maxX = Math.max(box.maxX, tmp.x);
      box.minZ = Math.min(box.minZ, tmp.z); box.maxZ = Math.max(box.maxZ, tmp.z);
    }
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const span = Math.max(box.maxX - box.minX, box.maxZ - box.minZ);
    camera.position.set(cx + span * 0.55, span * 0.75, cz + span * 0.35);
    camera.lookAt(cx, 0, cz);
  } else if (mode === 'high') {
    track.toWorld(s - 40, x - 30, 60, camera.position);
    track.toWorld(s + 60, 0, 0, look);
    camera.lookAt(look);
  } else if (mode === 'side') {
    track.toWorld(s, x, 4, camera.position);
    track.toWorld(s + 2, 0, 1.5, look);
    camera.lookAt(look);
  } else if (mode === 'from') {
    // Camera at (s, x, 6) looking at a lateral offset `lx` (default 0) at s + 30.
    const lx = Number(params.get('lx') ?? 0), ly = Number(params.get('ly') ?? 2), ds = Number(params.get('ds') ?? 30);
    track.toWorld(s, x, Number(params.get('h') ?? 6), camera.position);
    track.toWorld(s + ds, lx, ly, look);
    camera.lookAt(look);
  } else {
    track.toWorld(Math.max(0, s - 5), x * 0.9, 2.1, camera.position);
    track.toWorld(s + 8, x * 0.7, 1, look);
    camera.lookAt(look);
  }
  camera.updateMatrixWorld();
  track.update(0, 1 / 60, camera);
  renderer.render(scene, camera);
  const info = renderer.info.render;
  hud.textContent = `${track.id} s=${s.toFixed(0)} x=${x} ${mode}  calls=${info.calls} tris=${info.triangles}`;
}

async function sheet(track: Track, list: number[]): Promise<void> {
  const out = document.getElementById('sheet') as HTMLCanvasElement;
  const cols = Math.ceil(Math.sqrt(list.length)), rows = Math.ceil(list.length / cols);
  const tw = Math.floor(window.innerWidth / cols), th = Math.floor(window.innerHeight / rows);
  renderer.setSize(tw, th, false);
  camera.aspect = tw / th;
  camera.updateProjectionMatrix();
  out.width = tw * cols;
  out.height = th * rows;
  out.style.display = 'block';
  const g = out.getContext('2d');
  if (!g) return;
  list.forEach((s, i) => {
    view(track, s, 2, 'chase');
    g.drawImage(renderer.domElement, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect((i % cols) * tw, Math.floor(i / cols) * th, 70, 18);
    g.fillStyle = '#fff';
    g.fillText(`s=${s}`, (i % cols) * tw + 6, Math.floor(i / cols) * th + 13);
  });
}

async function main(): Promise<void> {
  const id = (params.get('track') ?? 'coast') as TrackId;
  const track = await createTrack(app, id, new Rng(Number(params.get('seed') ?? 1)));
  scene.add(track.group);
  fogBackup = scene.fog;
  const s = Number(params.get('s') ?? 60), x = Number(params.get('x') ?? 2);
  const mode = (params.get('view') ?? 'chase') as Mode;
  const api = {
    ready: false, track,
    view: (sv: number, xv = 2, m: Mode = 'chase') => view(api.track, sv, xv, m),
    stats: () => ({ ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
    /** Dispose the track and build it again (leak test). */
    rebuild: async (): Promise<void> => {
      api.track.dispose();
      renderer.render(scene, camera);
      api.track = await createTrack(app, id, new Rng(2));
      scene.add(api.track.group);
    },
    /** Raycast through a screen pixel: names of the first hits (debugging stray geometry). */
    pick: (px: number, py: number): string[] => {
      const rc = new Raycaster();
      const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
      rc.setFromCamera(new Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), camera);
      return rc.intersectObject(api.track.group, true).slice(0, 4).map((i) => `${i.object.name}@${i.distance.toFixed(1)}`);
    },
    /** Lateral x of the first surface hit from track point (s, x, y) going sideways (`side` = ±1). */
    rayX: (sv: number, xv: number, yv: number, side: -1 | 1): { x: number; name: string } | null => {
      const f = api.track.frameAt(sv);
      const o = api.track.toWorld(sv, xv, yv, new Vector3());
      const dir = new Vector3(f.right.x, 0, f.right.z).normalize().multiplyScalar(side);
      const hit = new Raycaster(o, dir, 0, 40).intersectObject(api.track.group, true)[0];
      return hit ? { x: +(xv + side * hit.distance).toFixed(3), name: hit.object.name } : null;
    },
    /** three classes for page-side audits (sandbox/track.audit.mjs). */
    three: { Raycaster, Vector3 },
    /** Dispose only, then render once (memory should drop to the baseline). */
    dispose: (): void => {
      api.track.dispose();
      renderer.render(scene, camera);
    },
  };
  (window as unknown as { __trk: typeof api }).__trk = api;
  const sheetList = params.get('sheet');
  if (sheetList) await sheet(track, sheetList.split(',').map(Number));
  else if (params.get('fly') === '1') {
    let fs = s, last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fs = (fs + dt * 20) % track.length;
      track.update(dt, dt, camera);
      view(track, fs, x, 'chase');
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else view(track, s, x, mode);
  api.ready = true;
}

main().catch((err: unknown) => console.error('[track sandbox] failed', err));
