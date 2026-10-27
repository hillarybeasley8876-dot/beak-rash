// Actors sandbox: riders on bikes driven by a fake RiderState (treadmill). Modes: ride (one rider),
// gallery (whole roster). Scripting: window.__actors (set/cue/crash/step) for screenshots.
// URL: ?mode=ride|gallery&c=pelican&bike=roadbike|default&speed=8&lean=0&view=34|front|side|back|chase&dist=3
import {
  Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { captureErrors } from '../src/core/debug';
import type { AppContext } from '../src/core/contracts';
import { EventBus } from '../src/core/events';
import type { GameEvents } from '../src/core/events-map';
import { createRiderState } from '../src/core/rider';
import type { BikeId, CharacterId, Quality, RiderState } from '../src/core/types';
import { RiderViewImpl } from '../src/actors/view';
import { ROSTER } from '../src/data/roster';

export const errors = captureErrors();
export const P = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
export const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
export const scene = new Scene();
scene.background = new Color('#9fd3f0');
export const cam = new PerspectiveCamera(35, 1, 0.05, 300);
const sun = new DirectionalLight('#fff4e0', 2.3);
sun.position.set(4, 7, 3);
scene.add(sun, new HemisphereLight('#d4ecff', '#6f6a55', 1.2));
const ground = new Mesh(new PlaneGeometry(400, 400), new MeshLambertMaterial({ color: '#8d9a78' }));
ground.rotation.x = -Math.PI / 2;
const grid = new GridHelper(400, 200, '#6c7a5c', '#7c8a68');
grid.position.y = 0.002;
scene.add(ground, grid);
const quality = (P.get('quality') ?? 'high') as Quality;
export const app = { quality, params: P, bus: new EventBus<GameEvents>() } as unknown as AppContext;

export const ROSTER_IDS: CharacterId[] = [
  'pelican', 'goose', 'capybara', 'cat', 'shiba', 'pigeon', 'penguin', 'seagull', 'sloth', 'corgi',
  'bananacat', 'cryingcat', 'xinxian', 'moodeng', 'pedro', 'hamster',
];

export interface Bench { view: RiderViewImpl; state: RiderState; base: Vector3 }
export const riders: Bench[] = [];
export const S = {
  mode: P.get('mode') ?? 'ride', character: (P.get('c') ?? 'pelican') as CharacterId, bike: (P.get('bike') ?? 'roadbike') as BikeId | 'default',
  speed: Number(P.get('speed') ?? 8), lean: Number(P.get('lean') ?? 0), weave: P.get('weave') === '1', scale: Number(P.get('ts') ?? 1),
  view: P.get('view') ?? '34', dist: Number(P.get('dist') ?? 3.2), t: 0,
};

export function spawn(): void {
  for (const r of riders) r.view.dispose();
  riders.length = 0;
  const ids = S.mode === 'gallery' ? ROSTER_IDS : [S.character];
  ids.forEach((id, i) => {
    const bike = S.bike === 'default' ? ROSTER[id].defaultBike : S.bike;
    const view = new RiderViewImpl(app, id, bike, { isPlayer: id === 'pelican', quality });
    const state = createRiderState(i, id, bike, i === 0);
    state.mode = 'racing';
    const base = S.mode === 'gallery' ? new Vector3(((i % 5) - 2) * 1.5, 0, Math.floor(i / 5) * 2.6 - 1.3) : new Vector3();
    riders.push({ view, state, base });
    scene.add(view.root);
  });
  placeCamera();
}

export const controls = new OrbitControls(cam, canvas);
controls.autoRotate = P.get('turntable') === '1';
controls.autoRotateSpeed = 1.6;
const VIEWS: Record<string, [number, number, number]> = {
  front: [0, 0.18, -1], back: [0, 0.25, 1], side: [-1, 0.12, 0], right: [1, 0.12, 0], top: [0, 1, 0.01],
  '34': [-0.8, 0.32, -0.75], '34b': [-0.7, 0.4, 0.8], chase: [0, 0.38, 1], r34: [0.8, 0.32, -0.75], r34b: [0.75, 0.35, 0.8],
};

export function placeCamera(): void {
  const gallery = S.mode === 'gallery';
  const ty = Number(P.get('ty') ?? (gallery ? 0.8 : 1.05));
  const tx = gallery ? 0 : Number(P.get('tx') ?? 0);
  controls.target.set(tx, ty, gallery ? 0 : Number(P.get('tz') ?? -0.2));
  const d = VIEWS[S.view] ?? VIEWS['34'] ?? [0, 0, 1];
  const L = Math.hypot(...d), dist = gallery ? Math.max(S.dist, 8) : S.dist;
  cam.position.set(tx + (d[0] / L) * dist, ty + (d[1] / L) * dist, controls.target.z + (d[2] / L) * dist);
  controls.update();
}

export function resize(): void {
  renderer.setSize(innerWidth, innerHeight, false);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
