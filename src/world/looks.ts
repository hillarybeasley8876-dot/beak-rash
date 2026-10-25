// Environment looks per track (sky, fog, sun, ambient, grading hints for fx).
import type { EnvLook, TrackId } from '../core/types';

const COAST_LOOK: EnvLook = {
  name: 'Pelican Bay noon',
  sky: { top: '#2f86e6', horizon: '#bfe7ff', bottom: '#e6f5ff' },
  // Bluer than the horizon band so distant hills read as crisp blue silhouettes, not milky ghosts.
  fog: { color: '#a9d4f5', near: 300, far: 1000 },
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

// Golden hour (env-mountain): the sun sits ~14° up, 25-35° off the cliff, summit and descent headings
// (the ridges dip into a saddle under it). Mauve fog so fogged hills read as the first of the layered
// purple ridges (env/mountain-ridges.ts). Near-neutral tint: the sky and sun carry the warmth, a cool
// violet ambient ground keeps shadows contrasting with the warm light. The key is a pale gold (not
// orange) and the ambient sky a grey lavender, so sunlit whites (the pelican's back) read cream, not salmon.
const MOUNTAIN_LOOK: EnvLook = {
  name: 'Sunset Pass golden hour',
  sky: { top: '#3d2f7a', horizon: '#ffc27a', bottom: '#d98a7e' },
  fog: { color: '#c48aa6', near: 170, far: 900 },
  sun: { dir: { x: -0.1685, y: -0.2419, z: -0.9555 }, color: '#ffe0b4', intensity: 2.3 },
  ambient: { sky: '#aaaadc', ground: '#6a5a9a', intensity: 1.0 },
  grade: { saturation: 1.08, contrast: 1.06, tint: '#fff5ec', bloom: 0.25, night: false },
};

export function lookFor(id: TrackId): EnvLook {
  return id === 'city' ? CITY_LOOK : id === 'mountain' ? MOUNTAIN_LOOK : COAST_LOOK;
}

type Rgb = readonly [number, number, number];

/**
 * Asphalt per track (road/): `base` paints the asphalt texture; `tones` are the light / dark multipliers of
 * the low-frequency two-tone tint (about ±7 %); `line` darkens the worn racing line; `marks` places one
 * road mark every `every` m, picked by weight (tar patches, manholes, lane / bend arrows, meme words).
 */
export interface RoadLook {
  base: string;
  tones: readonly [Rgb, Rgb];
  line: number;
  marks: { every: readonly [number, number]; patch: number; manhole: number; arrow: number; word: number };
}

const ROAD_LOOKS: Record<TrackId, RoadLook> = {
  // Warm sun-bleached grey: light patches a touch warmer, dark ones a touch cooler.
  coast: {
    base: '#5f5e61', tones: [[1.07, 1.06, 1.03], [0.92, 0.92, 0.94]], line: 0.24,
    marks: { every: [70, 130], patch: 3, manhole: 2, arrow: 2, word: 2 },
  },
  // Wet night asphalt (the city's wet overlay sits on top): base unchanged, a quieter tint, mostly manholes.
  city: {
    base: '#5b5f68', tones: [[1.04, 1.04, 1.05], [0.95, 0.95, 0.96]], line: 0.12,
    marks: { every: [70, 130], patch: 1, manhole: 4, arrow: 2, word: 2 },
  },
  // Cool violet-grey pass road, patched more often than repainted.
  mountain: {
    base: '#5f5c6a', tones: [[1.07, 1.06, 1.08], [0.92, 0.92, 0.94]], line: 0.24,
    marks: { every: [70, 130], patch: 4, manhole: 1, arrow: 3, word: 2 },
  },
};

export function roadLookFor(id: TrackId): RoadLook {
  return ROAD_LOOKS[id];
}
