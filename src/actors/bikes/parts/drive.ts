// Drivetrain: gears (chainring / cog), crank set (authored at crank angle 0 = right arm up), level pedals,
// the chain loop and the bottom-bracket shell.
import { Path, PlaneGeometry, Shape, type BufferGeometry } from 'three';
import { AX, bar, box, cyl, ellip, extrude, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { decalUv } from '../build/atlas';
import { chainLoop, linkStrip } from '../build/strip';
import { facing } from './accessories';

const ARM_X = 0.072;

/** Toothed disc in the YZ plane (wheel plane) centred at c; `hole` > 0 cuts a round centre out (chainrings). */
export function gear(c: V3, r: number, teeth: number, thick: number, seg: Seg, hole = 0): BufferGeometry {
  const n = seg(teeth, 8), root = r - Math.min(0.009, r * 0.16);
  const shape = new Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? root : r;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  shape.closePath();
  if (hole > 0) {
    const h = new Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  return extrude(shape, thick, 0, 1, seg(10, 7)).rotateY(Math.PI / 2).translate(c.x, c.y, c.z);
}

export interface CrankSpec {
  crank: number;          // arm length
  ringR: number;          // chainring radius
  teeth: number;
  ringColor?: string;
  armColor?: string;
  /** Chainring sides: +1 right (drive), −1 left (tandem timing ring); [] = hidden in a chain case. */
  rings?: ReadonlyArray<1 | -1>;
  /** Spider arms behind the rings (default true). */
  spider?: boolean;
  /** Crank-arm offset from the centre plane (default 0.072). */
  armX?: number;
}

export function crankset(ps: PartSet, bb: V3, c: CrankSpec, seg: Seg): void {
  const arm = c.armColor ?? '#2b2d33', ax = c.armX ?? ARM_X;
  ps.add(cyl(v(bb.x - ax, bb.y, bb.z), v(bb.x + ax, bb.y, bb.z), 0.011, 0.011, seg(6, 4)), { color: '#8d939c' });
  ps.add(bar(v(bb.x + ax, bb.y, bb.z), v(bb.x + ax, bb.y + c.crank, bb.z), 0.016, 0.026), { color: arm, outline: 0.01 });
  ps.add(bar(v(bb.x - ax, bb.y, bb.z), v(bb.x - ax, bb.y - c.crank, bb.z), 0.016, 0.026), { color: arm, outline: 0.01 });
  const rings = c.rings ?? [1];
  for (const s of rings) {
    const x = bb.x + s * (ARM_X - 0.016), open = c.spider !== false;
    ps.add(gear(v(x, bb.y, bb.z), c.ringR, c.teeth, 0.006, seg, open ? c.ringR * 0.8 : 0), { color: c.ringColor ?? '#b9bec7', outline: 0.01 });
    // Spider + bolt circle + darker inner face: one alpha-tested card on the ring's outer face.
    const uv = decalUv('spider');
    const card = facing(new PlaneGeometry(c.ringR * 2, c.ringR * 2), v(x + s * 0.0036, bb.y, bb.z), v(s, 0, 0), v(0, 1, 0));
    ps.add(card, { decal: s > 0 ? uv : { ...uv, u0: uv.u1, u1: uv.u0 }, gloss: 0 });
  }
}

/** Rounded toy platform pedal centred at `at` with a rear reflector; side −1 = left (spindle points to +X), +1 = right. */
export function pedal(ps: PartSet, at: V3, side: 1 | -1, color = '#2b2d33', seg?: Seg, armX = ARM_X): void {
  const inner = v(side * armX, at.y, at.z);
  ps.add(cyl(inner, v(at.x + side * 0.03, at.y, at.z), 0.0065, 0.0065, 6), { color: '#9aa0a8' });
  ps.add(ellip(at, 0.04, 0.0125, 0.034, seg ? seg(12, 8) : 12, seg ? seg(6, 4) : 6), { color, outline: 0.01 });
  ps.add(box(v(at.x, at.y, at.z + 0.029), 0.046, 0.011, 0.007), { color: '#ff9a1f', outline: 0.003 });
}

/** Static chain loop from the chainring (at bb) to the cog (at hub) in the plane x, facing `side` (+1 = +X):
 *  chunky 8 mm toy links from the atlas, black edges as its outline. */
export function chain(ps: PartSet, bb: V3, ringR: number, hub: V3, cogR: number, x: number, seg: Seg, side: 1 | -1 = 1, pitch = 0.028): void {
  pitch *= 12 / seg(12, 6); // coarser links on lower quality
  const pts = chainLoop(v(x, bb.y, bb.z), ringR - 0.002, v(x, hub.y, hub.z), cogR - 0.001, 12);
  ps.add(linkStrip(pts, 0.0042, pitch, side > 0 ? AX : AX.clone().negate()), { decal: decalUv('chain'), gloss: 0.3 });
}

export function bbShell(ps: PartSet, bb: V3, color: string, seg: Seg, paint = 0): void {
  ps.add(cyl(v(bb.x - 0.045, bb.y, bb.z), v(bb.x + 0.045, bb.y, bb.z), 0.026, 0.026, seg(16, 8), true), { color, outline: 0.016, paint });
}

