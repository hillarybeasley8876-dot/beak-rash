// 戈壁公路 GOBI HIGHWAY look (r4, SPEC §20): sky, fog, sun, ambient, grading, asphalt and tunnel style.
// Scaffold values (a hard desert noon) — the gobi track job owns this file and tunes it.
import type { EnvLook } from '../../core/types';
import type { TunnelStyle } from '../features/tunnel-kit';
import type { RoadLook } from '../looks';

export const LOOK: EnvLook = {
  name: 'Gobi noon',
  sky: { top: '#2a74d6', horizon: '#cfe3f2', bottom: '#f3e6cf' },
  fog: { color: '#e8d3ad', near: 400, far: 1500 },
  sun: { dir: { x: 0.35, y: -0.9, z: -0.26 }, color: '#fff1d6', intensity: 2.5 },
  ambient: { sky: '#d8e6f5', ground: '#e2c08a', intensity: 1.0 },
  grade: { saturation: 1.1, contrast: 1.08, tint: '#fff4e2', bloom: 0.14, night: false },
};

export const ROAD: RoadLook = {
  base: '#635f5c', tones: [[1.08, 1.06, 1.02], [0.91, 0.91, 0.93]], line: 0.2,
  marks: { every: [90, 150], patch: 3, manhole: 0, arrow: 2, word: 2 },
};

export const TUNNEL: TunnelStyle | null = null;
