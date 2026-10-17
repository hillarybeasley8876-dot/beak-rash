// View-local effects that belong to the rider's animation (fx unit owns particles/post): dizzy stars
// that orbit a stunned rider's head, and a swing smear ribbon that trails the weapon/wing tip.
import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Shape, Vector3,
} from 'three';
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

const N = 12;

export class SwingSmear {
  readonly mesh: Mesh;
  private readonly base: Vector3[] = [];
  private readonly tip: Vector3[] = [];
  private readonly age: number[] = [];
  private readonly geo = new BufferGeometry();

  constructor(color = 0xffffff) {
    this.geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 2 * 3), 3));
    this.geo.setAttribute('color', new BufferAttribute(new Float32Array(N * 2 * 4), 4));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    this.geo.setIndex(idx);
    this.mesh = new Mesh(this.geo, new MeshBasicMaterial({ color, vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.mesh.userData.noOutline = true;
  }

  /** Feed the current blade (base → tip, parent space) while `active`; history fades over ~0.12 s. */
  update(base: Vector3, tip: Vector3, active: boolean, dt: number): void {
    for (let i = 0; i < this.age.length; i++) this.age[i] = (this.age[i] ?? 0) + dt;
    if (active) {
      this.base.unshift(base.clone());
      this.tip.unshift(tip.clone());
      this.age.unshift(0);
    }
    while (this.age.length > N || (this.age.length && (this.age[this.age.length - 1] ?? 0) > 0.12)) {
      this.age.pop(); this.base.pop(); this.tip.pop();
    }
    const n = this.age.length;
    this.mesh.visible = n >= 2;
    if (!this.mesh.visible) return;
    const pos = this.geo.getAttribute('position') as BufferAttribute, col = this.geo.getAttribute('color') as BufferAttribute;
    for (let i = 0; i < N; i++) {
      const j = Math.min(i, n - 1);
      const b = this.base[j] as Vector3, t = this.tip[j] as Vector3;
      const a = Math.max(0, 1 - (this.age[j] ?? 1) / 0.12) * (1 - j / N) * 0.8;
      pos.setXYZ(i * 2, b.x, b.y, b.z);
      pos.setXYZ(i * 2 + 1, t.x, t.y, t.z);
      col.setXYZW(i * 2, 1, 1, 1, a * 0.15);
      col.setXYZW(i * 2 + 1, 1, 1, 1, a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
