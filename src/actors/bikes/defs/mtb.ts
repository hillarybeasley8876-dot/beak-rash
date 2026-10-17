// 山地车 mtb: orange hardtail — fat knobbly tyres, suspension fork with gold stanchions, wide flat bar,
// disc brakes front and rear, cassette cog, "越野王 OFF-ROAD" on the down tube.
import { v } from '../build/geo';
import { tubeDecal } from '../parts/accessories';
import { discCaliper } from '../parts/brakes';
import { bell, flatBar, stem } from '../parts/cockpit';
import { diamond, drivetrain, riderMarkers } from '../parts/diamond';
import { reflector } from '../parts/fittings';
import { fork, saddle, seatpost } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeDef } from '../template';

const ORANGE = '#ff7a1a', BLACK = '#1d1e23', GREY = '#3a3d44';
const TYRE = 0.034;

const L = layout({
  R: 0.3, wb: 0.94, bb: [0.25, 0.06], seatAngle: 73, saddleY: 0.7,
  headAngle: 67, head: [0.6, 0.71], forkOffset: 0.045, crank: 0.125, pedalX: 0.11,
});

export const mtb: BikeDef = {
  id: 'mtb',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 4.2 },
  detail: 0.9,
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: ORANGE, paint: 1 };
    const d = diamond(b, L, {
      main, chainstays: { color: ORANGE, paint: 1 },
      r: { top: 0.027, down: 0.034, seat: 0.026, cs: 0.017, ss: 0.014, head: 0.034 },
      clusterY: 0.6, topY: 0.675,
    });
    tubeDecal(frame, 'offroad', L.bb, d.downFront, 0.034, 0.22, 0.05, 0.5);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, knobs: true, rim: 'box', rimDepth: 0.02, rimColor: '#585c63', spokes: 14, spokeColor: GREY, hubColor: BLACK, rotor: true };
    wheel(b.parts('wheelR'), L.hubR, { ...w, cog: { r: 0.046, teeth: 16, x: 0.054 } }, seg);
    wheel(b.parts('wheelF'), L.hubF, w, seg);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.03);
    fork(st, L, { halfW: 0.062, r: 0.02, look: { color: BLACK }, kind: 'susp', crown: { color: BLACK }, stanchion: '#e0b84c' }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.012, -0.055));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = flatBar(st, clamp, 0.3, 0.03, BLACK, BLACK, seg);
    bell(st, bars.bell, ORANGE, seg);
    const rotorX = -0.045 - 0.006;
    const leverL = bars.gripL.clone().add(v(0.09, 0.01, -0.03));
    discCaliper(st, L.hubF, rotorX, 38, '#e5191c', seg, [L.onAxis(0.5).setX(-0.075), leverL]);
    discCaliper(frame, L.hubR, rotorX, 128, '#e5191c', seg);
    seatpost(frame, L, 0.6, 0.014, BLACK, seg);
    saddle(frame, L.saddle, 'road', BLACK, seg);
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.07, teeth: 16, cogR: 0.046, cogTeeth: 16, pedalColor: BLACK });
    reflector(frame, L.seat(0.62).add(v(0, 0, 0.018)), v(0, 0, 1), '#e01b24', 0.028, 0.04);
    riderMarkers(b, L, bars);
  },
};
