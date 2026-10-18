// 风之翼 roadbike: red/white carbon racer — deep two-tone rims, drop bars, side number plate "01".
import { v } from '../build/geo';
import { fender, tubeDecal } from '../parts/accessories';
import { caliper } from '../parts/brakes';
import { along, frontLoop, rearRun } from '../parts/cables';
import { bell, dropBar, stem } from '../parts/cockpit';
import { diamond, drivetrain, riderMarkers, TOY_MAIN } from '../parts/diamond';
import { rearPlate, reflector, tailLight } from '../parts/fittings';
import { fork, saddle, seatpost } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeDef } from '../template';

const RED = '#e5191c', WHITE = '#f4f2ec', BLACK = '#1f2024', SILVER = '#c3c8d0', CARBON = '#2a2c31';
const TYRE = 0.022, TYRE_R = 0.025; // fatter rear tyre: reads from the chase camera

const L = layout({
  R: 0.27, wb: 0.84, bb: [0.215, 0.045], seatAngle: 74, saddleY: 0.67,
  headAngle: 72, head: [0.565, 0.655], forkOffset: 0.04, crank: 0.12, pedalX: 0.105,
});

export const roadbike: BikeDef = {
  id: 'roadbike',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 5 },
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: RED, paint: 1 };
    const d = diamond(b, L, {
      main, stays: { color: WHITE }, chainstays: { color: BLACK },
      r: { top: 0.026, down: 0.032, seat: 0.025, cs: 0.015, ss: 0.013, head: 0.032 },
      clusterY: 0.585, topY: 0.635,
    });
    tubeDecal(frame, 'wind', L.bb, d.downFront, 0.032, 0.2, 0.05, 0.52);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, rim: 'deep', rimDepth: 0.042, rimColor: WHITE, spokes: true, spokeColor: CARBON };
    wheel(b, 'R', L.hubR, { ...w, tyre: TYRE_R, cog: { r: 0.034, teeth: 12, x: 0.056 } });
    wheel(b, 'F', L.hubF, w);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.03);
    fork(st, L, { halfW: 0.05, r: 0.017, look: { color: WHITE }, kind: 'rigid', crown: main }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.01, -0.06));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = dropBar(st, clamp, 0.16, BLACK, seg);
    bell(st, bars.bell, SILVER, seg);
    const brakeF = caliper(st, L.hubF, L.s.R, L.s.R - TYRE * 1.55, TYRE, 66, SILVER, seg);
    const brakeR = caliper(frame, L.hubR, L.s.R, L.s.R - TYRE_R * 1.55, TYRE_R, 131, SILVER, seg);
    const headR = 0.032 * TOY_MAIN, topR = 0.026 * TOY_MAIN;
    frontLoop(st, L, bars.cableR, brakeF.clone().add(v(0, 0.012, 0)), headR, seg);
    rearRun(b, L, bars.cableL, [...along(d.topFront, d.cluster, v(-0.016, topR + 0.003, 0)), d.cluster.clone().add(v(-0.04, -0.005, 0.03)),
      brakeR.clone().add(v(-0.012, 0.035, 0.0)), brakeR.clone().add(v(0, 0.012, 0))], headR, seg);
    seatpost(frame, L, 0.6, 0.016, BLACK, seg);
    saddle(frame, L.saddle, 'road', BLACK, seg);
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.075, teeth: 18, cogR: 0.034, cogTeeth: 12 });
    reflector(frame, L.seat(0.6).add(v(0, -0.01, 0.017)), v(0, 0, 1), '#e01b24', 0.03, 0.045);
    reflector(st, clamp.clone().add(v(0, -0.035, -0.03)), v(0, 0, -1), '#f4f4f4', 0.035, 0.022);
    // Rear signature for the chase camera, between the rider's legs: rear-facing "01" race plate under the saddle
    // with a chunky self-lit tail light on its top edge, over a slim red race fender.
    fender(frame, L.hubR, L.s.R, 16, 110, 0.036, RED, seg);
    rearPlate(frame, v(0, 0.545, 0.262), 0.096, 0.07, L.seat(0.572).add(v(0, 0, 0.012)));
    tailLight(frame, v(0, 0.589, 0.273), L.seat(0.598).add(v(0, 0, 0.012)), 0.096, 0.019, 'decal', seg);
    riderMarkers(b, L, bars);
  },
};
