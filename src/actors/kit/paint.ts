// Surface paint + skin weights of an SDF field at any point: the colour of the nearest shape primitive
// (with priority bias), overridden by 'paint' primitives in order; bone weights fall off with the distance
// to each primitive (sigma). Shared by the SDF builder, crisp-border splitting and body-hugging parts.
import type { Influences } from './builder';
import type { CPrim, Field } from './sdf';

export interface PaintSample { color: number; outline: number }

const inBox = (p: CPrim, x: number, y: number, z: number): boolean =>
  x >= p.min[0] && y >= p.min[1] && z >= p.min[2] && x <= p.max[0] && y <= p.max[1] && z <= p.max[2];

export class Painter {
  private readonly adds: CPrim[];
  private readonly paints: CPrim[];
  private readonly ds: number[];
  private readonly byBone = new Map<number, number>();

  constructor(field: Field) {
    this.adds = field.prims.filter((p) => p.op === 'add');
    this.paints = field.prims.filter((p) => p.op === 'paint');
    this.ds = new Array<number>(this.adds.length).fill(Infinity);
  }

  /** Distances to every shape primitive (Infinity outside its cull box); returns the minimum. */
  private distances(x: number, y: number, z: number, cull: boolean): number {
    let dmin = Infinity;
    this.adds.forEach((p, i) => {
      const d = cull && !inBox(p, x, y, z) ? Infinity : p.dist(x, y, z);
      this.ds[i] = d;
      if (d < dmin) dmin = d;
    });
    return dmin;
  }

  colorAt(x: number, y: number, z: number): PaintSample {
    this.distances(x, y, z, true);
    let owner = this.adds[0], best = Infinity;
    this.adds.forEach((p, i) => {
      const score = (this.ds[i] ?? Infinity) - (p.src.priority ?? 0);
      if (score < best) { best = score; owner = p; }
    });
    let color = owner?.src.color ?? 0xff00ff;
    let outline = owner?.src.outline ?? 1;
    for (const p of this.paints) {
      if (inBox(p, x, y, z) && p.dist(x, y, z) < 0) { color = p.src.color; outline = p.src.outline ?? outline; }
    }
    return { color, outline };
  }

  /** Bone influences (unnormalised). `cull` skips primitives whose box excludes the point. */
  weightsAt(x: number, y: number, z: number, cull = true): Influences {
    const dmin = this.distances(x, y, z, cull);
    const m = this.byBone;
    m.clear();
    this.adds.forEach((p, i) => {
      const d = this.ds[i] ?? Infinity;
      if (!Number.isFinite(d)) return;
      const w = Math.exp(-(d - dmin) / (p.src.sigma ?? 0.025));
      if (w > 0.004) m.set(p.src.bone, (m.get(p.src.bone) ?? 0) + w);
    });
    return [...m.entries()];
  }
}
