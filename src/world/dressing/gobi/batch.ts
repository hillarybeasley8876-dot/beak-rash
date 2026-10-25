// Batches for the 戈壁公路 dressing: chunked meshes written into the dressing's own `dress:gobi` group,
// each with a matching ink-outline hull. Same idea as world/kit/batch.ts, but the target group is the
// dressing's, and the cell size is big (the gobi is a wide open desert: few, large chunks).
import { Mesh, type Group, type Material } from 'three';
import { breathe } from '../../breathe';
import type { WorldCtx } from '../../ctx';
import { makeHull, MeshBuf } from '../../geom';
import { hullMat, OUTLINE, propsMat } from '../../mats';

export interface BatchOpts {
  cell?: number;            // chunk size (m)
  outline?: number;         // hull width (m); 0 = none
  material?: Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export class GobiBatch {
  private readonly cells = new Map<string, MeshBuf>();
  private readonly cell: number;

  constructor(
    private readonly ctx: WorldCtx, readonly name: string, private readonly group: Group, private readonly opts: BatchOpts = {},
  ) {
    this.cell = opts.cell ?? 480;
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

  /** Build one mesh (+ hull) per non-empty cell and add them to the dressing group. */
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
  async finishYielding(sliceMs = 25): Promise<Mesh[]> {
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
    const geo = this.ctx.own(buf.build());
    const mesh = new Mesh(geo, this.opts.material ?? propsMat(this.ctx));
    mesh.name = `${this.name}:${key}`;
    mesh.castShadow = this.opts.castShadow ?? true;
    mesh.receiveShadow = this.opts.receiveShadow ?? true;
    const width = this.opts.outline ?? OUTLINE.prop;
    if (width > 0) {
      const hull = new Mesh(this.ctx.own(makeHull(geo, width)), hullMat(this.ctx));
      hull.name = `${mesh.name}:hull`;
      hull.userData.isOutline = true;
      mesh.add(hull);
    }
    this.group.add(mesh);
    return mesh;
  }
}

/** A single mesh from one buffer (for the parts that move on their own). */
export function bufMesh(ctx: WorldCtx, group: Group, name: string, buf: MeshBuf, outline: number = OUTLINE.prop): Mesh {
  const geo = ctx.own(buf.build());
  const mesh = new Mesh(geo, propsMat(ctx));
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outline > 0) {
    const hull = new Mesh(ctx.own(makeHull(geo, outline)), hullMat(ctx));
    hull.name = `${name}:hull`;
    hull.userData.isOutline = true;
    mesh.add(hull);
  }
  group.add(mesh);
  return mesh;
}
