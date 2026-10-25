// 儿童滑步车 kidbike: tiny pastel balance bike — no pedals (feet paddle the road, then glide on the foot
// pegs), chunky foam tyres on mag wheels, rainbow streamers fluttering from the grips, star stickers, a bell.
import { Vector3 } from 'three';
import { cyl, ellip, pill, roundRing, v, type V3 } from '../build/geo';
import { strip } from '../build/strip';
import { fender, tubeDecal } from '../parts/accessories';
import { caliper } from '../parts/brakes';
import { rearRun } from '../parts/cables';
import { bell, flatBar, stem } from '../parts/cockpit';
import { reflector } from '../parts/fittings';
import { bentTube, fork, frameTube, headTube, lug, saddle, seatpost } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeBuilder, BikeDef, GroupName } from '../template';

const PINK = '#ff9ec7', LILAC = '#bda8ff', YELLOW = '#ffe27a', MINT = '#8ff0cf', WHITE = '#fff6fa', FOAM = '#4b4f5c';
const TYRE = 0.032;
const PEG_L = new Vector3(-0.09, 0.205, 0.01), PEG_R = new Vector3(0.09, 0.205, 0.01);

const L = layout({
  R: 0.16, wb: 0.6, bb: [0.2, -0.02], seatAngle: 72, saddleY: 0.42,
  headAngle: 70, head: [0.35, 0.44], forkOffset: 0.03, crank: 0,
});

const LEN = 0.22, LINKS = 3;

/** Four tapered candy-striped ribbons trailing back from a grip end on a 3-bone chain (authored at full speed;
 *  animate.ts droops them at rest and sends a phase-lagged flutter down the chain at speed). */
function streamers(b: BikeBuilder, names: readonly [GroupName, GroupName, GroupName], end: V3, side: 1 | -1): void {
  const groups = names.map((n, j) => b.group(n, j ? names[j - 1] as GroupName : 'steer', end.clone().add(v(side * 0.01, -0.01 * j / LINKS, (LEN * j) / LINKS))));
  const cols = [PINK, YELLOW, MINT, LILAC];
  const normals = [v(1, 0, 0), v(0, 1, 0), v(0.7, 0.7, 0), v(-0.7, 0.7, 0)];
  cols.forEach((c, i) => {
    const spread = (i - 1.5) * 0.018;
    const at = (t: number): V3 => end.clone().add(v(side * (0.01 + spread * t * 2), -0.01 * t + spread * t, LEN * t));
    groups.forEach((ps, j) => {
      const pts = [0, 0.5, 1].map((q) => at((j + q) / LINKS));
      ps.add(strip(pts, 0.0095, { normal: normals[i] as V3, taper: (u) => 1 - (0.5 * (j + u)) / LINKS, colors: [c, WHITE] }));
    });
  });
}

function pegs(b: BikeBuilder): void {
  const frame = b.parts(null);
  frame.add(ellip(v(0, 0.192, 0.01), 0.042, 0.011, 0.04, b.seg(12, 8), b.seg(6, 4)), { color: FOAM, outline: 0.008 });
  for (const p of [PEG_L, PEG_R]) frame.add(pill(p.clone().setX(Math.sign(p.x) * 0.03), p.clone().setX(Math.sign(p.x) * 0.118), 0.017, b.seg(12, 8)), { color: YELLOW, outline: 0.008 });
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
    headTube(frame, L, 0.04, main, seg, WHITE);
    const low = v(0, 0.22, 0.01);
    bentTube(frame, [L.onAxis(0.41), v(0, 0.31, -0.13), low], 0.042, main, seg, 8);
    tubeDecal(frame, 'star', L.onAxis(0.4), v(0, 0.26, -0.07), 0.042, 0.07, 0.07, 0.62);
    frameTube(frame, low, L.seat(0.37), 0.037, main, seg);
    lug(frame, low, 0.046, main, seg);
    lug(frame, L.onAxis(0.41), 0.045, main, seg);
    const cluster = L.seat(0.34);
    lug(frame, cluster, 0.041, main, seg); // fillet where the seat stays meet the seat tube
    for (const s of [-1, 1]) {
      const drop = v(s * 0.054, L.hubR.y, L.hubR.z);
      frameTube(frame, v(s * 0.034, low.y, low.z + 0.02), drop, 0.018, main, seg, false, 0.015);
      frameTube(frame, cluster.clone().add(v(s * 0.03, -0.01, 0)), drop, 0.017, main, seg, false, 0.014);
    }
    pegs(b);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, tyreColor: FOAM, rim: 'mag', rimDepth: 0.016, rimColor: LILAC, mag: 4, hubColor: WHITE, hubW: 0.05 };
    wheel(b, 'R', L.hubR, w);
    wheel(b, 'F', L.hubF, w);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.03);
    fork(st, L, { halfW: 0.058, r: 0.019, look: main, kind: 'rigid', crown: { color: WHITE } }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.03, -0.03));
    stem(st, steererTop, clamp, WHITE, seg);
    const bars = flatBar(st, clamp, 0.2, 0.05, WHITE, YELLOW, seg);
    bell(st, bars.bell, YELLOW, seg);
    if (bars.endL) streamers(b, ['streamerL', 'streamerL2', 'streamerL3'], bars.endL, -1);
    if (bars.endR) streamers(b, ['streamerR', 'streamerR2', 'streamerR3'], bars.endR, 1);
    const brake = caliper(frame, L.hubR, L.s.R, L.s.R - TYRE * 1.55, TYRE, 120, WHITE, seg);
    rearRun(b, L, bars.cableR, [v(0.024, 0.352, -0.13), low.clone().add(v(0.028, 0.042, -0.012)), L.seat(0.29).add(v(0.03, 0, 0.032)),
      brake.clone().add(v(0.012, 0.03, -0.012)), brake.clone().add(v(0, 0.012, 0))], 0.04, seg, LILAC);
    fender(frame, L.hubR, L.s.R, 12, 108, 0.048, MINT, seg); // pastel rear fender: the balance bike from behind
    seatpost(frame, L, 0.36, 0.019, WHITE, seg);
    frame.detail.add(roundRing(L.seat(0.372), L.seatDir, 0.019, 0.042, 0.022, seg(14, 8)), { color: WHITE, outline: 0.01 });
    saddle(frame, L.saddle, 'kid', WHITE, seg);
    reflector(frame, L.seat(0.385).add(v(0, 0, 0.02)), v(0, 0, 1), '#e01b24', 0.03, 0.02);
    const lens = clamp.clone().add(v(0, -0.032, -0.024));
    st.detail.add(cyl(lens, lens.clone().add(v(0, 0, -0.008)), 0.016, 0.016, seg(12, 8), true), { color: '#f4f4f4', outline: 0.006 });
    b.marker('saddle', null, L.saddle);
    b.marker('gripL', 'steer', bars.gripL);
    b.marker('gripR', 'steer', bars.gripR);
    b.marker('bell', 'steer', bars.bell.clone().add(v(0.02, 0.02, 0)));
    b.marker('pedalL', null, PEG_L);
    b.marker('pedalR', null, PEG_R);
  },
};
