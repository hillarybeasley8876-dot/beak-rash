// 死飞 fixie: neon track bike — horizontal top tube, deep-V rims (pink front, mint rear), bullhorn bars,
// fixed cog (the cranks never stop), and NO brakes ("NO BRAKES" on the top tube says it twice).
import { v } from '../build/geo';
import { tubeDecal } from '../parts/accessories';
import { bell, bullhorn, stem } from '../parts/cockpit';
import { diamond, drivetrain, riderMarkers } from '../parts/diamond';
import { reflector } from '../parts/fittings';
import { fork, saddle, seatpost } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeDef } from '../template';

const NEON = '#c6ff1f', BLACK = '#1d1e23', PINK = '#ff4fa3', MINT = '#3fe0b5';
const TYRE = 0.018;

const L = layout({
  R: 0.28, wb: 0.84, bb: [0.225, 0.04], seatAngle: 75, saddleY: 0.68,
  headAngle: 74, head: [0.585, 0.665], forkOffset: 0.035, crank: 0.12, pedalX: 0.1,
});

export const fixie: BikeDef = {
  id: 'fixie',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'fixed', gear: 3.4 },
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: NEON, paint: 1 };
    const d = diamond(b, L, {
      main, r: { top: 0.025, down: 0.029, seat: 0.024, cs: 0.015, ss: 0.013, head: 0.03 },
      clusterY: 0.63, topY: 0.63, dropoutX: 0.05,
    });
    tubeDecal(frame, 'nobrakes', d.cluster, d.topFront, 0.025, 0.19, 0.036, 0.5);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, rim: 'deepV', rimDepth: 0.05, rimColor: PINK, spokes: 16, spokeColor: BLACK, hubColor: BLACK };
    wheel(b.parts('wheelR'), L.hubR, { ...w, rimColor: MINT, cog: { r: 0.03, teeth: 12, x: 0.054 } }, seg);
    wheel(b.parts('wheelF'), L.hubF, w, seg);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.025);
    fork(st, L, { halfW: 0.048, r: 0.014, look: main, kind: 'rigid' }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, -0.004, -0.042));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = bullhorn(st, clamp, 0.17, BLACK, PINK, seg);
    bell(st, bars.bell, BLACK, seg);
    seatpost(frame, L, 0.63, 0.0125, BLACK, seg);
    saddle(frame, L.saddle, 'road', BLACK, seg);
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.085, teeth: 20, cogR: 0.03, cogTeeth: 12, ringColor: '#d9dde3' });
    reflector(frame, L.seat(0.65).add(v(0, 0, 0.018)), v(0, 0, 1), '#e01b24', 0.024, 0.03);
    reflector(st, clamp.clone().add(v(0, -0.03, -0.028)), v(0, 0, -1), '#f4f4f4', 0.03, 0.02);
    riderMarkers(b, L, bars);
  },
};
