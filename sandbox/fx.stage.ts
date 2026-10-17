// fx sandbox stage: a small toon road scene (day / night) to test particles and post in isolation.
import {
  BoxGeometry, CapsuleGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer,
} from 'three';
import { outline, toon } from '../src/render/toon';

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  riders: Group[];
  setNight(on: boolean): void;
}

function rider(color: string, accent: string, x: number, z: number): Group {
  const g = new Group();
  const body = new Mesh(new CapsuleGeometry(0.32, 0.6, 6, 14), toon(color));
  body.position.set(0, 1.45, 0.1);
  body.rotation.x = -0.4;
  const head = new Mesh(new CapsuleGeometry(0.2, 0.1, 6, 12), toon(color));
  head.position.set(0, 2.05, -0.35);
  const frame = new Mesh(new BoxGeometry(0.08, 0.5, 1.2), toon(accent));
  frame.position.set(0, 0.7, 0);
  g.add(body, head, frame);
  outline(g, 0.025);
  g.position.set(x, 0, z);
  return g;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(62, 16 / 9, 0.1, 800);
  camera.position.set(0, 2.3, 6.5);
  camera.lookAt(0, 1.1, -5);
  const hemi = new HemisphereLight('#dff1ff', '#6b8f4e', 1.4);
  const sun = new DirectionalLight('#fff4dc', 2.2);
  sun.position.set(30, 60, 20);
  scene.add(hemi, sun);
  const road = new Mesh(new PlaneGeometry(12, 400), toon('#4a4d57'));
  road.rotation.x = -Math.PI / 2;
  road.position.z = -150;
  const grass = new Mesh(new PlaneGeometry(400, 400), toon('#6aa84f'));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.02, -150);
  scene.add(road, grass);
  for (let i = 0; i < 40; i++) {
    const dash = new Mesh(new BoxGeometry(0.18, 0.02, 2.2), toon('#f4f1ea'));
    dash.position.set(0, 0.01, 4 - i * 6);
    scene.add(dash);
  }
  const riders = [rider('#f4f1ea', '#e5191c', -2.4, -6), rider('#ffffff', '#222222', 0.2, -9), rider('#a8754a', '#ffb000', 2.6, -7)];
  scene.add(...riders);
  const neonMat = new MeshBasicMaterial({ color: new Color(3.2, 0.25, 2.2) });
  const neon2 = new MeshBasicMaterial({ color: new Color(0.2, 2.4, 3.0) });
  const signs: Mesh[] = [];
  [[-7, neonMat], [7, neon2]].forEach(([x, m], i) => {
    const sign = new Mesh(new BoxGeometry(0.3, 3, 6), m as MeshBasicMaterial);
    sign.position.set(x as number, 3.5, -18 - i * 10);
    signs.push(sign);
    scene.add(sign);
  });
  const setNight = (on: boolean): void => {
    scene.background = new Color(on ? '#141433' : '#bfe6ff');
    scene.fog = new Fog(on ? '#1b1640' : '#d9f0ff', 30, on ? 160 : 260);
    hemi.intensity = on ? 0.45 : 1.4;
    sun.intensity = on ? 0.35 : 2.2;
    sun.color.set(on ? '#7a6cff' : '#fff4dc');
    for (const s of signs) s.visible = on;
  };
  setNight(false);
  return { renderer, scene, camera, riders, setNight };
}
