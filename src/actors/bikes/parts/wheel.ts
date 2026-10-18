// Wheels (authored at the hub, bike space). The wheel group carries tyre, rim, hub, rotor ring, drum and cog;
// its child `spokes<side>` carries the wire-spoke cards, mag arms and rotor spider (dissolved at speed), the
// sibling `blur<side>` the speed-blur cards, and `tread<side>` the knobbly tread blocks (see animate.ts).
import { PlaneGeometry } from 'three';
import { decalUv } from '../build/atlas';
import { bar, lathe, v, type V3 } from '../build/geo';
import type { PartSet } from '../build/partset';
import type { BikeBuilder } from '../template';
import { facing } from './accessories';
import { gear } from './drive';
import { rimGeos, treadBlocks, tyreGeo, type RimKind } from './tyre';

export interface WheelSpec {
  R: number;                 // outer radius, tyre included
  tyre: number;              // tyre tube radius
  tyreColor?: string;
  knobs?: boolean;
  rim: RimKind;
  rimDepth?: number;         // radial depth of the rim section
  rimColor: string;
  rimAccent?: string;        // inner half of the rim section (two-tone aero rims)
  spokes?: boolean;          // wire spokes (alpha-tested card, 16 laced spokes)
  spokeColor?: string;
  mag?: number;              // thick mag spokes
  hubColor?: string;
  hubW?: number;             // hub half-width
  rotor?: boolean;           // disc-brake rotor on the left
  drum?: string;             // drum/roller hub brake housing on the left (colour)
  cog?: { r: number; teeth: number; x: number };
}

const TYRE = '#26272d';
/** Angular period of the wire-spoke pattern (animate.ts dissolves spokes before they can strobe). */
export const SPOKE_PERIOD = (Math.PI * 2) / 16;

/** Square atlas card in the wheel plane, facing +X (side 1) or −X (side −1, mirrored so motion reads the same). */
function card(ps: PartSet, id: 'spokes' | 'blur', hub: V3, r: number, side: 1 | -1, color: string, x: number): void {
  const uv = decalUv(id);
  const rect = side > 0 ? uv : { ...uv, u0: uv.u1, u1: uv.u0 };
  ps.add(facing(new PlaneGeometry(2 * r, 2 * r), hub.clone().setX(hub.x + side * x), v(side, 0, 0), v(0, 1, 0)), { decal: rect, color, gloss: 0 });
}

export function wheel(b: BikeBuilder, side: 'R' | 'F', hub: V3, w: WheelSpec): void {
  const name = side === 'R' ? 'wheelR' : 'wheelF';
  const ps = b.parts(name), seg = b.seg;
  const tubular = Math.max(w.knobs ? 28 : 32, seg(w.knobs ? 32 : w.R >= 0.25 ? 44 : 36));
  ps.add(tyreGeo(hub, w.R, w.tyre, tubular, Math.max(4, seg(w.knobs ? 6 : 5))), { color: w.tyreColor ?? TYRE, outline: 0.024 });
  const rOut = w.R - w.tyre * 1.55, rIn = rOut - (w.rimDepth ?? 0.02), hw = w.tyre * 0.72;
  const ring = Math.max(28, seg(36));
  rimGeos(hub, rOut, rIn, hw, w.rim, ring, !!w.rimAccent).forEach((g, i) => {
    ps.add(g, { color: i === 2 && w.rimAccent ? w.rimAccent : w.rimColor, outline: 0.008 });
  });
  const hubW = w.hubW ?? 0.045;
  ps.add(lathe([[0.024, -hubW], [0.016, -hubW + 0.01], [0.016, hubW - 0.01], [0.024, hubW]], seg(12, 8), hub), { color: w.hubColor ?? '#c3c8d0', outline: 0.008 });
  const spokes = b.alias(side === 'R' ? 'spokesR' : 'spokesF', name, name);
  const blur = b.alias(side === 'R' ? 'blurR' : 'blurF', name);
  const blurColor = w.mag ? w.rimColor : w.spokeColor ?? '#cfd3da';
  for (const s of [1, -1] as const) card(blur, 'blur', hub, rIn + 0.002, s, blurColor, 0.006);
  if (w.mag) {
    b.period(side === 'R' ? 'spokesR' : 'spokesF', (Math.PI * 2) / w.mag);
    for (let k = 0; k < w.mag; k++) {
      const a = (k / w.mag) * Math.PI * 2 + 0.3;
      const dir = v(0, Math.sin(a), Math.cos(a));
      spokes.add(bar(hub.clone().addScaledVector(dir, 0.022), hub.clone().addScaledVector(dir, rIn + 0.004), 0.022, 0.032), { color: w.rimColor, outline: 0.01 });
    }
  }
  if (w.spokes) for (const s of [1, -1] as const) card(spokes, 'spokes', hub, rIn + 0.003, s, w.spokeColor ?? '#cfd3da', 0.004);
  if (w.knobs) {
    const tread = b.alias(side === 'R' ? 'treadR' : 'treadF', name), n = Math.max(16, seg(24)) & ~1;
    b.period(side === 'R' ? 'treadR' : 'treadF', (Math.PI * 2) / n);
    tread.add(treadBlocks(hub, w.R, w.tyre, n, 0.011), { color: w.tyreColor ?? TYRE, outline: 0.01 });
  }
  if (w.drum) {
    ps.add(lathe([[0.012, -hubW - 0.018], [0.05, -hubW - 0.014], [0.052, -hubW + 0.004], [0.022, -hubW + 0.012]], seg(14, 8), hub), { color: w.drum, outline: 0.01 });
  }
  if (w.rotor) {
    const rx = hub.clone().setX(hub.x - hubW - 0.006);
    ps.add(lathe([[0.078, 0.002], [0.055, 0.002]], seg(28, 14), rx), { color: '#c9ced6', outline: 0.006 });
    ps.add(lathe([[0.055, -0.002], [0.078, -0.002]], seg(28, 14), rx), { color: '#c9ced6', outline: 0.006 });
    for (let k = 0; k < 3; k++) {
      const d = v(0, Math.sin((k / 3) * Math.PI * 2), Math.cos((k / 3) * Math.PI * 2));
      spokes.add(bar(rx.clone().addScaledVector(d, 0.018), rx.clone().addScaledVector(d, 0.058), 0.006, 0.012), { color: '#55585f' });
    }
  }
  if (w.cog) ps.add(gear(v(hub.x + w.cog.x, hub.y, hub.z), w.cog.r, w.cog.teeth, 0.006, seg), { color: '#a9afb8', outline: 0.006 });
}
