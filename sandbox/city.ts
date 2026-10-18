// City view bench: builds a track (default city) without the game and renders camera views given in
// track space, tiled into one sheet. Used by sandbox/city.views.mjs.
//   /sandbox/city.html?track=city&views=s,x,h,ls,lx,ly;…   camera at (s, x, h) looking at (ls, lx, ly)
// window.__city = { ready, sheet(views): stats[] }
import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { Rng } from '../src/core/rng';
import type { AppContext, Track } from '../src/core/contracts';
import type { Quality, TrackId } from '../src/core/types';
import { createTrack } from '../src/world/track';

type View = [number, number, number, number, number, number];

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const out = document.getElementById('sheet') as HTMLCanvasElement;
const quality = (params.get('quality') ?? 'high') as Quality;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
const scene = new Scene();
const camera = new PerspectiveCamera(Number(params.get('fov') ?? 62), 16 / 9, 0.1, 2400);
const app = { renderer, scene, camera, canvas, quality, params } as unknown as AppContext;
const eye = new Vector3(), look = new Vector3();

function render(track: Track, v: View, t: number): { calls: number; tris: number } {
  const [s, x, h, ls, lx, ly] = v;
  track.toWorld(s, x, h, eye);
  track.toWorld(ls, lx, ly, look);
  camera.position.copy(eye);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  track.update(t, 1 / 60, camera);
  renderer.render(scene, camera);
  return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
}

function sheet(track: Track, views: View[]): Array<{ calls: number; tris: number }> {
  const cols = Math.ceil(Math.sqrt(views.length)), rows = Math.ceil(views.length / cols);
  const tw = Math.floor(window.innerWidth / cols), th = Math.floor(window.innerHeight / rows);
  renderer.setSize(tw, th, false);
  camera.aspect = tw / th;
  camera.updateProjectionMatrix();
  out.width = tw * cols;
  out.height = th * rows;
  out.style.display = 'block';
  const g = out.getContext('2d');
  if (!g) throw new Error('[env-city] 2D canvas unavailable');
  return views.map((v, i) => {
    const st = render(track, v, i === 0 ? 0.5 : 0);
    const px = (i % cols) * tw, py = Math.floor(i / cols) * th;
    g.drawImage(renderer.domElement, px, py, tw, th);
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(px, py, 230, 18);
    g.fillStyle = '#fff';
    g.font = '12px monospace';
    g.fillText(`${v.join(',')} c=${st.calls} t=${Math.round(st.tris / 1000)}k`, px + 6, py + 13);
    return st;
  });
}

async function main(): Promise<void> {
  const id = (params.get('track') ?? 'city') as TrackId;
  const track = await createTrack(app, id, new Rng(Number(params.get('seed') ?? 1)));
  scene.add(track.group);
  const api = { ready: true, track, sheet: (views: View[]) => sheet(track, views) };
  (window as unknown as { __city: typeof api }).__city = api;
}

main().catch((err: unknown) => console.error('[env-city] city bench failed', err));
