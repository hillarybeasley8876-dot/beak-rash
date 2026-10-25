// The LLM edition's frame (SPEC §21 #2): the roadbike's triangle with one tube too many — a second top
// tube crosses the main triangle diagonally — and the down tube stops in mid-air, short of the bottom
// bracket. The rider's seat, cranks and bars are untouched, so the bike still rides.
import { box, roundRing, v, type Seg, type V3 } from '../../build/geo';
import type { PartSet } from '../../build/partset';
import { bbShell } from '../../parts/drive';
import { frameTube, headTube, lug, type Look } from '../../parts/frame';
import { TOY_MAIN, TOY_STAYS } from '../../parts/diamond';
import type { Layout } from '../../parts/layout';

export interface FrameLooks {
  main: Look;        // head tube, top tube, seat tube
  accent: Look;      // the extra diagonal tube
  stays: Look;
  chainstays: Look;
}

export interface FrameRadii {
  top: number; down: number; seat: number; cs: number; ss: number; head: number;
}

export interface WrongFrame {
  cluster: V3;   // top of the seat tube
  topFront: V3;  // where the (diving) top tube meets the head tube
  downFront: V3; // where the (short) down tube stops
}

/** The frame: the diamond with a diving top tube, a diagonal second top tube and a down tube that
 *  never reaches the bottom bracket. */
export function wrongFrame(ps: PartSet, L: Layout, looks: FrameLooks, r: FrameRadii,
  clusterY: number, topY: number, downY: number, seg: Seg): WrongFrame {
  const top = r.top * TOY_MAIN, down = r.down * TOY_MAIN, seat = r.seat * TOY_MAIN;
  const csR = r.cs * TOY_STAYS, ssR = r.ss * TOY_STAYS;
  headTube(ps, L, r.head * TOY_MAIN, looks.main, seg);
  const cluster = L.seat(clusterY);
  const topFront = L.onAxis(topY);
  const downFront = L.onAxis(downY);
  // The down tube stops 15 cm above the bottom bracket: its lower end floats in the air.
  const downEnd = L.bb.clone().lerp(downFront, 0.27);
  frameTube(ps, cluster, topFront, top, looks.main, seg);
  frameTube(ps, downEnd, downFront, down, looks.main, seg);
  frameTube(ps, L.bb, L.seat(clusterY + 0.025), seat, looks.main, seg);
  // The tube too many: a second top tube, straight across the triangle from the head tube to the seat tube.
  const cross = L.onAxis(clusterY + 0.12);
  frameTube(ps, cross, L.seat(clusterY - 0.06), r.seat * TOY_MAIN * 0.85, looks.accent, seg);
  lug(ps, cluster, top * 1.18, looks.main, seg);
  lug(ps, topFront, top * 1.12, looks.main, seg);
  lug(ps, downFront, down * 1.08, looks.main, seg);
  lug(ps, downEnd, down * 1.05, looks.main, seg);
  ps.detail.add(roundRing(L.seat(clusterY + 0.028), L.seatDir, seat * 0.6, seat * 1.14, 0.034, seg(14, 8)), { color: '#2b2d33', outline: 0.01 });
  const dx = 0.052;
  for (const s of [-1, 1]) {
    const drop = v(s * dx, L.hubR.y, L.hubR.z);
    frameTube(ps, v(s * 0.04, L.bb.y, L.bb.z + 0.02), drop, csR, looks.chainstays, seg, false, csR * 0.8);
    frameTube(ps, cluster.clone().add(v(s * 0.03, -0.015, -0.004)), drop, ssR, looks.stays, seg, false, ssR * 0.85);
    ps.detail.add(box(drop.clone().add(v(0, -0.004, -0.006)), 0.012, 0.04, 0.045), { color: '#3a3d44', outline: 0.006 });
  }
  bbShell(ps, L.bb, looks.main.color, seg, looks.main.paint);
  return { cluster, topFront, downFront };
}
