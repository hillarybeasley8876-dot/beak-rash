// 江南水乡 WATER TOWN look (r4, SPEC §20): a misty morning over a canal town. Cool green-greys,
// a soft sun high in the haze, wet stone lanes. The rain build (weather/look.ts) turns it into the
// town's soft drizzle: a little greyer, a little dimmer, never a storm.
import type { EnvLook } from '../../core/types';
import type { TunnelStyle } from '../features/tunnel-kit';
import type { RoadLook } from '../looks';

export const LOOK: EnvLook = {
  name: 'Water Town mist',
  sky: { top: '#8ea4ad', horizon: '#ccd8d3', bottom: '#dde4de' },
  fog: { color: '#c2cfc9', near: 150, far: 640 },
  // The sun is high but soft: a sun through the haze, a touch from the left.
  sun: { dir: { x: 0.34, y: -0.86, z: -0.38 }, color: '#f3f4ec', intensity: 1.4 },
  ambient: { sky: '#d4e1de', ground: '#8b8d7e', intensity: 1.3 },
  grade: { saturation: 0.9, contrast: 1.02, tint: '#eef4f0', bloom: 0.16, night: false },
};

/** The town's lanes are paved in flagstone, not tarmac. */
export const ROAD: RoadLook = {
  base: '#7d8792', tones: [[1.05, 1.05, 1.06], [0.93, 0.94, 0.96]], line: 0,
  marks: { every: [70, 130], patch: 0, manhole: 0, arrow: 0, word: 0 },
};

export const TUNNEL: TunnelStyle | null = null;
