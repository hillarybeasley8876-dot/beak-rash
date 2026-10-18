// City batches: like kit/PropBatch, plus a per-vertex `aux` vec4 the city shaders read (window
// style / seed / lit ratio, neon intensity / flicker, light cycles), and an optional reflection layer.
import { BufferAttribute, Mesh, type BufferGeometry, type Material } from 'three';
import type { WorldCtx } from '../../ctx';
import { MeshBuf, makeHull } from '../../geom';
import { hullMat, OUTLINE } from '../../mats';

/** three.js layer for emissive things the wet road mirrors (env/city-wet.ts renders only this layer). */
export const REFLECT_LAYER = 5;

/** MeshBuf with a stamped vec4 `aux` per vertex. */
export class AuxBuf extends MeshBuf {
  aux: number[] = [];
  private cur: [number, number, number, number] = [0, 0, 0, 0];

  /** Aux value for the following vertices. */
  setAux(a: number, b = 0, c = 0, d = 0): this {
    this.cur = [a, b, c, d];
    return this;
  }

  override vert(p: { x: number; y: number; z: number }, n: { x: number; y: number; z: number }, c: Parameters<MeshBuf['vert']>[2], u?: number, v?: number): number {
    const i = super.vert(p, n, c, u, v);
    this.aux.push(this.cur[0], this.cur[1], this.cur[2], this.cur[3]);
    return i;
  }

  override build(opts: { colors?: boolean; computeNormals?: boolean } = {}): BufferGeometry {
    const g = super.build(opts);
    g.setAttribute('aux', new BufferAttribute(new Float32Array(this.aux), 4));
    return g;
  }
}

export interface AuxBatchOpts {
  material: Material;
  cell?: number;
  outline?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Also render in the wet-road reflection pass. */
  reflect?: boolean;
  renderOrder?: number;
}

/** Spatially chunked AuxBufs → one mesh (+ outline hull) per cell. */
export class AuxBatch {
  private readonly cells = new Map<string, AuxBuf>();
  private readonly cell: number;

  constructor(private readonly ctx: WorldCtx, readonly name: string, private readonly opts: AuxBatchOpts) {
    this.cell = opts.cell ?? 320;
  }

  at(x: number, z: number): AuxBuf {
    const key = `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
    let buf = this.cells.get(key);
    if (!buf) {
      buf = new AuxBuf();
      this.cells.set(key, buf);
    }
    return buf;
  }

  finish(): Mesh[] {
    const { ctx, opts } = this;
    const width = opts.outline ?? 0;
    const meshes: Mesh[] = [];
    for (const [key, buf] of this.cells) {
      if (buf.idx.length === 0) continue;
      const geo = ctx.own(buf.build());
      const mesh = new Mesh(geo, opts.material);
      mesh.name = `${this.name}:${key}`;
      mesh.castShadow = opts.castShadow ?? false;
      mesh.receiveShadow = opts.receiveShadow ?? false;
      if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
      if (opts.reflect) mesh.layers.enable(REFLECT_LAYER);
      if (width > 0) {
        const hull = new Mesh(ctx.own(makeHull(geo, width)), hullMat(ctx));
        hull.name = `${mesh.name}:hull`;
        hull.userData.isOutline = true;
        mesh.add(hull);
      }
      ctx.group.add(mesh);
      meshes.push(mesh);
    }
    this.cells.clear();
    return meshes;
  }
}

export { OUTLINE };
