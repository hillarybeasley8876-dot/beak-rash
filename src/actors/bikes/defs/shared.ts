// 共享单车 shared bike: chunky bright-yellow step-through city bike — solid tyres on mag wheels, front grid
// basket, QR-code plate under the saddle, "扫码骑行" chain case, drum brakes, kickstand.
import { box, v } from '../build/geo';
import { decal, fender } from '../parts/accessories';
import { bell, stem, sweptBar } from '../parts/cockpit';
import { drivetrain, riderMarkers } from '../parts/diamond';
import { basket, chainGuard, kickstand, lamp, reflector } from '../parts/fittings';
import { bentTube, fork, frameTube, headTube, lug, saddle, seatpost } from '../parts/frame';
import { bbShell } from '../parts/drive';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeDef } from '../template';

const YELLOW = '#ffc61a', BLACK = '#232429', GREY = '#8e949c', TYRE_C = '#34353b';
const TYRE = 0.026;

const L = layout({
  R: 0.29, wb: 1.0, bb: [0.25, 0.06], seatAngle: 70, saddleY: 0.72,
  headAngle: 68, head: [0.6, 0.74], forkOffset: 0.05, crank: 0.13, pedalX: 0.11,
});

export const shared: BikeDef = {
  id: 'shared',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 3.2 },
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: YELLOW, paint: 1 };
    headTube(frame, L, 0.034, main, seg, BLACK);
    const low = v(0, 0.33, -0.06);
    bentTube(frame, [L.onAxis(0.65), L.onAxis(0.6).add(v(0, -0.06, 0.06)), v(0, 0.4, -0.16), low, L.bb.clone().add(v(0, 0.02, 0.02))], 0.036, main, seg, 10);
    const cluster = L.seat(0.64);
    frameTube(frame, L.bb, L.seat(0.665), 0.03, main, seg);
    lug(frame, cluster, 0.032, main, seg);
    for (const s of [-1, 1]) {
      const drop = v(s * 0.055, L.hubR.y, L.hubR.z);
      frameTube(frame, v(s * 0.03, L.bb.y, L.bb.z + 0.02), drop, 0.018, main, seg, false, 0.015);
      frameTube(frame, cluster.clone().add(v(s * 0.022, -0.02, 0)), drop, 0.016, main, seg, false, 0.013);
    }
    bbShell(frame, L.bb, YELLOW, seg, 1);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, tyreColor: TYRE_C, rim: 'mag', rimDepth: 0.02, rimColor: GREY, mag: 5, hubColor: GREY, drum: BLACK };
    wheel(b.parts('wheelR'), L.hubR, w, seg);
    wheel(b.parts('wheelF'), L.hubF, w, seg);
    fender(frame, L.hubR, L.s.R + 0.006, -20, 125, 0.044, YELLOW, seg, 1);
    fender(st, L.hubF, L.s.R + 0.006, 40, 172, 0.044, YELLOW, seg, 1);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.07);
    fork(st, L, { halfW: 0.058, r: 0.017, look: main, kind: 'rigid', crown: { color: BLACK } }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.025, -0.02));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = sweptBar(st, clamp, 0.25, 0.12, 0.03, BLACK, BLACK, seg);
    bell(st, bars.bell, YELLOW, seg);
    const crown = L.headBot.clone().addScaledVector(L.axis, -0.03);
    const floor = v(0, 0.64, L.hubF.z - 0.06);
    b.marker('basket', 'steer', basket(st, floor, 0.27, 0.15, 0.2, BLACK, [floor.clone().add(v(0, 0, 0.1)), crown.clone().add(v(0, 0.02, -0.03))], seg));
    lamp(st, crown.clone().add(v(0, -0.02, -0.075)), v(0, 0, -1), crown.clone().add(v(0, -0.01, -0.02)), BLACK, seg, 0.03);
    seatpost(frame, L, 0.65, 0.016, '#c3c8d0', seg);
    saddle(frame, L.saddle, 'wide', BLACK, seg);
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.085, teeth: 20, cogR: 0, cogTeeth: 0, rings: [], armX: 0.088, pedalColor: BLACK });
    chainGuard(frame, L.bb, 0.085, L.hubR, 0.04, 0.07, YELLOW, seg, 1, 'scan');
    const plate = L.seat(0.6).add(v(0, 0, 0.075));
    frame.add(box(plate, 0.13, 0.13, 0.01), { color: '#f4f2ec', outline: 0.007 });
    decal(frame, 'qr', plate.clone().add(v(0, 0, 0.0055)), v(0, 0, 1), v(0, 1, 0), 0.115, 0.115);
    kickstand(frame, v(-0.05, L.bb.y + 0.005, L.bb.z + 0.09), v(-0.075, L.bb.y - 0.02, L.bb.z + 0.36), BLACK, seg);
    reflector(frame, v(0, L.hubR.y + Math.sin(0.25) * 0.338, L.hubR.z + Math.cos(0.25) * 0.338), v(0, 0.25, 1), '#e01b24', 0.05, 0.03);
    riderMarkers(b, L, bars);
  },
};
