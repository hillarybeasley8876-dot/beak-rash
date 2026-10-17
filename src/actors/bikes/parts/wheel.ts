// Wheels (authored at the hub, bike space; the wheel group spins about X): tyre (slick or knobbly),
// rim (box / deep / deep-V / mag), wire or mag spokes, hub, optional disc rotor, rear cog, spoke reflectors.
import { TorusGeometry, type BufferGeometry } from 'three';
import { bar, box, cyl, lathe, v, type Seg, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import { gear } from './drive';

export interface WheelSpec {
  R: number;                 // outer radius, tyre included
  tyre: number;              // tyre tube radius
  tyreColor?: string;
  knobs?: boolean;
  rim: 'box' | 'deep' | 'deepV' | 'mag';
  rimDepth?: number;         // radial depth of the rim section
  rimColor: string;
  rimAccent?: string;        // inner half of the rim section (two-tone aero rims)
  spokes?: number;           // wire spokes
  spokeColor?: string;
  mag?: number;              // thick mag spokes
  hubColor?: string;
  hubW?: number;             // hub half-width
  rotor?: boolean;           // disc-brake rotor on the left
  drum?: string;             // drum/roller hub brake housing on the left (colour)
  cog?: { r: number; teeth: number; x: number };
  reflectors?: string;
}

const TYRE = '#1d1d22';

function tyreGeo(w: WheelSpec, seg: Seg): BufferGeometry {
  const tubular = seg(w.knobs ? 24 : 28, 12) & ~1, radial = seg(5, 4);
  const g = new TorusGeometry(w.R - w.tyre, w.tyre, radial, tubular);
  if (w.knobs) {
    const p = g.getAttribute('position');
    const cr = w.R - w.tyre;
    for (let k = 0; k < p.count; k++) {
      if ((k % (tubular + 1)) % 2) continue;
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const d = Math.hypot(x, y), out = (d - cr) / w.tyre;
      if (out < 0.1) continue;
      const push = 1 + (0.012 / Math.max(d, 1e-3)) * out;
      p.setXYZ(k, x * push, y * push, z * 1.12);
    }
    g.computeVertexNormals();
  }
  return g.rotateY(Math.PI / 2);
}

export function wheel(ps: PartSet, hub: V3, w: WheelSpec, seg: Seg): void {
  const tyreGeom = tyreGeo(w, seg).translate(hub.x, hub.y, hub.z);
  ps.add(tyreGeom, { color: w.tyreColor ?? TYRE, outline: 0.019 });
  const rOut = w.R - w.tyre * 1.55;
  const depth = w.rimDepth ?? 0.02;
  const rIn = rOut - depth;
  const hw = w.tyre * 0.72;
  const ring = seg(20, 10);
  const inner = w.rim === 'deepV' ? 0.003 : hw * 0.75;
  if (w.rimAccent) {
    const rMid = (rOut + rIn) / 2, mid = (hw + inner) / 2;
    ps.add(lathe([[rOut, hw], [rMid, mid]], ring, hub), { color: w.rimColor, outline: 0.005 });
    ps.add(lathe([[rMid, -mid], [rOut, -hw]], ring, hub), { color: w.rimColor, outline: 0.005 });
    ps.add(lathe([[rMid, mid], [rIn, inner], [rIn, -inner], [rMid, -mid]], ring, hub), { color: w.rimAccent, outline: 0.005 });
  } else {
    ps.add(lathe([[rOut, hw], [rIn, inner], [rIn, -inner], [rOut, -hw]], ring, hub), { color: w.rimColor, outline: 0.005 });
  }
  const hubW = w.hubW ?? 0.045;
  const hubCol = w.hubColor ?? '#c3c8d0';
  ps.add(lathe([[0.024, -hubW], [0.016, -hubW + 0.01], [0.016, hubW - 0.01], [0.024, hubW]], seg(8, 6), hub), { color: hubCol, outline: 0.005 });
  if (w.mag) {
    for (let k = 0; k < w.mag; k++) {
      const a = (k / w.mag) * Math.PI * 2 + 0.3;
      const dir = v(0, Math.sin(a), Math.cos(a));
      const a0 = hub.clone().addScaledVector(dir, 0.022), a1 = hub.clone().addScaledVector(dir, rIn + 0.004);
      ps.add(bar(a0, a1, 0.022, 0.032), { color: w.rimColor, outline: 0.007 });
    }
  }
  const n = w.spokes ?? 0;
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1;
    const a = (k / n) * Math.PI * 2;
    const ar = a + side * 0.09;
    const h0 = v(hub.x + side * (hubW - 0.008), hub.y + Math.sin(a) * 0.024, hub.z + Math.cos(a) * 0.024);
    const h1 = v(hub.x + side * 0.003, hub.y + Math.sin(ar) * (rIn + 0.002), hub.z + Math.cos(ar) * (rIn + 0.002));
    ps.add(cyl(h0, h1, 0.0032, 0.0032, 3), { color: w.spokeColor ?? '#cfd3da' });
  }
  if (w.reflectors && n) {
    for (const a of [0.25, 0.25 + Math.PI]) {
      const r = rIn * 0.62;
      ps.add(box(v(hub.x, hub.y + Math.sin(a) * r, hub.z + Math.cos(a) * r), 0.012, 0.022, 0.05), { color: w.reflectors, outline: 0.004 });
    }
  }
  if (w.drum) {
    ps.add(lathe([[0.012, -hubW - 0.018], [0.05, -hubW - 0.014], [0.052, -hubW + 0.004], [0.022, -hubW + 0.012]], seg(8, 6), hub), { color: w.drum, outline: 0.006 });
  }
  if (w.rotor) {
    const rx = hub.clone().setX(hub.x - hubW - 0.006);
    ps.add(lathe([[0.078, -0.002], [0.078, 0.002], [0.055, 0.002], [0.055, -0.002], [0.078, -0.002]], seg(14, 8), rx), { color: '#c9ced6', outline: 0.004 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const d = v(0, Math.sin(a), Math.cos(a));
      ps.add(bar(rx.clone().addScaledVector(d, 0.018), rx.clone().addScaledVector(d, 0.058), 0.006, 0.012), { color: '#55585f' });
    }
  }
  if (w.cog) {
    ps.add(gear(v(hub.x + w.cog.x, hub.y, hub.z), w.cog.r, w.cog.teeth, 0.006, seg), { color: '#a9afb8', outline: 0.004 });
  }
}
