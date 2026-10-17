// 儿童滑步车 kidbike: tiny pastel balance bike — no pedals (feet paddle the road, then glide on the foot
// pegs), chunky foam tyres on mag wheels, rainbow streamers fluttering from the grips, star stickers, a bell.
import { Vector3 } from 'three';
import { box, cyl, v, type V3 } from '../build/geo';
import { strip } from '../build/strip';
import { tubeDecal } from '../parts/accessories';
import { caliper } from '../parts/brakes';
import { bell, flatBar, stem } from '../parts/cockpit';
import { reflector } from '../parts/fittings';
import { bentTube, fork, frameTube, headTube, lug, saddle, seatpost } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeBuilder, BikeDef } from '../template';
import type { PartSet } from '../build/partset';

const PINK = '#ff9ec7', LILAC = '#bda8ff', YELLOW = '#ffe27a', MINT = '#8ff0cf', WHITE = '#fff6fa', FOAM = '#4b4f5c';
const TYRE = 0.03;
const PEG_L = new Vector3(-0.09, 0.205, 0.01), PEG_R = new Vector3(0.09, 0.205, 0.01);

const L = layout({
  R: 0.16, wb: 0.6, bb: [0.2, -0.02], seatAngle: 72, saddleY: 0.42,
  headAngle: 70, head: [0.35, 0.44], forkOffset: 0.03, crank: 0,
});

/** Four tapered ribbons trailing back from a grip end (authored at full speed; animate.ts droops them). */
function streamers(ps: PartSet, end: V3, side: 1 | -1): void {
  const cols = [PINK, YELLOW, MINT, LILAC];
  const normals = [v(1, 0, 0), v(0, 1, 0), v(0.7, 0.7, 0), v(-0.7, 0.7, 0)];
  cols.forEach((c, i) => {
    const spread = (i - 1.5) * 0.018;
    const pts: V3[] = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      pts.push(end.clone().add(v(side * (0.01 + spread * t * 2), -0.01 * t + spread * t, 0.22 * t)));
    }
    ps.add(strip(pts, 0.0095, { normal: normals[i] as V3, taper: (t) => 1 - 0.5 * t }), { color: c });
  });
}

function pegs(b: BikeBuilder): void {
  const frame = b.parts(null);
  frame.add(box(v(0, 0.19, 0.01), 0.07, 0.016, 0.07), { color: FOAM, outline: 0.006 });
  for (const p of [PEG_L, PEG_R]) frame.add(cyl(p.clone().setX(Math.sign(p.x) * 0.03), p.clone().setX(Math.sign(p.x) * 0.115), 0.016, 0.016, b.seg(8, 5), true), { color: YELLOW, outline: 0.006 });
}

export const kidbike: BikeDef = {
  id: 'kidbike',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'balance', gear: 1.0, pegs: { L: PEG_L, R: PEG_R }, stride: { x: 0.17, ahead: 0.22, behind: 0.2, lift: 0.1 } },
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: PINK, paint: 1 };
    headTube(frame, L, 0.03, main, seg, WHITE);
    const low = v(0, 0.22, 0.01);
    bentTube(frame, [L.onAxis(0.41), v(0, 0.31, -0.13), low], 0.032, main, seg, 8);
    tubeDecal(frame, 'star', L.onAxis(0.4), v(0, 0.26, -0.07), 0.032, 0.06, 0.06, 0.62);
    frameTube(frame, low, L.seat(0.37), 0.028, main, seg);
    lug(frame, low, 0.034, main, seg);
    const cluster = L.seat(0.34);
    for (const s of [-1, 1]) {
      const drop = v(s * 0.045, L.hubR.y, L.hubR.z);
      frameTube(frame, v(s * 0.022, low.y, low.z + 0.02), drop, 0.016, main, seg, false, 0.013);
      frameTube(frame, cluster.clone().add(v(s * 0.02, -0.01, 0)), drop, 0.015, main, seg, false, 0.012);
    }
    pegs(b);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, tyreColor: FOAM, rim: 'mag', rimDepth: 0.016, rimColor: LILAC, mag: 4, hubColor: WHITE, hubW: 0.04 };
    wheel(b.parts('wheelR'), L.hubR, w, seg);
    wheel(b.parts('wheelF'), L.hubF, w, seg);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.03);
    fork(st, L, { halfW: 0.046, r: 0.016, look: main, kind: 'rigid', crown: { color: WHITE } }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.03, -0.03));
    stem(st, steererTop, clamp, WHITE, seg);
    const bars = flatBar(st, clamp, 0.2, 0.05, WHITE, YELLOW, seg);
    bell(st, bars.bell, YELLOW, seg);
    for (const [name, end, s] of [['streamerL', bars.endL, -1], ['streamerR', bars.endR, 1]] as const) {
      if (end) streamers(b.group(name, 'steer', end), end, s);
    }
    caliper(frame, L.hubR, L.s.R, L.s.R - TYRE * 1.55, TYRE, 120, WHITE, seg);
    seatpost(frame, L, 0.36, 0.014, WHITE, seg);
    saddle(frame, L.saddle, 'kid', WHITE, seg);
    reflector(frame, L.seat(0.385).add(v(0, 0, 0.02)), v(0, 0, 1), '#e01b24', 0.03, 0.02);
    reflector(st, clamp.clone().add(v(0, -0.03, -0.025)), v(0, 0, -1), '#f4f4f4', 0.03, 0.02);
    b.marker('saddle', null, L.saddle);
    b.marker('gripL', 'steer', bars.gripL);
    b.marker('gripR', 'steer', bars.gripR);
    b.marker('bell', 'steer', bars.bell.clone().add(v(0.02, 0.02, 0)));
    b.marker('pedalL', null, PEG_L);
    b.marker('pedalR', null, PEG_R);
  },
};
