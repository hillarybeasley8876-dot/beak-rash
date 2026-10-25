// 江南水乡 WATER TOWN look (r4, SPEC §20): sky, fog, sun, ambient, grading, asphalt and tunnel style.
// Scaffold values (an overcast drizzle palette) — the watertown track job owns this file and tunes it.
import type { EnvLook } from '../../core/types';
import type { TunnelStyle } from '../features/tunnel-kit';
import type { RoadLook } from '../looks';

export const LOOK: EnvLook = {
  name: 'Water Town drizzle',
  sky: { top: '#8fa3b5', horizon: '#d6dfe4', bottom: '#e8eef0' },
  fog: { color: '#c3cfd6', near: 160, far: 700 },
  sun: { dir: { x: 0.3, y: -0.86, z: -0.4 }, color: '#f2f0ea', intensity: 1.5 },
  ambient: { sky: '#d9e3e8', ground: '#9aa58f', intensity: 1.15 },
  grade: { saturation: 0.98, contrast: 1.04, tint: '#f4f7f6', bloom: 0.12, night: false },
};

export const ROAD: RoadLook = {
  base: '#5a5d61', tones: [[1.05, 1.05, 1.06], [0.93, 0.93, 0.95]], line: 0.18,
  marks: { every: [70, 130], patch: 2, manhole: 3, arrow: 2, word: 2 },
};

export const TUNNEL: TunnelStyle | null = null;
