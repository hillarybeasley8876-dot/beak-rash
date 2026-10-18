// 共享单车 shared bike: chunky bright-yellow step-through city bike — solid tyres on mag wheels, front grid
// basket, QR-code plate under the saddle, "扫码骑行" chain case, drum brakes, kickstand.
import { box, v, type V3 } from '../build/geo';
import { decal, fender } from '../parts/accessories';
import { housing, rearRun } from '../parts/cables';
import { bell, stem, sweptBar } from '../parts/cockpit';
import { drivetrain, riderMarkers, TOY_STAYS } from '../parts/diamond';
import { basket, chainGuard, kickstand, lamp, reflector } from '../parts/fittings';
import { bentTube, fork, frameTube, headTube, lug, saddle, seatpost } from '../parts/frame';
import { bbShell } from '../parts/drive';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeDef } from '../template';

const YELLOW = '#ffc61a', BLACK = '#232429', GREY = '#8e949c', TYRE_C = '#34353b';
const TYRE = 0.03;

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
    headTube(frame, L, 0.042, main, seg, BLACK);
    const low = v(0, 0.33, -0.06);
    bentTube(frame, [L.onAxis(0.65), L.onAxis(0.6).add(v(0, -0.06, 0.06)), v(0, 0.4, -0.16), low, L.bb.clone().add(v(0, 0.02, 0.02))], 0.045, main, seg, 10);
    const cluster = L.seat(0.64);
    frameTube(frame, L.bb, L.seat(0.665), 0.038, main, seg);
    lug(frame, cluster, 0.044, main, seg);
    lug(frame, L.onAxis(0.65), 0.047, main, seg);
    lug(frame, L.bb.clone().add(v(0, 0.01, 0)), 0.05, main, seg);
    const cs = 0.018 * TOY_STAYS, ss = 0.016 * TOY_STAYS;
    for (const s of [-1, 1]) {
      const drop = v(s * 0.058, L.hubR.y, L.hubR.z);
      frameTube(frame, v(s * 0.042, L.bb.y, L.bb.z + 0.02), drop, cs, main, seg, false, cs * 0.8);
      frameTube(frame, cluster.clone().add(v(s * 0.032, -0.02, 0)), drop, ss, main, seg, false, ss * 0.8);
    }
    bbShell(frame, L.bb, YELLOW, seg, 1);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, tyreColor: TYRE_C, rim: 'mag', rimDepth: 0.02, rimColor: GREY, mag: 5, hubColor: GREY, drum: BLACK };
    wheel(b, 'R', L.hubR, w);
    wheel(b, 'F', L.hubF, w);
    fender(frame, L.hubR, L.s.R + 0.006, -20, 125, 0.044, YELLOW, seg);
    fender(st, L.hubF, L.s.R + 0.006, 40, 172, 0.044, YELLOW, seg);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.07);
    fork(st, L, { halfW: 0.061, r: 0.02, look: main, kind: 'rigid', crown: { color: BLACK } }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.025, -0.02));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = sweptBar(st, clamp, 0.25, 0.12, 0.03, BLACK, BLACK, seg, true);
    // Drum-brake cables (drums on the left): right lever crosses in front of the head tube and runs down the left
    // fork blade; left lever → head tube → along the left of the down tube and chainstay.
    const drum = (hub: V3, dz: number): V3 => hub.clone().add(v(-0.068, 0.05, dz));
    const blade = (t: number): V3 => L.headBot.clone().addScaledVector(L.axis, -0.03).setX(-0.061).lerp(L.hubF.clone().setX(-0.061), t);
    if (bars.cableR && bars.cableL) {
      housing(st, [bars.cableR, bars.cableR.clone().add(v(-0.03, 0.03, -0.05)), L.onAxis(L.headBot.y + 0.02).add(v(-0.03, 0, -0.08)),
        blade(0.2).add(v(-0.026, 0, -0.012)), blade(0.62).add(v(-0.022, 0, -0.004)), drum(L.hubF, -0.01)], seg);
      const stay = v(-0.042, L.bb.y, L.bb.z + 0.02).lerp(v(-0.058, L.hubR.y, L.hubR.z), 0.5).add(v(-0.012, 0.028, 0));
      rearRun(b, L, bars.cableL, [L.onAxis(0.6).add(v(-0.052, -0.06, 0.07)), v(-0.054, 0.4, -0.15), v(-0.054, 0.33, -0.05),
        L.bb.clone().add(v(-0.05, 0.04, 0.05)), stay, drum(L.hubR, -0.03)], 0.042, seg);
    }
    bell(st, bars.bell, YELLOW, seg);
    const crown = L.headBot.clone().addScaledVector(L.axis, -0.03);
    const floor = v(0, 0.64, L.hubF.z - 0.06);
    b.marker('basket', 'steer', basket(st, floor, 0.27, 0.15, 0.2, BLACK, [floor.clone().add(v(0, 0, 0.1)), crown.clone().add(v(0, 0.02, -0.03))], seg));
    lamp(st, crown.clone().add(v(0, -0.02, -0.075)), v(0, 0, -1), crown.clone().add(v(0, -0.01, -0.02)), BLACK, seg, 0.03);
    seatpost(frame, L, 0.65, 0.02, '#c3c8d0', seg);
    saddle(frame, L.saddle, 'wide', BLACK, seg);
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.085, teeth: 20, cogR: 0, cogTeeth: 0, rings: [], armX: 0.088, pedalColor: BLACK });
    chainGuard(frame, L.bb, 0.085, L.hubR, 0.04, 0.07, YELLOW, seg, 'scan');
    const plate = L.seat(0.6).add(v(0, 0, 0.075));
    frame.add(box(plate, 0.13, 0.13, 0.01), { color: '#f4f2ec', outline: 0.007 });
    decal(frame, 'qr', plate.clone().add(v(0, 0, 0.0055)), v(0, 0, 1), v(0, 1, 0), 0.115, 0.115);
    kickstand(frame, v(-0.05, L.bb.y + 0.005, L.bb.z + 0.09), v(-0.075, L.bb.y - 0.02, L.bb.z + 0.36), BLACK, seg);
    reflector(frame, v(0, L.hubR.y + Math.sin(0.25) * 0.338, L.hubR.z + Math.cos(0.25) * 0.338), v(0, 0.25, 1), '#e01b24', 0.05, 0.03);
    riderMarkers(b, L, bars);
  },
};
