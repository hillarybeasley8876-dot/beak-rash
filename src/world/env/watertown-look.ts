// 江南水乡 WATER TOWN look (r4, SPEC §20): a soft drizzle over a canal town. Overcast sky, cool
// mist, a dim sun high in the cloud, wet stone-grey asphalt.
import type { EnvLook } from '../../core/types';
import type { TunnelStyle } from '../features/tunnel-kit';
import type { RoadLook } from '../looks';

export const LOOK: EnvLook = {
  name: 'Water Town drizzle',
  sky: { top: '#93a4b2', horizon: '#c9d4da', bottom: '#dfe6e8' },
  fog: { color: '#c2cdd4', near: 140, far: 620 },
  // The sun is high but soft: a drizzle sun through the cloud, a touch from the left.
  sun: { dir: { x: 0.34, y: -0.86, z: -0.38 }, color: '#f4f2ec', intensity: 1.25 },
  ambient: { sky: '#dbe4e9', ground: '#9a9a92', intensity: 1.25 },
  grade: { saturation: 0.92, contrast: 1.03, tint: '#f1f5f5', bloom: 0.14, night: false },
};

/** Wet stone-grey asphalt: the town's lanes are paved, not tarmac. */
export const ROAD: RoadLook = {
  base: '#585a5e', tones: [[1.05, 1.05, 1.06], [0.93, 0.94, 0.96]], line: 0.2,
  marks: { every: [70, 130], patch: 3, manhole: 3, arrow: 2, word: 2 },
};

export const TUNNEL: TunnelStyle | null = null;
