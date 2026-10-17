// Bikes sandbox: turntable / lineup / chase views of every bike, markers toggle, speed & steer sliders.
// Automation: window.__bikes.set({...}), .step(frames, dt), .stats(). URL params mirror the state keys.
import {
  CircleGeometry, Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, SphereGeometry, Vector3, WebGLRenderer, type Object3D,
} from 'three';
import { createBikeModel } from '../src/actors/bikes/model';
import type { BikeModel } from '../src/actors/bikes/types';
import type { BikeId, Quality } from '../src/core/types';
import { BIKE_ORDER } from '../src/data/bikes';
import { mountPanel, type SandboxState, VIEWS } from './bikes-ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new Scene();
scene.background = new Color('#cfe9ff');
const camera = new PerspectiveCamera(40, 1, 0.05, 200);
const sun = new DirectionalLight('#fff4e0', 2.2);
sun.position.set(80, 120, 40);
scene.add(sun, new HemisphereLight('#bfe3ff', '#4b6b3a', 1.2));

const ground = new Mesh(new CircleGeometry(60, 48), new MeshLambertMaterial({ color: '#9aa0a6' }));
ground.rotation.x = -Math.PI / 2;
const road = new Group();
const asphalt = new Mesh(new PlaneGeometry(7, 400), new MeshLambertMaterial({ color: '#4a4d55' }));
asphalt.rotation.x = -Math.PI / 2;
asphalt.position.y = 0.002;
road.add(asphalt);
const dashMat = new MeshBasicMaterial({ color: '#f4f2ec' });
const dashes: Mesh[] = [];
for (let i = 0; i < 40; i++) {
  const d = new Mesh(new PlaneGeometry(0.15, 2.2), dashMat);
  d.rotation.x = -Math.PI / 2;
  d.position.set(0.9, 0.004, -i * 5);
  dashes.push(d);
  road.add(d);
}
const ruler = new Group();
const rulerMat = new MeshBasicMaterial({ color: '#0b0b0f' }), tickMat = new MeshBasicMaterial({ color: '#e5191c' });
const pole = new Mesh(new CylinderGeometry(0.006, 0.006, 1.3, 6), rulerMat);
pole.position.y = 0.65;
ruler.add(pole);
for (const h of [0.5, 1.0, 1.3]) {
  const t = new Mesh(new CylinderGeometry(0.004, 0.004, 0.08, 4), tickMat);
  t.rotation.z = Math.PI / 2;
  t.position.y = h;
  ruler.add(t);
}
ruler.position.set(-0.55, 0, 0.25);
scene.add(ground, road, ruler);

const params = new URLSearchParams(location.search);
const state: SandboxState = {
  bike: (params.get('bike') as BikeId | null) ?? 'roadbike',
  view: (params.get('view') as SandboxState['view'] | null) ?? 'turntable',
  quality: (params.get('quality') as Quality | null) ?? 'high',
  tint: params.get('tint') ?? '',
  speed: Number(params.get('speed') ?? 6),
  steer: Number(params.get('steer') ?? 0),
  markers: params.get('markers') === '1',
  spin: params.get('spin') !== '0',
  angle: Number(params.get('angle') ?? 35),
  focus: params.get('focus')?.split(',').map(Number) ?? null,
  dist: Number(params.get('dist') ?? 1.2),
};
if (!VIEWS.includes(state.view)) state.view = 'turntable';

let bikes: BikeModel[] = [];
const markerBalls: Object3D[] = [];
const ballGeo = new SphereGeometry(0.018, 12, 8);
const ballMats: Record<string, MeshBasicMaterial> = {
  saddle: new MeshBasicMaterial({ color: '#ffe600', depthTest: false }),
  grip: new MeshBasicMaterial({ color: '#00e5ff', depthTest: false }),
  pedal: new MeshBasicMaterial({ color: '#ff2bd6', depthTest: false }),
  extra: new MeshBasicMaterial({ color: '#39ff14', depthTest: false }),
};

function addBalls(b: BikeModel): void {
  const m = b.markers as BikeModel['markers'] & { bell?: Object3D };
  const list: Array<[Object3D | undefined, string]> = [
    [m.saddle, 'saddle'], [m.gripL, 'grip'], [m.gripR, 'grip'], [m.pedalL, 'pedal'], [m.pedalR, 'pedal'],
    [m.basket, 'extra'], [m.rack, 'extra'], [m.stoker, 'extra'], [m.bell, 'extra'],
  ];
  for (const [o, kind] of list) {
    if (!o) continue;
    const ball = new Mesh(ballGeo, ballMats[kind]);
    ball.renderOrder = 10;
    o.add(ball);
    markerBalls.push(ball);
  }
}

function rebuild(): void {
  for (const b of bikes) b.dispose();
  bikes = [];
  markerBalls.length = 0;
  const many = state.view === 'lineup' || state.view === 'grid';
  const ids: BikeId[] = many ? BIKE_ORDER : [state.bike];
  ids.forEach((id, i) => {
    const b = createBikeModel(id, { quality: state.quality, tint: state.tint || undefined });
    if (state.view === 'lineup') {
      const row = i < 4 ? 0 : 1, col = row ? i - 4 : i;
      b.root.rotation.y = -Math.PI / 2;
      b.root.position.set(row ? (col - 1) * 2.25 + 0.2 : (col - 1.5) * 2.05, 0, row ? -1.9 : 0);
    } else if (state.view === 'grid') {
      b.root.position.set((i - 3) * 1.25, 0, -6);
    }
    addBalls(b);
    scene.add(b.root);
    bikes.push(b);
  });
  for (const ball of markerBalls) ball.visible = state.markers;
  ruler.visible = !many && state.view !== 'chase';
  road.visible = state.view === 'chase' || state.view === 'grid';
  caption.textContent = state.view === 'lineup' ? 'THE GARAGE · 7 BIKES' : state.view === 'grid' ? '6 M BEHIND · CHASE READ' : state.bike.toUpperCase();
}

const caption = document.getElementById('caption') as HTMLElement;
const target = new Vector3();
let roadOffset = 0, launchT = -1;

function placeCamera(): void {
  const a = (state.angle * Math.PI) / 180;
  const orbit = (dist: number, h: number, look: number): void => {
    camera.position.set(Math.sin(a) * dist, h, Math.cos(a) * dist);
    camera.lookAt(target.set(0, look, 0));
  };
  camera.fov = 40;
  if (state.focus && (state.view === 'turntable' || state.view === 'close')) {
    const [fx = 0, fy = 0.5, fz = 0] = state.focus;
    camera.position.set(fx + Math.sin(a) * state.dist, fy + state.dist * 0.25, fz + Math.cos(a) * state.dist);
    camera.lookAt(target.set(fx, fy, fz));
    camera.updateProjectionMatrix();
    return;
  }
  switch (state.view) {
    case 'turntable': orbit(2.9, 1.15, 0.45); break;
    case 'close': orbit(1.75, 0.95, 0.5); break;
    case 'side': camera.position.set(2.9, 0.55, 0); camera.lookAt(target.set(0, 0.48, 0)); break;
    case 'front': camera.position.set(0, 0.75, -2.6); camera.lookAt(target.set(0, 0.5, 0)); break;
    case 'back': camera.position.set(0, 0.75, 2.6); camera.lookAt(target.set(0, 0.5, 0)); break;
    case 'top': camera.position.set(0.001, 3.2, 0); camera.lookAt(target.set(0, 0, 0)); break;
    case 'lineup': camera.position.set(-0.9, 2.7, 7.6); camera.lookAt(target.set(-0.9, 0.35, -0.9)); break;
    case 'chase': camera.fov = 66; camera.position.set(0, 2.0, 6); camera.lookAt(target.set(0, 1, -7)); break;
    case 'grid': camera.fov = 66; camera.position.set(0, 2.0, 0); camera.lookAt(target.set(0, 1, -13)); break;
  }
  camera.updateProjectionMatrix();
}

function advance(dt: number): void {
  if (state.spin && (state.view === 'turntable' || state.view === 'close')) state.angle = (state.angle + dt * 25) % 360;
  if (launchT >= 0) launchT += dt;
  const speed = launchT >= 0 ? state.speed * Math.min(1, launchT / 3) : state.speed;
  roadOffset = (roadOffset + speed * dt) % 5;
  dashes.forEach((d, i) => { d.position.z = -i * 5 + roadOffset + 20; });
  for (const b of bikes) b.update(dt, speed, state.steer);
}

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function render(): void {
  placeCamera();
  renderer.render(scene, camera);
}

function stats(): Record<string, unknown> {
  const b = bikes[0];
  if (!b) return {};
  const local = (o: Object3D): number[] => b.root.worldToLocal(o.getWorldPosition(new Vector3())).toArray().map((n) => +n.toFixed(3));
  const dist = (p: Object3D, q: Object3D): number => +p.getWorldPosition(new Vector3()).distanceTo(q.getWorldPosition(new Vector3())).toFixed(3);
  const tris = bikes.reduce((n, x) => n + ((x.root.userData.tris as number | undefined) ?? 0), 0);
  return {
    bike: b.id, calls: renderer.info.render.calls, rendererTris: renderer.info.render.triangles, tris,
    saddle: local(b.markers.saddle), gripL: local(b.markers.gripL), gripR: local(b.markers.gripR),
    pedalL: local(b.markers.pedalL), pedalR: local(b.markers.pedalR), crank: +b.crankAngle.toFixed(3),
    saddleToPedalR: dist(b.markers.saddle, b.markers.pedalR), saddleToGripR: dist(b.markers.saddle, b.markers.gripR),
    wheelRadius: b.wheelRadius, wheelbase: b.wheelbase,
  };
}

/** Animation probe for automated checks: wheel/crank angles, pedal levelness, steering-axis geometry. */
function probe(): Record<string, unknown> {
  const b = bikes[0];
  if (!b) return {};
  b.root.updateMatrixWorld(true);
  const rootQ = b.root.getWorldQuaternion(new Quaternion());
  const node = (n: string): Object3D | undefined => b.root.getObjectByName(n);
  const wq = (o: Object3D | undefined): Quaternion => o ? o.getWorldQuaternion(new Quaternion()) : new Quaternion();
  const wp = (o: Object3D | undefined): Vector3 => o ? o.getWorldPosition(new Vector3()) : new Vector3();
  const headset = node('headset'), hub = node('wheelF');
  const axisDir = new Vector3(0, 1, 0).applyQuaternion(wq(headset));
  const toHub = wp(hub).sub(wp(headset));
  const hubFromAxis = toHub.clone().sub(axisDir.clone().multiplyScalar(toHub.dot(axisDir))).length();
  const wheel = wq(node('wheelR'));
  return {
    crank: b.crankAngle,
    wheelAngle: 2 * Math.atan2(-wheel.x, wheel.w),
    pedalTiltL: wq(b.markers.pedalL).angleTo(rootQ), pedalTiltR: wq(b.markers.pedalR).angleTo(rootQ),
    pedalL: wp(b.markers.pedalL).toArray(), pedalR: wp(b.markers.pedalR).toArray(),
    gripL: wp(b.markers.gripL).toArray(), gripR: wp(b.markers.gripR).toArray(),
    hubF: wp(hub).toArray(), hubFromAxis, saddle: wp(b.markers.saddle).toArray(),
  };
}

let last = performance.now(), manual = params.get('manual') === '1';
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!manual) advance(dt);
  render();
  panel.refresh(stats());
  requestAnimationFrame(loop);
}

const panel = mountPanel(document.getElementById('panel') as HTMLElement, state, (rebuildNeeded) => {
  if (rebuildNeeded) rebuild();
  for (const ball of markerBalls) ball.visible = state.markers;
}, () => { launchT = 0; });

declare global {
  interface Window {
    __bikes?: {
      state: SandboxState; ready: boolean;
      set(p: Partial<SandboxState>): void; step(frames: number, dt?: number): void; stats(): Record<string, unknown>;
      /** Ramp speed 0 → state.speed over 3 s (balance-bike paddle test); call again to restart. */
      launch(): void;
      probe(): Record<string, unknown>;
    };
  }
}
window.__bikes = {
  state,
  set(p) {
    const rb = ['bike', 'view', 'quality', 'tint'].some((k) => k in p && p[k as keyof SandboxState] !== state[k as keyof SandboxState]);
    Object.assign(state, p);
    if (rb) rebuild();
    for (const ball of markerBalls) ball.visible = state.markers;
    panel.sync();
  },
  step(frames, dt = 1 / 60) {
    manual = true;
    for (let i = 0; i < frames; i++) advance(dt);
    render();
  },
  stats,
  launch() { launchT = 0; },
  probe,
  ready: false,
};
window.addEventListener('resize', resize);
resize();
rebuild();
requestAnimationFrame(loop);
window.__bikes.ready = true;
