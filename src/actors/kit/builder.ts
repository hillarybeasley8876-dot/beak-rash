// Character builder: merges SDF pieces, swept tubes, slabs and rigid primitives into ONE skinned
// BufferGeometry (position, normal, color, skinIndex, skinWeight, aOutline) → 1 draw + 1 outline draw.
import {
  BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Matrix3, Matrix4, Uint16BufferAttribute, Vector3,
} from 'three';
import { decimate } from './decimate';
import { meshField } from './mesher';
import { Field, type Prim } from './sdf';

/** Up to four (bone, weight) influences. */
export type Influences = Array<[number, number]>;
/** Per-vertex callbacks receive the bind position and the vertex index within the part's geometry. */
export type WeightFn = (x: number, y: number, z: number, i: number) => Influences;
export type ColorFn = (x: number, y: number, z: number, nx: number, ny: number, nz: number, i: number) => number;

export interface GeoPart {
  geometry: BufferGeometry;
  matrix?: Matrix4;
  color: number | ColorFn;
  bone: number | WeightFn;
  outline?: number;
}

interface Chunk {
  pos: Float32Array;
  nrm: Float32Array;
  col: Float32Array;
  skinI: Uint16Array;
  skinW: Float32Array;
  outl: Float32Array;
  idx: Uint32Array;
}

const tmpColor = new Color();

function linear(hex: number, out: Float32Array, o: number): void {
  tmpColor.setHex(hex);
  out[o] = tmpColor.r; out[o + 1] = tmpColor.g; out[o + 2] = tmpColor.b;
}

/** Keep the 4 strongest influences, normalised. */
function writeInfluences(inf: Influences, skinI: Uint16Array, skinW: Float32Array, o: number): void {
  inf.sort((a, b) => b[1] - a[1]);
  let sum = 0;
  for (let i = 0; i < 4 && i < inf.length; i++) sum += inf[i]?.[1] ?? 0;
  for (let i = 0; i < 4; i++) {
    const e = inf[i];
    skinI[o + i] = e && sum > 0 ? e[0] : 0;
    skinW[o + i] = e && sum > 0 ? e[1] / sum : i === 0 ? 1 : 0;
  }
}

export class CharacterBuilder {
  private chunks: Chunk[] = [];
  /** Global detail multiplier for SDF cells (quality low → coarser). */
  constructor(private readonly detail = 1) {}

  /**
   * Mesh a smooth-CSG piece. Colours/bones come from the nearest primitive; 'paint' prims recolour.
   * `budget` (triangles) decimates the piece afterwards, keeping colour borders crisp.
   */
  sdf(prims: readonly Prim[], cell: number, budget?: number): void {
    const field = new Field(prims, cell * 2);
    const raw = meshField(field, cell / this.detail);
    const n = raw.positions.length / 3;
    const chunk = this.alloc(n, raw.indices);
    chunk.pos.set(raw.positions);
    chunk.nrm.set(raw.normals);
    const adds = field.prims.filter((p) => p.op === 'add');
    const paints = field.prims.filter((p) => p.op === 'paint');
    const byBone = new Map<number, number>();
    for (let v = 0; v < n; v++) {
      const x = raw.positions[v * 3] ?? 0, y = raw.positions[v * 3 + 1] ?? 0, z = raw.positions[v * 3 + 2] ?? 0;
      const ds = adds.map((p) => (x < p.min[0] || y < p.min[1] || z < p.min[2] || x > p.max[0] || y > p.max[1] || z > p.max[2]) ? Infinity : p.dist(x, y, z));
      let dmin = Infinity, owner = adds[0], best = Infinity;
      ds.forEach((d, i) => {
        const p = adds[i];
        if (!p) return;
        dmin = Math.min(dmin, d);
        const score = d - (p.src.priority ?? 0);
        if (score < best) { best = score; owner = p; }
      });
      byBone.clear();
      ds.forEach((d, i) => {
        const p = adds[i];
        if (!p || !Number.isFinite(d)) return;
        const w = Math.exp(-(d - dmin) / (p.src.sigma ?? 0.025));
        if (w > 0.004) byBone.set(p.src.bone, (byBone.get(p.src.bone) ?? 0) + w);
      });
      writeInfluences([...byBone.entries()], chunk.skinI, chunk.skinW, v * 4);
      let color = owner?.src.color ?? 0xff00ff;
      let outl = owner?.src.outline ?? 1;
      for (const p of paints) {
        if (x < p.min[0] || y < p.min[1] || z < p.min[2] || x > p.max[0] || y > p.max[1] || z > p.max[2]) continue;
        if (p.dist(x, y, z) < 0) { color = p.src.color; outl = p.src.outline ?? outl; }
      }
      linear(color, chunk.col, v * 3);
      chunk.outl[v] = outl;
    }
    if (budget !== undefined && chunk.idx.length / 3 > budget) this.reduce(chunk, budget * this.detail * this.detail);
  }

  /** Decimate a chunk in place and drop the vertices it no longer uses. */
  private reduce(c: Chunk, budget: number): void {
    const col = c.col, sw = c.skinW, si = c.skinI;
    const penalty = (u: number, v: number): number => {
      const dr = (col[u * 3] ?? 0) - (col[v * 3] ?? 0), dg = (col[u * 3 + 1] ?? 0) - (col[v * 3 + 1] ?? 0), db = (col[u * 3 + 2] ?? 0) - (col[v * 3 + 2] ?? 0);
      const bone = si[u * 4] !== si[v * 4] || Math.abs((sw[u * 4] ?? 0) - (sw[v * 4] ?? 0)) > 0.25 ? 2e-6 : 0;
      return (dr * dr + dg * dg + db * db) * 1e-4 + bone;
    };
    const idx = decimate(c.pos, c.idx, Math.round(budget), penalty);
    const remap = new Int32Array(c.pos.length / 3).fill(-1);
    let n = 0;
    for (const i of idx) if (remap[i] === -1) remap[i] = n++;
    const pick = <T extends Float32Array | Uint16Array>(src: T, k: number, dst: T): T => {
      for (let i = 0; i < remap.length; i++) {
        const j = remap[i] ?? -1;
        if (j >= 0) for (let e = 0; e < k; e++) dst[j * k + e] = src[i * k + e] ?? 0;
      }
      return dst;
    };
    c.pos = pick(c.pos, 3, new Float32Array(n * 3));
    c.nrm = pick(c.nrm, 3, new Float32Array(n * 3));
    c.col = pick(c.col, 3, new Float32Array(n * 3));
    c.skinI = pick(c.skinI, 4, new Uint16Array(n * 4));
    c.skinW = pick(c.skinW, 4, new Float32Array(n * 4));
    c.outl = pick(c.outl, 1, new Float32Array(n));
    c.idx = idx.map((i) => remap[i] ?? 0);
  }

  /** Add an arbitrary geometry (eyes, beak plates, gear, extrusions) rigidly or with a weight function. */
  part(p: GeoPart): void {
    const g = p.geometry;
    const posA = g.getAttribute('position');
    const nrmA = g.getAttribute('normal');
    if (!posA || !nrmA) throw new Error('[actors] builder.part: geometry needs position + normal');
    const n = posA.count;
    const idx = g.index ? Uint32Array.from(g.index.array as ArrayLike<number>) : Uint32Array.from({ length: n }, (_, i) => i);
    const chunk = this.alloc(n, idx);
    const m = p.matrix ?? new Matrix4();
    const nm = new Matrix3().getNormalMatrix(m);
    const v = new Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(posA, i).applyMatrix4(m);
      chunk.pos.set([v.x, v.y, v.z], i * 3);
      const px = v.x, py = v.y, pz = v.z;
      v.fromBufferAttribute(nrmA, i).applyMatrix3(nm).normalize();
      chunk.nrm.set([v.x, v.y, v.z], i * 3);
      const hex = typeof p.color === 'number' ? p.color : p.color(px, py, pz, v.x, v.y, v.z, i);
      linear(hex, chunk.col, i * 3);
      const inf: Influences = typeof p.bone === 'number' ? [[p.bone, 1]] : p.bone(px, py, pz, i);
      writeInfluences(inf, chunk.skinI, chunk.skinW, i * 4);
      chunk.outl[i] = p.outline ?? 1;
    }
  }

  /** Add precomputed vertex data (tubes). Arrays are per vertex; `inf` gives influences per vertex. */
  raw(pos: Float32Array, nrm: Float32Array, idx: Uint32Array, color: (v: number) => number, inf: (v: number) => Influences, outline = 1): void {
    const n = pos.length / 3;
    const chunk = this.alloc(n, idx);
    chunk.pos.set(pos);
    chunk.nrm.set(nrm);
    for (let i = 0; i < n; i++) {
      linear(color(i), chunk.col, i * 3);
      writeInfluences(inf(i), chunk.skinI, chunk.skinW, i * 4);
      chunk.outl[i] = outline;
    }
  }

  /** Triangle count per added chunk, in order (for budgets and debugging). */
  get chunkTris(): number[] {
    return this.chunks.map((c) => c.idx.length / 3);
  }

  private alloc(n: number, idx: Uint32Array): Chunk {
    const c: Chunk = {
      pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), col: new Float32Array(n * 3),
      skinI: new Uint16Array(n * 4), skinW: new Float32Array(n * 4), outl: new Float32Array(n), idx,
    };
    this.chunks.push(c);
    return c;
  }

  get triangles(): number {
    return this.chunks.reduce((s, c) => s + c.idx.length / 3, 0);
  }

  /** Merge every chunk into one geometry. */
  build(): BufferGeometry {
    let nv = 0, ni = 0;
    for (const c of this.chunks) { nv += c.pos.length / 3; ni += c.idx.length; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const skinI = new Uint16Array(nv * 4), skinW = new Float32Array(nv * 4), outl = new Float32Array(nv);
    const idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    for (const c of this.chunks) {
      const n = c.pos.length / 3;
      pos.set(c.pos, vo * 3); nrm.set(c.nrm, vo * 3); col.set(c.col, vo * 3);
      skinI.set(c.skinI, vo * 4); skinW.set(c.skinW, vo * 4); outl.set(c.outl, vo);
      for (let i = 0; i < c.idx.length; i++) idx[io + i] = (c.idx[i] ?? 0) + vo;
      vo += n; io += c.idx.length;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(nrm, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new Uint16BufferAttribute(skinI, 4));
    g.setAttribute('skinWeight', new Float32BufferAttribute(skinW, 4));
    g.setAttribute('aOutline', new BufferAttribute(outl, 1));
    g.setIndex(new BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
