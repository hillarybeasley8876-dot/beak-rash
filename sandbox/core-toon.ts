// Core check: toon() + outline() compile and render on plain meshes.
import { DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera, Scene, SphereGeometry, TorusKnotGeometry, WebGLRenderer } from 'three';
import { outline, toon } from '../src/render/toon';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight, false);
const scene = new Scene();
const cam = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
cam.position.set(0, 1, 6);
cam.lookAt(0, 0, 0);
scene.add(new HemisphereLight('#cfe9ff', '#55606a', 1), new DirectionalLight('#fff', 2.5));
const a = new Mesh(new TorusKnotGeometry(0.8, 0.28, 128, 16), toon('#e5191c'));
a.position.x = -1.3;
const b = new Mesh(new SphereGeometry(0.9, 32, 16), toon('#f4f1ea'));
b.position.x = 1.3;
scene.add(a, b);
outline(a, 0.03);
outline(b, 0.03);
renderer.render(scene, cam);
const gl = renderer.getContext();
(window as unknown as { __toonOk: boolean }).__toonOk = gl.getError() === gl.NO_ERROR;
