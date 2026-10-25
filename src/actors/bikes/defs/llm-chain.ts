// The LLM bike's chain (SPEC §21 #2): instead of running from the chainring to the cog, it runs from
// the chainring up to the rider's neck and closes into a collar around it. It is a separate mesh
// (named 'llm-chain') outside the merged bike geometry: it hangs in the air between frame and rider.
// The bright, chunky run sags in a slack loop beside the frame; the mesh pivots at the chainring, so the
// sway (animate.ts) swings the whole chain from that point.
import { BufferGeometry, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outline, toon } from '../../../render/toon';
import { tube, v, type V3 } from '../build/geo';
import type { Layout } from '../parts/layout';

/** Where the rider's neck sits, in bike space (the pelican on this bike, in the ride pose). */
const NECK = v(0.03, 1.19, -0.16);
/** The collar's radius: it loops around the neck (wide enough to read from the chase camera). */
const RING_R = 0.16;
/** The chain's tube radius (a chunky toy chain). */
const CHAIN_R = 0.022;
/** The chain's side (just inboard of the chainring's plane, clear of the crank arm's sweep). */
const CHAIN_X = 0.05;
/** The chain's colour: the loudest thing on the bike. */
const CHAIN_COLOR = '#ffe600';

/** The pivot the chain swings about: the chainring's top. */
const PIVOT = v(CHAIN_X, 0.115, 0.215);

/** The chain: off the chainring, sagging out beside the frame, up past the rider's shoulder, into the
 *  collar. It passes through the rider on the way (the chain is around the neck now, the drivetrain forgot). */
function runPath(L: Layout): V3[] {
  const bb = L.bb;
  const besideSeat = (y: number): V3 => {
    const p = L.seat(y);
    return v(CHAIN_X, p.y, p.z - 0.026);
  };
  return [
    v(CHAIN_X, bb.y + 0.07, bb.z),
    v(0.12, 0.16, 0.2),
    v(0.24, 0.16, 0.15),
    v(0.3, 0.24, 0.1),      // the slack loop's belly, hanging out beside the frame
    v(0.26, 0.34, 0.06),
    v(0.16, 0.42, 0.06),
    v(0.09, 0.52, 0.07),
    besideSeat(0.62),
    v(0.055, 0.8, 0.07),
    v(0.045, 0.95, 0.03),
    v(0.04, 1.07, -0.03),
    v(0.035, 1.14, -0.1),
  ];
}

/** The collar: a ring around the neck, entered from behind. It is tilted, so the chase camera catches
 *  the back of the loop over the rider's shoulders. */
function ringPath(): V3[] {
  const out: V3[] = [];
  const tilt = 0.42;
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI / 2 + (i / 18) * Math.PI * 2;
    out.push(v(
      NECK.x + Math.cos(a) * RING_R,
      NECK.y + Math.sin(a) * RING_R * Math.sin(tilt),
      NECK.z + Math.sin(a) * RING_R * Math.cos(tilt),
    ));
  }
  return out;
}

/** Every chain built so far (one per live bike): the sway in animate.ts turns them all the same way. */
const chains: Mesh[] = [];

/** The chain mesh (one per bike instance; the geometry is tiny). */
export function llmChain(L: Layout): Mesh {
  const pivot = PIVOT.clone();
  const geo: BufferGeometry = mergeGeometries([
    tube(runPath(L).map((p) => p.clone().sub(pivot)), CHAIN_R, 30, 8),
    tube(ringPath().map((p) => p.clone().sub(pivot)), CHAIN_R, 44, 8, true),
  ]);
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, toon(CHAIN_COLOR));
  mesh.name = 'llm-chain';
  mesh.position.copy(pivot);
  mesh.castShadow = true;
  outline(mesh, 0.005);
  chains.push(mesh);
  // The chain leaves the sway list when its geometry is disposed with the bike.
  geo.addEventListener('dispose', () => {
    const i = chains.indexOf(mesh);
    if (i >= 0) chains.splice(i, 1);
  });
  return mesh;
}

/** Sway the loose chains: the bright run swings about the chainring, the way a chain with no tension on it
 *  would. Called from animate.ts for the llm bike; no allocation per frame. */
export function swayChains(t: number, speed: number): void {
  const amp = 0.05 + Math.min(0.03, speed * 0.003);
  for (const m of chains) {
    m.rotation.set(Math.sin(t * 2.1) * amp, 0, Math.sin(t * 1.4 + 0.8) * amp * 0.7);
  }
}
