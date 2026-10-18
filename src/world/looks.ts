// Environment looks per track (sky, fog, sun, ambient, grading hints for fx).
// city / mountain are wave-2 placeholders that already set their own mood on the coast layout.
import type { EnvLook, TrackId } from '../core/types';

const COAST_LOOK: EnvLook = {
  name: 'Pelican Bay noon',
  sky: { top: '#2f86e6', horizon: '#bfe7ff', bottom: '#e6f5ff' },
  fog: { color: '#c6e6fb', near: 200, far: 980 },
  // Sun high behind-left of the start heading: riders seen from the chase cam are front-lit from the side.
  sun: { dir: { x: 0.42, y: -0.82, z: -0.39 }, color: '#fff3dc', intensity: 2.3 },
  ambient: { sky: '#d4ecff', ground: '#e9d8ab', intensity: 1.05 },
  grade: { saturation: 1.12, contrast: 1.06, tint: '#fff8ec', bloom: 0.15, night: false },
};

// Night city (env-city): a moon ~28° above the west-south-west (ahead on the final sprint), navy sky
// with a purple city glow at the horizon, dark violet fog so far towers read as silhouettes.
const CITY_LOOK: EnvLook = {
  name: 'Neon Night',
  sky: { top: '#05071c', horizon: '#4a1d63', bottom: '#120a26' },
  fog: { color: '#24163f', near: 50, far: 640 },
  sun: { dir: { x: 0.856, y: -0.469, z: -0.212 }, color: '#a9bcff', intensity: 0.85 },
  ambient: { sky: '#6e5fd0', ground: '#3a1d4a', intensity: 1.0 },
  grade: { saturation: 1.15, contrast: 1.1, tint: '#eee6ff', bloom: 0.9, night: true },
};

// Golden hour (env-mountain): the sun sits ~10° above the west-south-west horizon, over the lake.
// Mauve fog so fogged hills read as the first of the layered purple ridges (env/mountain-ridges.ts).
const MOUNTAIN_LOOK: EnvLook = {
  name: 'Sunset Pass golden hour',
  sky: { top: '#3d2f7a', horizon: '#ffc27a', bottom: '#d98a7e' },
  fog: { color: '#c48aa6', near: 170, far: 900 },
  sun: { dir: { x: 0.92, y: -0.17, z: -0.35 }, color: '#ffb46e', intensity: 2.3 },
  ambient: { sky: '#b48ad8', ground: '#8a5462', intensity: 1.0 },
  grade: { saturation: 1.18, contrast: 1.08, tint: '#ffe0c2', bloom: 0.25, night: false },
};

export function lookFor(id: TrackId): EnvLook {
  return id === 'city' ? CITY_LOOK : id === 'mountain' ? MOUNTAIN_LOOK : COAST_LOOK;
}
