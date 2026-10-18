// Far city fill: a world-aligned grid of blocks over every patch of street-level land the street
// walls and skyline leave empty (so the aerial reads as coherent city blocks and the skyline has no
// gaps), with dim street-light dots along the grid streets. Cheap: window-shader boxes in the far
// batch (no outline, no shadows) + one glow batch of dots.
import { Matrix4 } from 'three';
import { box, trs } from '../../kit/shapes';
import { STREET } from '../../layouts/city';
import { CPAL, fbox, winSpec } from '../../scenery/props/city-kit';
import type { City } from './city';
import { hdr } from './util';

const PITCH = 34;          // grid pitch (m): block + street
const STREET_W = 8;        // grid street width (m)
const ROAD_GAP = 12;       // keep this far beyond any drivable edge (street walls live there)
const m = new Matrix4();

/** Track-space bounding box of the visual road in world x/z (+ margin). */
function extents(c: City, margin: number): [number, number, number, number] {
  const { L } = c.d.ctx;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < L.n; i += 10) {
    const x = L.px[i] ?? 0, z = L.pz[i] ?? 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return [x0 - margin, x1 + margin, z0 - margin, z1 + margin];
}

/** True when the whole square (centre, half size) is flat street-level land, clear of the road. */
function land(c: City, x: number, z: number, half: number): boolean {
  const { ctx, place, field } = c.d;
  const sEnd = ctx.L.sMin + ctx.L.n - 3;
  for (const [dx, dz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) {
    const px = x + dx * half, pz = z + dz * half;
    // Beyond the road's ends the field extends its profile straight, but no terrain is drawn there.
    const smp = field.sampleWorld(px, pz);
    if (smp.s <= ctx.L.sMin + 2 || smp.s >= sEnd) return false;
    if (Math.abs(ctx.groundWorld(px, pz) - STREET) > 0.4 || place.onRoad(px, pz, ROAD_GAP)) return false;
  }
  return true;
}

export function farFill(c: City): number {
  const rng = c.d.rng.fork(0xfa11);
  const [x0, x1, z0, z1] = extents(c, 420);
  const lamp = hdr('#ffc27a', 1.8);
  let n = 0;
  for (let gx = Math.floor(x0 / PITCH) * PITCH; gx < x1; gx += PITCH) {
    for (let gz = Math.floor(z0 / PITCH) * PITCH; gz < z1; gz += PITCH) {
      const cx = gx + PITCH / 2, cz = gz + PITCH / 2;
      // Full block, or a half-size one on the ragged land near the shore.
      const size = land(c, cx, cz, (PITCH - STREET_W) / 2) ? PITCH - STREET_W : land(c, cx, cz, (PITCH - STREET_W) / 4) ? (PITCH - STREET_W) / 2 : 0;
      if (!size) continue;
      const w = size * rng.range(0.8, 1), d = size * rng.range(0.8, 1);
      // fits() takes the lot's front-centre (local −Z faces the road): yaw 0 → front at z − d/2.
      if (!c.lots.fits(cx, cz - d / 2, 0, w, d, ROAD_GAP)) continue;
      c.lots.claim(cx, cz - d / 2, 0, w, d);
      const h = size < PITCH - STREET_W ? rng.range(8, 20) : rng.chance(0.15) ? rng.range(45, 90) : rng.range(12, 38);
      const buf = c.cb.far.at(cx, cz);
      const style = rng.chance(0.5) ? 1 : rng.chance(0.6) ? 2 : 3;
      const base = trs(cx, STREET, cz - d / 2, 0, 1, 1, 1, m);
      fbox(buf, base, 0, h / 2, d / 2, w, h, d, rng.pick(rng.chance(0.5) ? CPAL.walls : CPAL.towers), winSpec(style, rng.range(0, 100), rng.range(0.3, 0.65), rng.chance(0.2) ? rng.int(1, 4) : 0, 3, 3.4, 0), CPAL.roof, 0b11111);
      // Street-light dots on two sides of the block.
      const glow = c.d.b.glow.at(cx, cz);
      for (let k = -1; k <= 1; k += 2) {
        box(glow, trs(cx + k * (PITCH / 2), STREET + 6, cz, 0, 0.5, 0.25, 0.5, m), lamp);
        box(glow, trs(cx, STREET + 6, cz + k * (PITCH / 2), 0, 0.5, 0.25, 0.5, m), lamp);
      }
      n++;
    }
  }
  return n;
}
