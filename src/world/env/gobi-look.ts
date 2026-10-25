// 戈壁公路 GOBI HIGHWAY look (r4, SPEC §20): a hard desert noon — white-hot sun straight overhead,
// dusty ochre fog on the horizon, and sun-bleached warm asphalt.
import type { EnvLook } from '../../core/types';
import type { TunnelStyle } from '../features/tunnel-kit';
import type { RoadLook } from '../looks';

export const LOOK: EnvLook = {
  name: 'Gobi noon',
  // Deep blue zenith, bleached band at the horizon, sand-coloured haze below it.
  sky: { top: '#2f7fd6', horizon: '#dfe7ee', bottom: '#f4e2bd' },
  fog: { color: '#e0c79c', near: 360, far: 1450 },
  // High sun a little behind the rider's left shoulder: short shadows, hard edges.
  sun: { dir: { x: 0.38, y: -0.9, z: -0.22 }, color: '#fff4d8', intensity: 2.6 },
  ambient: { sky: '#cfe0f2', ground: '#e0bd85', intensity: 1.0 },
  grade: { saturation: 1.12, contrast: 1.1, tint: '#fff2dd', bloom: 0.16, night: false },
};

/** Sun-bleached asphalt: warm grey, faint two-tone patches, few manholes out here. */
export const ROAD: RoadLook = {
  base: '#6e6559', tones: [[1.08, 1.05, 0.99], [0.93, 0.92, 0.9]], line: 0.22,
  marks: { every: [80, 140], patch: 3, manhole: 1, arrow: 2, word: 2 },
};

export const TUNNEL: TunnelStyle | null = null;
