// The meshes of the easter eggs (SPEC §21): a rubber duck, an easel with a wrong flat "SVG" pelican on it and
// the cloud pelican god. Toon materials + ink outlines, chunky toy shapes (SPEC §5).
import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  SphereGeometry, SRGBColorSpace, TorusGeometry,
} from 'three';
import { outline, toon } from '../../render/toon';
import { SECRET_LINES } from '../../data/secret-lines';

const DUCK_YELLOW = '#ffd23f';
const DUCK_BEAK = '#ff8c1a';
const INK = '#0b0b0f';
const WOOD = '#a9713c';
const CANVAS_BG = '#f6f1e4';

/** The rubber duck: a yellow body, an orange beak, black eyes (SPEC §5's chunky toy look). */
export function buildDuck(): Group {
  const g = new Group();
  const yellow = toon(DUCK_YELLOW);

  const body = new Mesh(new SphereGeometry(0.15, 18, 14), yellow);
  body.scale.set(1, 0.9, 1.3);
  body.position.set(0, 0.135, 0);
  g.add(body);

  const tail = new Mesh(new ConeGeometry(0.055, 0.13, 10), yellow);
  tail.rotation.x = -1.15;
  tail.position.set(0, 0.16, -0.17);
  g.add(tail);

  const head = new Mesh(new SphereGeometry(0.095, 16, 12), yellow);
  head.position.set(0, 0.265, 0.1);
  g.add(head);

  const beak = new Mesh(new BoxGeometry(0.07, 0.045, 0.12), toon(DUCK_BEAK));
  beak.position.set(0, 0.255, 0.215);
  beak.rotation.x = 0.12;
  g.add(beak);

  for (const sx of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.019, 8, 8), toon(INK));
    eye.position.set(sx * 0.055, 0.295, 0.155);
    g.add(eye);
  }

  outline(g, 0.02);
  return g;
}

/** The picture on the easel: a deliberately wrong flat "SVG" pelican on a bicycle (mismatched wheels). */
function pictureTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const g = canvas.getContext('2d');
  if (!g) return null;   // no 2d context: the easel gets a blank canvas instead of breaking the race
  g.fillStyle = CANVAS_BG;
  g.fillRect(0, 0, canvas.width, canvas.height);

  // A bicycle with two wheels of different sizes (the joke).
  g.strokeStyle = INK;
  g.lineWidth = 9;
  g.beginPath();
  g.arc(140, 250, 68, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(370, 250, 44, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(140, 250);
  g.lineTo(250, 160);
  g.lineTo(370, 250);
  g.moveTo(250, 160);
  g.lineTo(330, 140);
  g.moveTo(330, 140);
  g.lineTo(370, 250);
  g.moveTo(300, 160);
  g.lineTo(300, 235);
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(272, 128, 58, 14);
  g.fillRect(312, 118, 44, 10);

  // The pelican: a flat circle body, a circle head, a big triangle beak and a pouch.
  g.fillStyle = '#ffffff';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(255, 150, 74, 58, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(300, 78, 34, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = DUCK_BEAK;
  g.beginPath();
  g.moveTo(330, 70);
  g.lineTo(420, 84);
  g.lineTo(332, 96);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#ffb066';
  g.beginPath();
  g.ellipse(305, 112, 26, 17, 0.1, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // The chain, drawn from the crank straight to the pelican's neck (that is the joke).
  g.strokeStyle = '#7a7a86';
  g.lineWidth = 10;
  g.setLineDash([14, 8]);
  g.beginPath();
  g.moveTo(300, 168);
  g.lineTo(288, 120);
  g.stroke();
  g.setLineDash([]);

  // The caption of the original prompt.
  g.fillStyle = INK;
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'center';
  g.fillText(SECRET_LINES.caption, 256, 350);
  g.font = '15px sans-serif';
  g.fillText('(why is the chain on its neck?)', 256, 374);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** The SVG easel: a wooden tripod with the wrong picture on it. */
export function buildEasel(): { group: Group; texture: CanvasTexture | null; picture: MeshBasicMaterial } {
  const g = new Group();
  const wood = toon(WOOD);

  for (const [x, z, tilt] of [[-0.42, 0.16, 0.16], [0.42, 0.16, -0.16], [0, -0.34, 0]]) {
    const leg = new Mesh(new CylinderGeometry(0.035, 0.045, 1.9, 8), wood);
    leg.position.set(x, 0.92, z);
    leg.rotation.z = tilt;
    leg.rotation.x = -z * 0.5;
    g.add(leg);
  }
  const tray = new Mesh(new BoxGeometry(1.1, 0.06, 0.16), wood);
  tray.position.set(0, 1.05, 0.1);
  g.add(tray);

  const texture = pictureTexture();
  const picture = new MeshBasicMaterial({ map: texture ?? undefined, color: texture ? '#ffffff' : CANVAS_BG });
  const frame = new Mesh(
    new BoxGeometry(1.3, 0.98, 0.05),
    [wood, wood, wood, wood, picture, wood],
  );
  frame.position.set(0, 1.72, 0.06);
  g.add(frame);

  outline(g, 0.04);
  return { group: g, texture, picture };
}

/** The pelican god: soft cloud blobs shaped like a pelican, drawn in the sky without fog. */
export function buildGod(): Group {
  const g = new Group();
  const cloud = toon('#f2f4f8').clone();
  cloud.fog = false;
  cloud.transparent = true;
  cloud.opacity = 0.9;
  const shade = toon('#d6dbe4').clone();
  shade.fog = false;
  shade.transparent = true;
  shade.opacity = 0.9;

  const blobs: Array<[number, number, number, number, 'c' | 's']> = [
    [0, 0, 0, 4.6, 'c'], [-3.4, -0.6, 0.4, 3.2, 'c'], [3.2, -0.4, -0.6, 3.6, 'c'],
    [0.4, 2.4, 0.8, 3.0, 's'], [-1.8, 1.8, 1.6, 2.2, 's'],
  ];
  for (const [x, y, z, r, kind] of blobs) {
    const m = new Mesh(new SphereGeometry(r, 16, 12), kind === 'c' ? cloud : shade);
    m.position.set(x, y, z);
    g.add(m);
  }

  const head = new Mesh(new SphereGeometry(2.6, 16, 12), cloud);
  head.position.set(0, 4.6, 1.2);
  g.add(head);

  const beakMat = toon('#f0a04b').clone();
  beakMat.fog = false;
  beakMat.transparent = true;
  beakMat.opacity = 0.92;
  const beak = new Mesh(new ConeGeometry(1.5, 5.4, 12), beakMat);
  beak.rotation.z = -Math.PI / 2;
  beak.rotation.y = 0.12;
  beak.position.set(3.4, 4.2, 1.2);
  g.add(beak);

  const pouch = new Mesh(new SphereGeometry(1.7, 14, 10), shade);
  pouch.scale.set(1, 0.7, 1);
  pouch.position.set(2.6, 2.9, 1.0);
  g.add(pouch);

  const halo = new Mesh(new TorusGeometry(5.2, 0.35, 8, 24), cloud);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 1.4, 0);
  g.add(halo);

  return g;
}
