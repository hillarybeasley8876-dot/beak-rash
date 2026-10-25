// 大模型限定款 (SPEC §21 #2, the Konami unlock): a roadbike as a language model drew it — the chain
// runs from the chainring to the rider's neck, the saddle sits on the handlebar, one pedal floats
// loose beside the frame and each wheel has seven spokes pointing wherever they please. It still
// rides: the geometry is the roadbike's, so every rider's hands and feet land where they always did.
import { Euler, Vector3 } from 'three';
import { Rng } from '../../../core/rng';
import { bar, box, cyl, ellip, v } from '../build/geo';
import type { PartSet } from '../build/partset';
import { bell, dropBar, stem } from '../parts/cockpit';
import { diamond, drivetrain, riderMarkers } from '../parts/diamond';
import { frameTube, fork, saddle } from '../parts/frame';
import { layout, standardRig } from '../parts/layout';
import { wheel, type WheelSpec } from '../parts/wheel';
import type { BikeBuilder, BikeDef } from '../template';
import { llmChain } from './llm-chain';

const BONE = '#f0ece2', TEAL = '#2fbfa0', BLACK = '#1f2024', SILVER = '#c3c8d0';
const TYRE = 0.022, TYRE_R = 0.025;
const SPOKES = 7;

const L = layout({
  R: 0.27, wb: 0.84, bb: [0.215, 0.045], seatAngle: 74, saddleY: 0.67,
  headAngle: 72, head: [0.565, 0.655], forkOffset: 0.04, crank: 0.12, pedalX: 0.105,
});

/** Seven spokes pointing wherever they please (seeded, so the bike looks the same every time). */
function wildSpokes(b: BikeBuilder, side: 'R' | 'F', hub: Vector3, rIn: number): void {
  const ps = b.parts(side === 'R' ? 'spokesR' : 'spokesF');
  const rng = new Rng(side === 'R' ? 0x11d5 : 0x11dc);
  for (let i = 0; i < SPOKES; i++) {
    const a = rng.next() * Math.PI * 2;
    const dir = v(0, Math.sin(a), Math.cos(a));
    const lean = (rng.next() - 0.5) * 0.05;
    const from = hub.clone().addScaledVector(dir, 0.022).setX(hub.x + lean * 0.4);
    const to = hub.clone().addScaledVector(dir, rIn).setX(hub.x + lean);
    ps.add(bar(from, to, 0.008, 0.014), { color: '#cfd3da', outline: 0.004 });
  }
  b.period(side === 'R' ? 'spokesR' : 'spokesF', (Math.PI * 2) / SPOKES);
}

/** A pedal that got loose: it floats beside the frame, where no crank is. */
function loosePedal(ps: PartSet, at: Vector3): void {
  ps.add(ellip(at, 0.04, 0.0125, 0.034, 12, 8, new Euler(0.2, 0.4, 0.35)), { color: BLACK, outline: 0.01 });
  ps.detail.add(cyl(at.clone().add(v(-0.035, 0.006, 0.012)), at.clone().add(v(-0.004, 0.002, 0.004)), 0.0065, 0.0065, 6), { color: '#9aa0a8' });
  ps.detail.add(box(at.clone().add(v(0, 0.013, 0.02)), 0.046, 0.011, 0.007), { color: '#ff9a1f', outline: 0.003 });
}

export const llm: BikeDef = {
  id: 'llm',
  wheelRadius: L.s.R,
  wheelbase: L.s.wb,
  drive: { kind: 'free', gear: 5 },
  build(b) {
    standardRig(b, L);
    const seg = b.seg, frame = b.parts(null), st = b.parts('steer');
    const main = { color: BONE, paint: 1 };
    // A slightly wrong triangle: the top tube dives to the head tube instead of climbing to it.
    diamond(b, L, {
      main, stays: { color: TEAL }, chainstays: { color: BLACK },
      r: { top: 0.026, down: 0.032, seat: 0.025, cs: 0.015, ss: 0.013, head: 0.032 },
      clusterY: 0.615, topY: 0.545,
    });
    const w: WheelSpec = { R: L.s.R, tyre: TYRE, rim: 'deep', rimDepth: 0.042, rimColor: BONE, spokes: false };
    wheel(b, 'R', L.hubR, { ...w, tyre: TYRE_R, cog: { r: 0.034, teeth: 12, x: 0.056 } });
    wheel(b, 'F', L.hubF, w);
    wildSpokes(b, 'R', L.hubR, L.s.R - TYRE_R * 1.55 - 0.042);
    wildSpokes(b, 'F', L.hubF, L.s.R - TYRE * 1.55 - 0.042);
    const steererTop = L.headTop.clone().addScaledVector(L.axis, 0.03);
    fork(st, L, { halfW: 0.05, r: 0.017, look: { color: TEAL }, kind: 'rigid', crown: main }, steererTop, seg);
    const clamp = steererTop.clone().add(v(0, 0.01, -0.06));
    stem(st, steererTop, clamp, BLACK, seg);
    const bars = dropBar(st, clamp, 0.16, BLACK, seg);
    bell(st, bars.bell, SILVER, seg);
    // The saddle left the seat tube and sits on the handlebar's stem; the rider still sits where the pose wants.
    saddle(st, steererTop.clone().add(v(0, 0.02, 0)), 'road', BLACK, seg);
    frameTube(frame, L.seat(0.6), L.seat(L.saddle.y - 0.012), 0.016, { color: BLACK }, seg);
    // No chain on the frame: it is around the rider's neck instead (the 'llm-chain' mesh).
    drivetrain(b, L, { crank: L.s.crank, ringR: 0.075, teeth: 18, cogR: 0, cogTeeth: 12 });
    loosePedal(frame, v(0.27, 0.42, 0.12));
    riderMarkers(b, L, bars);
  },
  extras() { return [llmChain(L)]; },
};
