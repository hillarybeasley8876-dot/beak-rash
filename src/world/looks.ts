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

const CITY_LOOK: EnvLook = {
  name: 'Neon Night (placeholder)',
  sky: { top: '#0b0b2a', horizon: '#3b1f5e', bottom: '#120d24' },
  fog: { color: '#2a1a4a', near: 120, far: 720 },
  sun: { dir: { x: 0.3, y: -0.7, z: -0.5 }, color: '#8fa2ff', intensity: 0.7 },
  ambient: { sky: '#5a4aa8', ground: '#2a1530', intensity: 0.9 },
  grade: { saturation: 1.2, contrast: 1.12, tint: '#e8dcff', bloom: 0.8, night: true },
};

const MOUNTAIN_LOOK: EnvLook = {
  name: 'Sunset Pass (placeholder)',
  sky: { top: '#5b4b9e', horizon: '#ffb36b', bottom: '#ffd9a8' },
  fog: { color: '#f2a879', near: 160, far: 860 },
  sun: { dir: { x: 0.25, y: -0.32, z: 0.91 }, color: '#ffbf80', intensity: 2.0 },
  ambient: { sky: '#c99ad8', ground: '#a8665a', intensity: 0.95 },
  grade: { saturation: 1.15, contrast: 1.08, tint: '#ffe6cc', bloom: 0.35, night: false },
};

export function lookFor(id: TrackId): EnvLook {
  return id === 'city' ? CITY_LOOK : id === 'mountain' ? MOUNTAIN_LOOK : COAST_LOOK;
}
