// Shared prop helpers for the track events (SPEC §19): toon meshes with ink outlines, a pool that draws
// the same prop many times (barriers, cones, geese) and a canvas sign face. Built from the race unit's own
// geometry kit, so the events look like the traffic and the police.
import {
  CanvasTexture, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { outline, outlineMaterial, toon } from '../../../render/toon';
import { box, merge } from '../traffic/kit';

const INK = '#0b0b0f';

/** One toon prop: merged vertex-coloured geometry with an ink outline. */
export function propMesh(parts: BufferGeometry[], outlineWidth = 0.04): Mesh {
  const geo = merge(parts);
  const mesh = new Mesh(geo, toon('#ffffff', { vertexColors: true }));
  mesh.castShadow = true;
  outline(mesh, outlineWidth);
  return mesh;
}

/** Take a prop group off the scene and free its geometries. */
export function disposeProp(group: Group): void {
  group.removeFromParent();
  group.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

/** Many copies of one prop in a single draw call (plus its outline hull). */
export class PropPool {
  readonly mesh: InstancedMesh;
  private readonly hull: InstancedMesh;
  private used = 0;

  constructor(parts: BufferGeometry[], readonly cap: number, outlineWidth = 0.04) {
    const geo = merge(parts);
    this.mesh = new InstancedMesh(geo, toon('#ffffff', { vertexColors: true }), cap);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.hull = new InstancedMesh(geo, outlineMaterial(INK, outlineWidth), cap);
    this.hull.instanceMatrix = this.mesh.instanceMatrix;
    this.hull.frustumCulled = false;
  }

  /** Reserve a slot; -1 when the pool is full. */
  alloc(): number {
    if (this.used >= this.cap) return -1;
    return this.used++;
  }

  /** Start the pool over (for a pool whose content is rebuilt every frame). */
  reset(): void {
    this.used = 0;
  }

  /** Place a reserved slot (the pool grows to cover it, so a direct `set` also counts as used). */
  set(slot: number, matrix: Matrix4): void {
    this.mesh.setMatrixAt(slot, matrix);
    if (slot >= this.used) this.used = slot + 1;
  }

  /** Upload this frame's instance matrices (and draw only the slots in use). */
  commit(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    // An unused slot keeps the identity matrix: drawn, it stacks a copy of the prop on the world origin
    // (the flickering clutter the players saw). Only the used slots are drawn.
    this.mesh.count = this.used;
    this.hull.count = this.used;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.hull.dispose();
  }
}

/** A yellow road-work sign: the painted face on a toon board, facing the oncoming rider (+Z in model space). */
export function signProp(text: string, width: number, height: number, postHeight: number): Group {
  const group = new Group();
  const { mesh, texture } = signFace(text, width, height);
  group.add(mesh);
  group.add(propMesh([box([width + 0.14, height + 0.14, 0.1], '#1c1d22', [0, 0, -0.02])], 0.03));
  group.add(propMesh([
    box([0.09, postHeight, 0.09], '#8e98a4', [0, -height / 2 - postHeight / 2, 0]),
    box([0.5, 0.12, 0.12], '#8e98a4', [0, -height / 2 - 0.06, 0]),
  ], 0.03));
  group.userData.texture = texture;
  group.userData.signMaterial = (mesh.material as MeshBasicMaterial);
  return group;
}

/** The painted sign face: a canvas texture on an unlit quad. */
export function signFace(text: string, width: number, height: number): { mesh: Mesh; texture: CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(96, Math.round((512 * height) / width));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const draw = (): void => {
    const g = canvas.getContext('2d');
    if (!g) throw new Error('[race] events: no 2D canvas context');
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    g.fillStyle = INK;
    g.font = `900 ${Math.round(canvas.height * 0.46)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    texture.needsUpdate = true;
  };
  draw();
  // The bundled CJK font may still be loading: redraw with it once it is there.
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.load(`900 ${Math.round(canvas.height * 0.46)}px "Noto Sans SC"`, text)
      .then(() => draw())
      .catch((err: unknown) => console.warn('[race] events: sign font did not load', err));
  }
  const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: texture }));
  return { mesh, texture };
}
