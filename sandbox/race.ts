// Race sandbox: turntable gallery of the traffic vehicles (instanced exactly as in races), with
// blinkers/brake lights toggling and wheels spinning. Screenshot via tools/race-gallery.mjs.
import {
  Color, DirectionalLight, HemisphereLight, Matrix4, Mesh, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry,
  Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { TrafficRender } from '../src/gameplay/race/traffic/render';
import { VEHICLES, VEHICLE_TYPES, type VehicleType } from '../src/gameplay/race/traffic/types';

declare global {
  interface Window { sandboxReady?: boolean; sandboxRender?: (t: number) => void }
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = SRGBColorSpace;
const scene = new Scene();
scene.background = new Color('#9fd3ff');
const sun = new DirectionalLight('#fff4e0', 2.4);
sun.position.set(30, 50, 20);
scene.add(sun, new HemisphereLight('#cfe9ff', '#7a6a50', 1.25));
const ground = new Mesh(new PlaneGeometry(200, 200), new MeshLambertMaterial({ color: '#55575e' }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const only = params.get('type') as VehicleType | null;
const types = only ? [only] : VEHICLE_TYPES;
const night = params.get('night') === '1';
if (night) {
  scene.background = new Color('#1b1440');
  sun.intensity = 0.35;
}
const traffic = new TrafficRender('V我50 小鱼干', night);
scene.add(traffic.group);
const view = params.get('view') ?? 'row';
const sideways = view === 'side';
const total = types.reduce((a, t) => a + VEHICLES[t].length + 2, -2);
let cursor = -total / 2;
const placed = types.map((type, i) => {
  const slots = traffic.alloc(type, VEHICLES[type].palette[i % VEHICLES[type].palette.length] ?? '#ffffff');
  if (!slots) throw new Error(`no slot for ${type}`);
  const z = cursor + VEHICLES[type].length / 2;
  cursor += VEHICLES[type].length + 2;
  return { type, slots, x: sideways ? 0 : (i - (types.length - 1) / 2) * 4.2, z: sideways ? z : 0 };
});

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 500);
const angle = Number(params.get('angle') ?? 35) * (Math.PI / 180);
const body = new Matrix4();
const q = new Quaternion();

function draw(t: number): void {
  placed.forEach((p, i) => {
    body.compose(new Vector3(p.x, 0, p.z), q, new Vector3(1, 1, 1));
    const phase = Math.floor(t * 2.6) % 2 === 0;
    traffic.pose(p.type, p.slots[0], p.slots[1], { body, wheelAngle: t * 6, blinkL: phase && i % 2 === 0, blinkR: phase && i % 2 === 1, braking: i % 3 === 0 });
  });
  traffic.commit();
  const span = sideways ? total * 1.25 : Math.max(8, types.length * 4.2);
  const dist = only ? 12 : span * 1.05;
  const dirs: Record<string, Vector3> = {
    row: new Vector3(Math.sin(angle), 0.45, Math.cos(angle)),
    front: new Vector3(-0.6, 0.35, -1), back: new Vector3(0.4, 0.3, 1), side: new Vector3(1, 0.12, 0), top: new Vector3(0, 1, 0.01),
  };
  const dir = (dirs[view] ?? dirs.row as Vector3).clone().normalize();
  camera.position.copy(dir.multiplyScalar(dist)).add(new Vector3(0, 1.2, 0));
  camera.lookAt(0, 1.2, 0);
  renderer.render(scene, camera);
}

window.sandboxRender = draw;
draw(0.3);
window.sandboxReady = true;
