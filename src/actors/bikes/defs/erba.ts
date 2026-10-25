// 二八大杠 erba: grandpa's heavy black 28-inch roadster — horizontal "big bar", rod brakes, full chain
// case ("28 · 载重"), chrome rear rack, mudguards, front lamp, sprung leather saddle, faded head badge.
import { Vector3 } from 'three';
import { cyl, tube, v, type V3 } from '../build/geo';
import { decal, fender, rack } from '../parts/accessories';
import { rodBrake } from '../parts/brakes';
import { bell, stem, sweptBar } from '../parts/cockpit';
import { diamond, drivetrain, riderMarkers } from '../parts/diamond';
import { chainGuard, lamp, reflector } from '../parts/fittings';
import { fork, saddle, seatpost } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeBuilder, BikeDef } from '../template';

const BLACK = '#1d2433', CHROME = '#d3d8df', GOLD = '#c9a24a', LEATHER = '#6b3f2a';
const TYRE = 0.024;

const L = layout({
  R: 0.33, wb: 1.06, bb: [0.3, 0.085], seatAngle: 68, saddleY: 0.76,
  headAngle: 66, head: [0.64, 0.78], forkOffset: 0.07, crank: 0.14, pedalX: 0.13,
});

/** Two chrome coil springs under the back of the saddle. */
function springs(b: BikeBuilder, top: V3): void {
  if (b.far) return;
  const ps = b.parts(null), turns = 3, n = b.seg(10, 6);
  for (const s of [-1, 1]) {
    const c = top.clone().add(v(s * 0.055, -0.075, 0.075));
    const pts: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * turns * Math.PI * 2;
      pts.push(new Vector3(c.x + Math.cos(a) * 0.016, c.y + (i / n) * 0.05, c.z + Math.sin(a) * 0.016));
    }
    ps.add(tube(pts, 0.0035, Math.round(n * 0.8), 3), { color: CHROME, outline: 0.003 });
  }
}

export const erba: BikeDef = {
  id: 'erba',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 3 },
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: BLACK, paint: 1 };
    const d = diamond(b, L, {
      main, r: { top: 0.025, down: 0.027, seat: 0.024, cs: 0.015, ss: 0.013, head: 0.031 },
      clusterY: 0.712, topY: 0.712, downY: 0.665, dropoutX: 0.06,
    });
    const rimR = L.s.R - TYRE * 1.55;
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, rim: 'box', rimDepth: 0.016, rimColor: CHROME, spokes: true, spokeColor: CHROME, hubW: 0.05 };
    wheel(b, 'R', L.hubR, w);
    wheel(b, 'F', L.hubF, w);
    fender(frame, L.hubR, L.s.R, -18, 122, 0.034, BLACK, seg);
    fender(st, L.hubF, L.s.R, 48, 172, 0.034, BLACK, seg);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.05);
    fork(st, L, { halfW: 0.056, r: 0.018, look: main, kind: 'rigid', crown: { color: CHROME } }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.035, -0.03));
    stem(st, steererTop, clamp, CHROME, seg);
    const bars = sweptBar(st, clamp, 0.25, 0.16, 0.02, CHROME, '#2a2420', seg);
    bell(st, bars.bell, CHROME, seg);
    for (const [g, s] of [[bars.gripL, -1], [bars.gripR, 1]] as const) {
      st.detail.add(cyl(g.clone().add(v(-s * 0.07, 0.0, -0.06)), g.clone().add(v(s * 0.01, -0.012, -0.05)), 0.0045, 0.0045, 4), { color: CHROME, outline: 0.003 });
    }
    rodBrake(st, L.hubF, rimR, TYRE, 72, clamp.clone().add(v(0.03, -0.01, -0.03)), CHROME, seg);
    const rearTop = d.topFront.clone().add(v(0.035, -0.03, 0.03));
    const bend = d.cluster.clone().add(v(0.035, -0.03, -0.02));
    frame.detail.add(cyl(rearTop, bend, 0.0042, 0.0042, 4), { color: CHROME, outline: 0.003 });
    rodBrake(frame, L.hubR, rimR, TYRE, 118, bend, CHROME, seg);
    lamp(st, L.headBot.clone().add(v(0, 0.01, -0.085)), v(0, 0, -1), L.headBot.clone().add(v(0, 0.0, -0.03)), CHROME, seg, 0.042);
    seatpost(frame, L, 0.712, 0.017, CHROME, seg);
    saddle(frame, L.saddle, 'wide', LEATHER, seg);
    springs(b, L.saddle);
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.09, teeth: 24, cogR: 0, cogTeeth: 0, rings: [], armX: 0.09, armColor: CHROME, pedalColor: '#2b2b2b' });
    chainGuard(frame, L.bb, 0.09, L.hubR, 0.04, 0.072, BLACK, seg, 'guard');
    const rackTop = rack(frame, L.hubR, L.s.R * 2 + 0.06, 0.3, 0.78, 0.1, d.cluster.clone().add(v(0, -0.02, 0.02)), CHROME, seg);
    b.marker('rack', null, rackTop);
    reflector(frame, v(0, L.hubR.y + Math.sin(0.2) * 0.372, L.hubR.z + Math.cos(0.2) * 0.372), v(0, 0.2, 1), '#e01b24', 0.075, 0.046);
    const n = new Vector3(0, L.axis.z, -L.axis.y);
    decal(frame, 'badge', L.headMid.clone().addScaledVector(n, 0.033), n, L.axis, 0.05, 0.05);
    for (const y of [L.headBot.y + 0.005, L.headTop.y - 0.005]) frame.detail.add(cyl(L.onAxis(y - 0.004), L.onAxis(y + 0.004), 0.033, 0.033, seg(16, 8)), { color: GOLD });
    riderMarkers(b, L, bars);
  },
};
