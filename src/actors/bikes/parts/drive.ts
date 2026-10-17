// Drivetrain: gears (chainring / cog), crank set (authored at crank angle 0 = right arm up), level pedals,
// the chain loop and the bottom-bracket shell.
import { Shape, type BufferGeometry } from 'three';
import { AX, bar, box, cyl, extrude, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { chainLoop, strip } from '../build/strip';

const ARM_X = 0.072;

/** Toothed disc in the YZ plane (wheel plane) centred at c. */
export function gear(c: V3, r: number, teeth: number, thick: number, seg: Seg): BufferGeometry {
  const n = seg(teeth, 8), root = r - Math.min(0.009, r * 0.16);
  const shape = new Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? root : r;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  shape.closePath();
  return extrude(shape, thick, 0, 1, 1).rotateY(Math.PI / 2).translate(c.x, c.y, c.z);
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
  ps.add(bar(v(bb.x + ax, bb.y, bb.z), v(bb.x + ax, bb.y + c.crank, bb.z), 0.016, 0.026), { color: arm, outline: 0.006 });
  ps.add(bar(v(bb.x - ax, bb.y, bb.z), v(bb.x - ax, bb.y - c.crank, bb.z), 0.016, 0.026), { color: arm, outline: 0.006 });
  const rings = c.rings ?? [1];
  for (const s of rings) {
    const x = bb.x + s * (ARM_X - 0.016);
    ps.add(gear(v(x, bb.y, bb.z), c.ringR, c.teeth, 0.006, seg), { color: c.ringColor ?? '#b9bec7', outline: 0.004 });
    for (let k = 0; k < (c.spider === false ? 0 : 4); k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const d = v(0, Math.sin(a), Math.cos(a));
      const p0 = v(x + s * 0.005, bb.y, bb.z), p1 = p0.clone().addScaledVector(d, c.ringR * 0.72);
      ps.add(bar(p0, p1, 0.006, 0.016), { color: arm });
    }
  }
}

/** Platform pedal centred at `at`; side −1 = left (spindle points to +X), +1 = right. */
export function pedal(ps: PartSet, at: V3, side: 1 | -1, color = '#2b2d33', seg?: Seg, armX = ARM_X): void {
  const inner = v(side * armX, at.y, at.z);
  ps.add(cyl(inner, v(at.x + side * 0.03, at.y, at.z), 0.0065, 0.0065, seg ? seg(6, 4) : 6), { color: '#9aa0a8' });
  ps.add(box(at, 0.072, 0.02, 0.062), { color, outline: 0.006 });
  ps.add(box(v(at.x, at.y, at.z + 0.033), 0.05, 0.012, 0.006), { color: '#ff9a1f' });
}

/** Static chain loop from the chainring (at bb) to the cog (at hub), in the plane x. */
export function chain(ps: PartSet, bb: V3, ringR: number, hub: V3, cogR: number, x: number, seg: Seg, perArc = seg(14, 6)): void {
  const pts = chainLoop(v(x, bb.y, bb.z), ringR - 0.003, v(x, hub.y, hub.z), cogR - 0.002, perArc);
  ps.add(strip(pts, 0.0055, { closed: true, normal: AX, colors: ['#3a3d44', '#8f959e'] }), { outline: 0 });
}

export function bbShell(ps: PartSet, bb: V3, color: string, seg: Seg, paint = 0): void {
  ps.add(cyl(v(bb.x - 0.045, bb.y, bb.z), v(bb.x + 0.045, bb.y, bb.z), 0.026, 0.026, seg(10, 6), true), { color, outline: 0.012, paint });
}

