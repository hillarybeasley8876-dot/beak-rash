// Batches world props into chunked meshes (spatial cells) with matching outline hulls, so the
// whole roadside costs a few draw calls and frustum culling still works.
import { Mesh, type Material } from 'three';
import { breathe } from '../breathe';
import type { WorldCtx } from '../ctx';
import { MeshBuf, makeHull } from '../geom';
import { hullMat, OUTLINE, propsMat } from '../mats';

export interface BatchOpts {
  cell?: number;            // chunk size (m)
  outline?: number;         // hull width (m); 0 = none
  material?: Material;
  /** Outline material (animated batches pass a matching sway hull). */
  hullMaterial?: Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export class PropBatch {
  private readonly cells = new Map<string, MeshBuf>();
  private readonly cell: number;

  constructor(private readonly ctx: WorldCtx, readonly name: string, private readonly opts: BatchOpts = {}) {
    this.cell = opts.cell ?? 240;
  }

  /** Buffer for geometry located near world (x, z). */
  at(x: number, z: number): MeshBuf {
    const key = `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
    let buf = this.cells.get(key);
    if (!buf) {
      buf = new MeshBuf();
      this.cells.set(key, buf);
    }
    return buf;
  }

  /** Build one mesh (+ hull) per non-empty cell and add them to the track group. */
  finish(): Mesh[] {
    const meshes: Mesh[] = [];
    for (const [key, buf] of this.cells) {
      const mesh = this.build(key, buf);
      if (mesh) meshes.push(mesh);
    }
    this.cells.clear();
    return meshes;
  }

  /** finish(), yielding to the browser whenever a run of cells took longer than `sliceMs`. */
  async finishYielding(sliceMs = 30): Promise<Mesh[]> {
    const meshes: Mesh[] = [];
    let t0 = performance.now();
    for (const [key, buf] of this.cells) {
      const mesh = this.build(key, buf);
      if (mesh) meshes.push(mesh);
      if (performance.now() - t0 > sliceMs) {
        await breathe();
        t0 = performance.now();
      }
    }
    this.cells.clear();
    return meshes;
  }

  private build(key: string, buf: MeshBuf): Mesh | null {
    if (buf.idx.length === 0) return null;
    const { ctx, opts } = this;
    const geo = ctx.own(buf.build());
    const mesh = new Mesh(geo, opts.material ?? propsMat(ctx));
    mesh.name = `${this.name}:${key}`;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    const width = opts.outline ?? OUTLINE.prop;
    if (width > 0) {
      const hull = new Mesh(ctx.own(makeHull(geo, width)), opts.hullMaterial ?? hullMat(ctx));
      hull.name = `${mesh.name}:hull`;
      hull.userData.isOutline = true;
      mesh.add(hull);
    }
    ctx.group.add(mesh);
    return mesh;
  }
}
