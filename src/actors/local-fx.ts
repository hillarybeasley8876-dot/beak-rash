// View-local effects that belong to the rider's animation (fx unit owns particles/post): dizzy stars
// that orbit a stunned rider's head and the shades/eye glint beat of a pose (doge shield, sloth flash).
// The swing smear lives in smear.ts, the zen steam in steam.ts.
import { AdditiveBlending, BufferGeometry, CanvasTexture, Group, Mesh, Shape, Sprite, SpriteMaterial, Vector3 } from 'three';
import { toon } from '../render/toon';
import { CharacterBuilder } from './kit/builder';
import { hullFor } from './kit/outline';
import { extrudeSmooth } from './kit/shapes';

let starGeo: BufferGeometry | null = null;

function starsGeometry(): BufferGeometry {
  if (starGeo) return starGeo;
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 === 0 ? 0.045 : 0.02;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const b = new CharacterBuilder();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const g = extrudeSmooth(s, { depth: 0.014, bevel: 0.4, curveSegments: 1, bevelSegments: 1 });
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.17, Math.sin(a * 2) * 0.025, Math.sin(a) * 0.17);
    b.part({ geometry: g, color: i % 2 ? 0xffe600 : 0xfff6a0, bone: 0, outline: 0.6 });
    g.dispose();
  }
  starGeo = b.build();
  return starGeo;
}

export class DizzyStars {
  readonly group = new Group();
  private amount = 0;

  constructor() {
    const mesh = new Mesh(starsGeometry(), toon('#ffffff', { vertexColors: true, emissive: '#5a4a00', emissiveIntensity: 0.6 }));
    mesh.add(hullFor(mesh, 0.012));
    this.group.add(mesh);
    this.group.visible = false;
  }

  /** `head` in the parent's space; `on` while stunned. */
  update(head: Vector3, on: boolean, dt: number): void {
    this.amount = Math.max(0, Math.min(1, this.amount + (on ? dt * 6 : -dt * 4)));
    this.group.visible = this.amount > 0.01;
    if (!this.group.visible) return;
    this.group.position.copy(head).add(new Vector3(0, 0.2, 0));
    this.group.rotation.y += dt * 5.5;
    this.group.rotation.z = Math.sin(this.group.rotation.y * 0.7) * 0.15;
    this.group.scale.setScalar(0.4 + 0.6 * this.amount);
  }
}

let glintTex: CanvasTexture | null = null;

/** 4-point sparkle drawn once into a small canvas texture. */
function glintTexture(): CanvasTexture {
  if (glintTex) return glintTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,250,200,0.9)');
    grad.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 === 0 ? 31 : 5;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }
  glintTex = new CanvasTexture(c);
  return glintTex;
}

export class Glint {
  readonly sprite = new Sprite(new SpriteMaterial({ map: glintTexture(), blending: AdditiveBlending, depthTest: false, transparent: true }));
  private spin = 0;

  constructor() {
    this.sprite.visible = false;
    this.sprite.renderOrder = 3;
    this.sprite.userData.noOutline = true;
  }

  /** `at` in the parent's space; k = 0..1 strength of the beat. */
  update(at: Vector3, k: number, dt: number): void {
    this.sprite.visible = k > 0.02;
    if (!this.sprite.visible) return;
    this.spin += dt * 3;
    this.sprite.position.copy(at);
    this.sprite.scale.setScalar(0.16 * k);
    (this.sprite.material as SpriteMaterial).rotation = this.spin;
  }

  dispose(): void {
    (this.sprite.material as SpriteMaterial).dispose();
  }
}
