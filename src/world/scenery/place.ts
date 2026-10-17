// Prop placement in track space: edge-relative positions, exact ground heights, facing, slope and
// water checks, and an occupancy grid so props never overlap each other or the drivable area.
import { Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import type { TerrainField } from '../terrain/field';

export interface Spot {
  s: number;
  side: -1 | 1;
  u: number;          // metres beyond the drivable edge
  x: number;          // lateral offset from the centre line
  pos: Vector3;       // world, y = ground
  /** Yaw turning a model's local −Z toward the road. */
  faceRoad: number;
  /** Yaw of the road direction (+s). */
  along: number;
}

const OCC_CELL = 1;

export class Placer {
  private readonly occ = new Set<number>();
  private readonly fr;

  constructor(readonly ctx: WorldCtx, readonly field: TerrainField) {
    this.fr = ctx.q.frameVis(0);
  }

  bound(s: number, side: -1 | 1): number {
    return this.field.bound(s, side);
  }

  /** World spot at (s, side, u beyond the edge). */
  spot(s: number, side: -1 | 1, u: number): Spot {
    const fr = this.ctx.q.frameVis(s, this.fr);
    const x = side * (this.bound(s, side) + u);
    const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
    const rx = fr.right.x / rl, rz = fr.right.z / rl;
    const pos = new Vector3(fr.pos.x + rx * x, 0, fr.pos.z + rz * x);
    pos.y = this.ctx.ground(s, x);
    const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1;
    return {
      s, side, u, x, pos,
      faceRoad: Math.atan2(rx * side, rz * side),
      along: Math.atan2(-fr.tangent.x / tl, -fr.tangent.z / tl),
    };
  }

  /** Spot at an absolute world point (projected to the nearest track position). */
  world(wx: number, wz: number): Vector3 {
    return new Vector3(wx, this.ctx.groundWorld(wx, wz), wz);
  }

  /** Ground height range over a footprint (w across the road × d along) at the spot. */
  slopeRange(sp: Spot, w: number, d: number): number {
    let lo = Infinity, hi = -Infinity;
    for (const ds of [-d / 2, d / 2]) {
      for (const du of [0, w]) {
        const y = this.ctx.ground(sp.s + ds, sp.side * (this.bound(sp.s + ds, sp.side) + sp.u + du));
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
    return hi - lo;
  }

  /** Marks a world-space disc as occupied; false if any of it is taken already. */
  claim(x: number, z: number, r: number): boolean {
    const cells: number[] = [];
    const c0x = Math.floor((x - r) / OCC_CELL), c1x = Math.floor((x + r) / OCC_CELL);
    const c0z = Math.floor((z - r) / OCC_CELL), c1z = Math.floor((z + r) / OCC_CELL);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const key = (cx + 32768) * 65536 + (cz + 32768);
        if (this.occ.has(key)) return false;
        cells.push(key);
      }
    }
    for (const k of cells) this.occ.add(k);
    return true;
  }

  /** True when the world point lies over the drivable area of any nearby road (crossing roads, hairpins). */
  onRoad(x: number, z: number, margin = 1.2): boolean {
    const smp = this.field.sampleWorld(x, z);
    return smp.u < margin;
  }

  /**
   * Claim + road check for a disc; the usual guard before placing a prop. `roadGap` = how far
   * beyond any drivable edge the centre must be (default: the radius plus 0.6 m).
   */
  free(x: number, z: number, r: number, roadGap = r + 0.6): boolean {
    return !this.onRoad(x, z, roadGap) && this.claim(x, z, r);
  }
}
