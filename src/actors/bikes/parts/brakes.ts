// Brakes: road calipers, disc calipers (with hose) and roadster rod-brake stirrups.
// Angles are measured in the wheel plane from +Z (behind the hub) toward +Y (up): 90° = top.
import { bar, box, cyl, ellip, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';

const DEG = Math.PI / 180;
const at = (hub: V3, r: number, deg: number, x = hub.x): V3 => v(x, hub.y + Math.sin(deg * DEG) * r, hub.z + Math.cos(deg * DEG) * r);

/** Side-pull caliper hugging the tyre at angle `deg`; returns the cable stop (top of the body). */
export function caliper(ps: PartSet, hub: V3, R: number, rimR: number, tyre: number, deg: number, color: string, seg: Seg): V3 {
  const body = at(hub, R + 0.02, deg), d = ps.detail;
  d.add(ellip(body, 0.03, 0.016, 0.018, seg(10, 6), seg(6, 4)), { color, outline: 0.008 });
  for (const s of [-1, 1]) {
    const pad = at(hub, rimR + 0.006, deg, hub.x + s * (tyre + 0.013));
    d.add(bar(body.clone().setX(s * 0.02), pad, 0.008, 0.016), { color, outline: 0.006 });
    d.add(box(pad, 0.01, 0.014, 0.03), { color: '#2b2d33' });
  }
  return body;
}

/** Disc-brake caliper on the left of the rotor at angle `deg`; returns its hose port (→ parts/cables.ts). */
export function discCaliper(ps: PartSet, hub: V3, rotorX: number, deg: number, color: string, seg: Seg): V3 {
  const c = at(hub, 0.072, deg, rotorX - 0.004);
  const tang = v(0, Math.cos(deg * DEG), -Math.sin(deg * DEG));
  ps.detail.add(bar(c.clone().addScaledVector(tang, -0.026), c.clone().addScaledVector(tang, 0.026), 0.022, 0.026), { color, outline: 0.008 });
  return c.clone().setX(rotorX - 0.014).addScaledVector(tang, 0.012);
}

/** Roadster stirrup brake: a U under/around the rim at `deg` with pads, pulled by a rod from `rodTop`. */
export function rodBrake(ps: PartSet, hub: V3, rimR: number, tyre: number, deg: number, rodTop: V3, color: string, seg: Seg): void {
  if (ps.far) return;
  const pivot = at(hub, rimR - 0.035, deg);
  for (const s of [-1, 1]) {
    const pad = at(hub, rimR - 0.004, deg, hub.x + s * (tyre * 0.8 + 0.006));
    ps.add(bar(pivot.clone().setX(s * (tyre + 0.012)), pad, 0.006, 0.012), { color, outline: 0.003 });
  }
  ps.add(cyl(pivot.clone().setX(-tyre - 0.014), pivot.clone().setX(tyre + 0.014), 0.005, 0.005, seg(5, 4)), { color, outline: 0.003 });
  const rodBase = pivot.clone().setX(tyre + 0.014);
  ps.add(cyl(rodBase, rodTop, 0.0042, 0.0042, 4), { color, outline: 0.003 });
}
