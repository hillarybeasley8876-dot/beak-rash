// Where a paw holds each bike's bars. The grip markers sit mid-grip and the bars (bikes unit,
// parts/cockpit.ts) end 5–6 cm further out along the grip, so the hand target slides toward the bar end
// until the chunky mitten swallows the end cap (no bar end poking through the paw).
import { Vector3 } from 'three';
import type { BikeId } from '../../core/types';

/** Right-hand offset from the grip marker in steer space [out (+X), up, back (+Z)], metres; mirrored for the left. */
const FIT: Record<BikeId, readonly [number, number, number]> = {
  roadbike: [0, 0, 0],          // drop bar: paws on the hoods, no bar end near the hand
  fixie: [0, 0.006, -0.012],    // bullhorn: grip runs forward-up, its end 4 cm ahead of the marker
  mtb: [0.032, 0, 0],           // flat / riser bars: end 5.7 cm out along the grip
  kidbike: [0.032, 0, 0],
  tandem: [0.032, 0, 0],
  erba: [0.016, 0, 0.026],      // swept city bars: end 5.5 cm out-and-back along the grip
  shared: [0.016, 0, 0.026],
};

/** Grip point for one hand in the marker's parent (steer) space. */
export function gripPoint(bike: BikeId, side: -1 | 1, marker: Vector3, out: Vector3): Vector3 {
  const f = FIT[bike];
  return out.set(marker.x + side * f[0], marker.y + f[1], marker.z + f[2]);
}
