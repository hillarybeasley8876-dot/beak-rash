// Building lots: rotated-rectangle footprints tested against the drivable area of every nearby road
// and against earlier lots (1 m cells), then claimed in the shared Placer so street props avoid them.
import { Vector3 } from 'three';
import type { Placer } from '../../scenery/place';

const CELL = 1;

export class Lots {
  private readonly taken = new Set<number>();

  constructor(private readonly place: Placer) {}

  private key(x: number, z: number): number {
    return (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(z / CELL) + 32768);
  }

  /** World point of lot-local (lx, lz); the lot's front-centre is (x, z), local −Z faces the road. */
  private world(x: number, z: number, yaw: number, lx: number, lz: number, out: Vector3): Vector3 {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return out.set(x + c * lx + s * lz, 0, z - s * lx + c * lz);
  }

  /** Local sample points over the footprint (spacing ≈ step, inset 0.3 m). */
  private points(w: number, d: number, step: number): Array<[number, number]> {
    const nx = Math.max(1, Math.ceil(w / step)), nz = Math.max(1, Math.ceil(d / step));
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) out.push([-w / 2 + 0.3 + ((w - 0.6) * i) / nx, 0.3 + ((d - 0.6) * j) / nz]);
    return out;
  }

  /** True when the footprint is clear of other lots and at least `gap` m beyond any drivable edge. */
  fits(x: number, z: number, yaw: number, w: number, d: number, gap = 0.3): boolean {
    const p = new Vector3();
    for (const [lx, lz] of this.points(w, d, CELL)) {
      this.world(x, z, yaw, lx, lz, p);
      if (this.taken.has(this.key(p.x, p.z))) return false;
    }
    for (const [lx, lz] of this.points(w, d, 6)) {
      this.world(x, z, yaw, lx, lz, p);
      if (this.place.onRoad(p.x, p.z, gap)) return false;
    }
    return true;
  }

  claim(x: number, z: number, yaw: number, w: number, d: number): void {
    const p = new Vector3();
    for (const [lx, lz] of this.points(w + 0.6, d + 0.6, CELL)) {
      this.world(x, z, yaw, lx, lz, p);
      this.taken.add(this.key(p.x, p.z));
      this.place.claim(p.x, p.z, 0.45);
    }
  }

  /** Keep buildings off a footprint (a view corridor) while street props may still stand in it. */
  reserve(x: number, z: number, yaw: number, w: number, d: number): void {
    const p = new Vector3();
    for (const [lx, lz] of this.points(w + 0.6, d + 0.6, CELL)) {
      this.world(x, z, yaw, lx, lz, p);
      this.taken.add(this.key(p.x, p.z));
    }
  }

  /** True when a lot covers the world point. */
  has(x: number, z: number): boolean {
    return this.taken.has(this.key(x, z));
  }

  /** Claim a disc (landmarks placed before the buildings). */
  claimDisc(x: number, z: number, r: number): void {
    for (let dx = -r; dx <= r; dx += CELL) {
      for (let dz = -r; dz <= r; dz += CELL) if (dx * dx + dz * dz <= r * r) this.taken.add(this.key(x + dx, z + dz));
    }
    this.place.claim(x, z, r);
  }
}
