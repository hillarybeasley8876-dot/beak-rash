// The LLM bike's chain (SPEC §21 #2): instead of running from the chainring to the cog, it runs from
// the chainring up to the rider's neck and closes into a collar around it. It is a separate mesh
// (named 'llm-chain') outside the merged bike geometry: it hangs in the air between frame and rider.
import { BufferGeometry, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outline, toon } from '../../../render/toon';
import { tube, v, type V3 } from '../build/geo';
import type { Layout } from '../parts/layout';

/** Where the rider's neck sits, in bike space (the pelican on this bike, in the ride pose). */
const NECK = v(0.03, 1.19, -0.16);
/** The collar's radius: it loops around the neck (wide enough to read from the chase camera). */
const RING_R = 0.13;
/** The chain's tube radius (a chunky toy chain). */
const CHAIN_R = 0.009;
/** The chain's side (just inboard of the chainring's plane, clear of the crank arm's sweep). */
const CHAIN_X = 0.05;

/** The chain: off the chainring, up beside the seat tube, through the rider's shoulder, into the collar.
 *  It passes through the rider on the way (the chain is around the neck now, the drivetrain forgot). */
function runPath(L: Layout): V3[] {
  const bb = L.bb;
  const besideSeat = (y: number): V3 => {
    const p = L.seat(y);
    return v(CHAIN_X, p.y, p.z - 0.026);
  };
  return [
    v(CHAIN_X, bb.y + 0.075, bb.z),
    besideSeat(0.42),
    besideSeat(0.58),
    v(0.05, 0.72, 0.11),
    v(0.05, 0.88, 0.06),
    v(0.04, 1.03, 0.0),
    v(0.035, 1.13, -0.1),
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

/** The chain mesh (one per bike instance; the geometry is tiny). */
export function llmChain(L: Layout): Mesh {
  const geo: BufferGeometry = mergeGeometries([
    tube(runPath(L), CHAIN_R, 30, 8),
    tube(ringPath(), CHAIN_R, 44, 8, true),
  ]);
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, toon('#1b1b1f'));
  mesh.name = 'llm-chain';
  mesh.castShadow = true;
  outline(mesh, 0.004);
  return mesh;
}
