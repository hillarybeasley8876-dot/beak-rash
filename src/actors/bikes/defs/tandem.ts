// 双人协力车 tandem: long teal two-seater — captain up front (the rider), stoker seat behind with a grumpy
// salted fish strapped on (marker `stoker`), stoker bars on the captain's seatpost, timing chain on the
// left keeps both crank sets in sync, drive chain on the right, "车上有咸鱼" sign on the back.
import { Euler } from 'three';
import { box, cyl, v } from '../build/geo';
import { decal, tubeDecal } from '../parts/accessories';
import { caliper } from '../parts/brakes';
import { bell, flatBar, stem } from '../parts/cockpit';
import { drivetrain, riderMarkers } from '../parts/diamond';
import { bbShell, chain, crankset, pedal } from '../parts/drive';
import { reflector } from '../parts/fittings';
import { fork, frameTube, headTube, lug, saddle, seatpost } from '../parts/frame';
import { layout, pedalRest, standardRig, type LayoutSpec } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeDef } from '../template';
import { saltFish } from './fish';

const TEAL = '#1fa5a0', CREAM = '#f3e7c9', LEATHER = '#6b3f2a', CHROME = '#c9ced6', BLACK = '#1d1e23';
const TYRE = 0.02, RING = 0.075;

const SPEC: LayoutSpec = {
  R: 0.28, wb: 1.6, bb: [0.235, -0.27], seatAngle: 73, saddleY: 0.68,
  headAngle: 71, head: [0.58, 0.67], forkOffset: 0.045, crank: 0.12, pedalX: 0.105,
};
const L = layout(SPEC);
const S = layout({ ...SPEC, bb: [0.235, 0.38] }); // stoker seat line

export const tandem: BikeDef = {
  id: 'tandem',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 4.4 },
  detail: 0.78,
  build(b) {
    standardRig(b, L, [{ crank: 'crank', bb: L.bb }, { crank: 'crank2', bb: S.bb }]);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: TEAL, paint: 1 }, cream = { color: CREAM };
    headTube(frame, L, 0.03, main, seg);
    const capC = L.seat(0.615), stoC = S.seat(0.615);
    frameTube(frame, L.onAxis(0.64), capC, 0.024, main, seg);
    frameTube(frame, capC, stoC, 0.022, main, seg);
    frameTube(frame, L.onAxis(0.605), L.bb, 0.029, main, seg);
    frameTube(frame, L.bb, L.seat(0.64), 0.024, main, seg);
    frameTube(frame, L.bb, S.bb, 0.026, main, seg);
    frameTube(frame, capC, S.bb, 0.02, cream, seg);
    frameTube(frame, S.bb, S.seat(0.64), 0.024, main, seg);
    lug(frame, capC, 0.027, main, seg);
    lug(frame, stoC, 0.026, main, seg);
    for (const s of [-1, 1]) {
      const drop = v(s * 0.052, L.hubR.y, L.hubR.z);
      frameTube(frame, v(s * 0.03, S.bb.y, S.bb.z + 0.02), drop, 0.014, main, seg, false, 0.012);
      frameTube(frame, stoC.clone().add(v(s * 0.02, -0.015, 0)), drop, 0.012, cream, seg, false, 0.011);
    }
    bbShell(frame, L.bb, TEAL, seg, 1);
    bbShell(frame, S.bb, TEAL, seg, 1);
    tubeDecal(frame, 'tandem', capC, stoC, 0.022, 0.2, 0.05);
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, rim: 'box', rimDepth: 0.018, rimColor: CHROME, spokes: 12, spokeColor: CHROME };
    wheel(b.parts('wheelR'), L.hubR, { ...w, cog: { r: 0.034, teeth: 12, x: 0.056 } }, seg);
    wheel(b.parts('wheelF'), L.hubF, w, seg);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.04);
    fork(st, L, { halfW: 0.05, r: 0.015, look: cream, kind: 'rigid', crown: main }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.02, -0.05));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = flatBar(st, clamp, 0.25, 0.035, BLACK, LEATHER, seg);
    bell(st, bars.bell, CHROME, seg);
    const rimR = L.s.R - TYRE * 1.55;
    caliper(st, L.hubF, L.s.R, rimR, TYRE, 64, CHROME, seg);
    caliper(frame, L.hubR, L.s.R, rimR, TYRE, 128, CHROME, seg);
    seatpost(frame, L, 0.64, 0.0135, CHROME, seg);
    seatpost(frame, S, 0.64, 0.0135, CHROME, seg);
    saddle(frame, L.saddle, 'wide', LEATHER, seg);
    saddle(frame, S.saddle, 'wide', LEATHER, seg);
    const sb = L.seat(0.625).add(v(0, 0, 0.012)), sbBar = v(0, 0.65, 0.12);
    frame.add(cyl(sb, sbBar, 0.013, 0.012, seg(7, 5)), { color: BLACK, outline: 0.006 });
    frame.add(cyl(sbBar.clone().setX(-0.17), sbBar.clone().setX(0.17), 0.012, 0.012, seg(7, 5)), { color: BLACK, outline: 0.006 });
    for (const s of [-1, 1]) frame.add(cyl(sbBar.clone().setX(s * 0.1), sbBar.clone().setX(s * 0.19), 0.019, 0.019, seg(7, 5), true), { color: LEATHER, outline: 0.006 });
    crankset(b.parts('crank'), L.bb, { crank: L.s.crank, ringR: RING, teeth: 14, rings: [-1], spider: false }, seg);
    pedal(b.parts('pedalR'), pedalRest(L.bb, L, 1), 1, BLACK, seg);
    pedal(b.parts('pedalL'), pedalRest(L.bb, L, -1), -1, BLACK, seg);
    drivetrain(b, L, { crank: L.s.crank, ringR: RING, teeth: 14, cogR: 0.034, cogTeeth: 12, rings: [1, -1], spider: false, pedalColor: BLACK, chainArc: b.seg(10, 5) }, S.bb, { crank: 'crank2', pl: 'pedal2L', pr: 'pedal2R' });
    chain(frame, L.bb, RING, S.bb, RING, -0.056, seg, seg(8, 4));
    const fish = b.group('fish', null, S.saddle);
    saltFish(fish, S.saddle, seg);
    b.marker('stoker', null, S.saddle);
    const sign = S.seat(0.6).add(v(0, -0.005, 0.07));
    frame.add(box(sign.clone().add(v(0, 0, -0.006)), 0.092, 0.092, 0.008, new Euler(0, 0, Math.PI / 4)), { color: '#ffd400', outline: 0.006 });
    decal(frame, 'fishsign', sign, v(0, 0, 1), v(0, 1, 0), 0.13, 0.13);
    reflector(frame, stoC.clone().add(v(0, -0.05, 0.075)).lerp(L.hubR, 0.35), v(0, 0, 1), '#e01b24', 0.035, 0.025);
    riderMarkers(b, L, bars);
  },
};
