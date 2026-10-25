// 大模型限定款 (SPEC §21 #2, the Konami unlock): a roadbike as a language model drew it — the front wheel is
// bigger than the rear, the rims are two different neon colours, the handlebar is mounted backwards and far
// too wide, the chain runs from the chainring to the rider's neck, two pedals drift loose beside the frame,
// a third wheel spins on the top tube and the frame has a tube too many. It still rides: the rider's hands,
// feet and seat sit exactly where the standard rig puts them.
import { Euler, Vector3 } from 'three';
import { Rng } from '../../../core/rng';
import { bar, cyl, v } from '../build/geo';
import { bell, stem } from '../parts/cockpit';
import { drivetrain, riderMarkers } from '../parts/diamond';
import { fork, frameTube, saddle } from '../parts/frame';
import { layout, pedalRest, type Layout } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeBuilder, BikeDef } from '../template';
import { llmBar } from './llm/bar';
import { wrongFrame } from './llm/frame';
import { loosePedal } from './llm/pedals';
import { thirdWheel } from './llm/wheel3';
import { llmChain } from './llm-chain';

const BLACK = '#1f2024', SILVER = '#c3c8d0';

/** The LLM edition's tuning: the wrong sizes and the loud colours, in one table. */
const TUNE = {
  frontScale: 1.3,        // the drawn front wheel against the rear (the physics radius stays the rear's)
  spokes: 7,              // seven spokes, pointing wherever they please
  spokeWidth: 0.052,      // the spokes are planks, not wires
  spokePoke: 0.03,        // every third spoke shoots this far past the rim
  barHalfW: 0.65,         // the backwards bar's half width (the roadbike's drop bar is 0.16)
  barGripW: 0.36,         // where the paws hold it: the sleeves still stick out past them
  frameR: { top: 0.034, down: 0.042, seat: 0.033, cs: 0.019, ss: 0.017, head: 0.042 },
  wheel3: { r: 0.24, at: v(0.32, 0.575, 0.04) },   // the third wheel on the top tube, out to the side
  orbitL: v(-0.4, 0.44, 0.12),   // the loose pedals' own little orbits, one each side
  orbitR: v(0.4, 0.44, 0.12),
  orbitOffset: v(0.085, 0, 0.055),   // where the pedal sits on its orbit
  color: {
    frame: '#ff2fb0', accent: '#ffe600', stays: '#25f4a0', chainstay: '#1f2024',
    rimR: '#ff7a18', rimF: '#22d8ff', tyreR: '#25f4a0', tyreF: '#ffe600',
    spoke: '#fffbe8', bar: '#ff7a18', grip: '#22d8ff', pedal: '#ffe600',
    wheel3Tyre: '#22d8ff', wheel3Rim: '#ff7a18',
  },
};

const L = layout({
  R: 0.27, wb: 0.84, bb: [0.215, 0.045], seatAngle: 74, saddleY: 0.67,
  headAngle: 72, head: [0.565, 0.655], forkOffset: 0.04, crank: 0.12, pedalX: 0.105,
});

/** The drawn front wheel: 1.3× the rear, so its hub sits higher (its tyre still reaches the ground).
 *  Only the drawing changes: the physics still runs on `wheelRadius` and the roadbike's wheelbase. */
const FRONT_R = L.s.R * TUNE.frontScale;
const HUB_F = v(0, FRONT_R, L.hubF.z);
/** The same layout with the front hub raised: the fork reaches the big wheel. */
const L_FRONT: Layout = { ...L, hubF: HUB_F };

/** The standard rig with the front wheel's pivot on the big wheel's hub, plus the LLM's own moving parts:
 *  the third wheel (it spins in place) and the two loose pedals (they drift around their own pivots). */
function llmRig(b: BikeBuilder, L: Layout, hubF: Vector3): void {
  const tilt = new Euler(L.rake, 0, 0);
  b.group('wheelR', null, L.hubR);
  b.group('headset', null, L.headMid, tilt);
  b.group('steer', 'headset', L.headMid, tilt);
  b.group('wheelF', 'steer', hubF, tilt);
  b.group('crank', null, L.bb);
  b.group('pedalR', 'crank', pedalRest(L.bb, L, 1));
  b.group('pedalL', 'crank', pedalRest(L.bb, L, -1));
  b.group('crank2', null, TUNE.wheel3.at.clone());
  b.group('pedal2L', null, TUNE.orbitL.clone());
  b.group('pedal2R', null, TUNE.orbitR.clone());
}

/** Seven spokes pointing wherever they please (seeded, so the bike looks the same every time). Thick and
 *  bright, and every third one shoots out past the rim: the wheels do not match each other either. */
function wildSpokes(b: BikeBuilder, side: 'R' | 'F', hub: Vector3, rIn: number, rOut: number, color: string): void {
  const ps = b.parts(side === 'R' ? 'spokesR' : 'spokesF');
  const rng = new Rng(side === 'R' ? 0x11d5 : 0x11dc);
  for (let i = 0; i < TUNE.spokes; i++) {
    const a = rng.next() * Math.PI * 2;
    const dir = v(0, Math.sin(a), Math.cos(a));
    const lean = (rng.next() - 0.5) * 0.05;
    const from = hub.clone().addScaledVector(dir, 0.02).setX(hub.x + lean * 0.4);
    // Every third spoke is too long: it pokes out past the rim (and past the tyre).
    const to = hub.clone().addScaledVector(dir, i % 3 === 0 ? rOut + TUNE.spokePoke : rIn).setX(hub.x + lean);
    ps.add(bar(from, to, TUNE.spokeWidth, 0.024), { color, outline: 0.006 });
  }
  b.period(side === 'R' ? 'spokesR' : 'spokesF', (Math.PI * 2) / TUNE.spokes);
}

export const llm: BikeDef = {
  id: 'llm',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 5 },
  build(b) {
    llmRig(b, L, HUB_F);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const C = TUNE.color;
    const main = { color: C.frame, paint: 1 };
    // The frame: a tube too many and a down tube that stops short of the bottom bracket.
    wrongFrame(frame, L, {
      main, accent: { color: C.accent }, stays: { color: C.stays }, chainstays: { color: C.chainstay },
    }, TUNE.frameR, 0.615, 0.545, L.headBot.y + 0.02, seg);
    // The wheels do not match: the front is a third bigger, and the two rims are two loud colours.
    const wR: WheelSpec = {
      R: L.s.R, tyre: 0.055, tyreColor: C.tyreR, rim: 'deep', rimDepth: 0.042, rimColor: C.rimR, spokes: false, spokeColor: C.rimR,
    };
    wheel(b, 'R', L.hubR, { ...wR, cog: { r: 0.034, teeth: 12, x: 0.056 } });
    const wF: WheelSpec = {
      R: FRONT_R, tyre: 0.06, tyreColor: C.tyreF, rim: 'deep', rimDepth: 0.055, rimColor: C.rimF, spokes: false, spokeColor: C.rimF,
    };
    wheel(b, 'F', HUB_F, wF);
    wildSpokes(b, 'R', L.hubR, wR.R - wR.tyre * 1.55 - 0.042, wR.R - wR.tyre * 1.55, C.spoke);
    wildSpokes(b, 'F', HUB_F, wF.R - wF.tyre * 1.55 - 0.055, wF.R - wF.tyre * 1.55, C.spoke);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.03);
    fork(st, L_FRONT, { halfW: 0.05, r: 0.017, look: { color: C.stays }, kind: 'rigid', crown: main }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.01, -0.06));
    stem(st, steererTop, clamp, BLACK, seg);
    // The bar: mounted backwards (the ends hook towards the rider) and much too wide.
    const bars = llmBar(st, clamp, TUNE.barHalfW, TUNE.barGripW, C.bar, C.grip, seg);
    bell(st, bars.bell, SILVER, seg);
    // The saddle left the seat tube and sits on the handlebar's stem; the rider still sits where the pose wants.
    saddle(st, steererTop.clone().add(v(0, 0.02, 0)), 'road', BLACK, seg);
    frameTube(frame, L.seat(0.6), L.seat(L.saddle.y - 0.012), 0.016, { color: BLACK }, seg);
    // No chain on the frame: it is around the rider's neck instead (the 'llm-chain' mesh).
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.075, teeth: 18, cogR: 0, cogTeeth: 12 });
    // The third wheel: bolted to the top tube on a stub, out to the side where no wheel belongs.
    const topMid = L.seat(0.615).lerp(L.onAxis(0.545), 0.5);
    frame.add(cyl(topMid, TUNE.wheel3.at, 0.014, 0.014, seg(10, 6)), { color: C.accent, outline: 0.01 });
    if (!b.far) thirdWheel(b.parts('crank2'), TUNE.wheel3.at, TUNE.wheel3.r, C.wheel3Tyre, C.wheel3Rim, C.spoke, seg);
    // The pedals that got loose: they drift around beside the frame, one on each side.
    if (!b.far) {
      loosePedal(b.parts('pedal2L'), TUNE.orbitL.clone().add(TUNE.orbitOffset), C.pedal, seg);
      loosePedal(b.parts('pedal2R'), TUNE.orbitR.clone().add(v(-TUNE.orbitOffset.x, 0, TUNE.orbitOffset.z)), C.pedal, seg);
    }
    riderMarkers(b, L, bars);
  },
  extras() { return [llmChain(L)]; },
};
