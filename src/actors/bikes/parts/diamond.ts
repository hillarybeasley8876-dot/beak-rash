// Shared assembly for upright bikes: the diamond frame, the drivetrain across its groups, and the
// rider markers (saddle / grips / pedals / bell) that the riders' IK reads.
import { box, cyl, v, type V3 } from '../build/geo';
import type { BikeBuilder } from '../template';
import type { BarResult } from './cockpit';
import { bbShell, chain, crankset, pedal, type CrankSpec } from './drive';
import { frameTube, headTube, lug, type Look } from './frame';
import { pedalRest, type Layout } from './layout';

export interface DiamondSpec {
  main: Look;
  stays?: Look;              // seat stays (default main)
  chainstays?: Look;         // chain stays (default stays)
  r: { top: number; down: number; seat: number; cs: number; ss: number; head: number };
  clusterY: number;          // seat-cluster height (top of the seat tube)
  topY: number;              // top-tube front end height on the head tube
  downY?: number;            // down-tube front end height (default head bottom + 0.02)
  dropoutX?: number;
}

export interface DiamondPoints { cluster: V3; topFront: V3; downFront: V3; dropoutX: number }

export function diamond(b: BikeBuilder, L: Layout, d: DiamondSpec): DiamondPoints {
  const ps = b.parts(null), seg = b.seg;
  const stays = d.stays ?? d.main, cs = d.chainstays ?? stays;
  const dx = d.dropoutX ?? 0.052;
  headTube(ps, L, d.r.head, d.main, seg);
  const cluster = L.seat(d.clusterY);
  const topFront = L.onAxis(d.topY), downFront = L.onAxis(d.downY ?? L.headBot.y + 0.02);
  frameTube(ps, cluster, topFront, d.r.top, d.main, seg);
  frameTube(ps, L.bb, downFront, d.r.down, d.main, seg);
  frameTube(ps, L.bb, L.seat(d.clusterY + 0.025), d.r.seat, d.main, seg);
  lug(ps, cluster, d.r.top * 1.15, d.main, seg);
  ps.add(cyl(L.seat(d.clusterY + 0.012), L.seat(d.clusterY + 0.04), d.r.seat * 1.18, d.r.seat * 1.18, seg(9, 6)), { color: '#2b2d33', outline: 0.006 });
  for (const s of [-1, 1]) {
    const drop = v(s * dx, L.hubR.y, L.hubR.z);
    frameTube(ps, v(s * 0.03, L.bb.y, L.bb.z + 0.02), drop, d.r.cs, cs, seg, false, d.r.cs * 0.8);
    frameTube(ps, cluster.clone().add(v(s * 0.02, -0.015, -0.004)), drop, d.r.ss, stays, seg, false, d.r.ss * 0.85);
    ps.add(box(drop.clone().add(v(0, -0.004, -0.006)), 0.012, 0.04, 0.045), { color: '#3a3d44', outline: 0.005 });
  }
  bbShell(ps, L.bb, d.main.color, seg, d.main.paint);
  return { cluster, topFront, downFront, dropoutX: dx };
}

export interface DriveOpts extends CrankSpec {
  cogR: number;
  cogTeeth: number;
  pedalColor?: string;
  chainX?: number;
  /** Chain points per wrapped arc (default by quality). */
  chainArc?: number;
}

/** Crank set + pedals into their groups, cog onto the rear wheel group, chain on the frame. */
export function drivetrain(b: BikeBuilder, L: Layout, o: DriveOpts, bb = L.bb, groups: { crank: 'crank' | 'crank2'; pl: 'pedalL' | 'pedal2L'; pr: 'pedalR' | 'pedal2R' } = { crank: 'crank', pl: 'pedalL', pr: 'pedalR' }): void {
  crankset(b.parts(groups.crank), bb, o, b.seg);
  pedal(b.parts(groups.pr), pedalRest(bb, L, 1), 1, o.pedalColor, b.seg, o.armX);
  pedal(b.parts(groups.pl), pedalRest(bb, L, -1), -1, o.pedalColor, b.seg, o.armX);
  const x = o.chainX ?? 0.056;
  if (o.cogR > 0) chain(b.parts(null), bb, o.ringR, L.hubR, o.cogR, x, b.seg, o.chainArc);
}

/** Saddle, grips, pedals and bell markers in their proper parents. */
export function riderMarkers(b: BikeBuilder, L: Layout, bars: BarResult): void {
  b.marker('saddle', null, L.saddle);
  b.marker('gripL', 'steer', bars.gripL);
  b.marker('gripR', 'steer', bars.gripR);
  b.marker('bell', 'steer', bars.bell.clone().add(v(0.02, 0.02, 0)));
  if (b.has('pedalL')) {
    b.marker('pedalL', 'pedalL', pedalRest(L.bb, L, -1));
    b.marker('pedalR', 'pedalR', pedalRest(L.bb, L, 1));
  }
}
