// Weather = a modifier on the track's own base look (SPEC §20): 'clear' returns the base look
// untouched, every other weather darkens / cools / pulls the fog in and re-grades it. Colours are
// mixed in sRGB space (the space the looks are written in) and written back as hex.
import type { EnvLook, Weather } from '../../core/types';
import { TUNE } from './table';

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex(c: Rgb): string {
  const f = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(c[0])}${f(c[1])}${f(c[2])}`;
}

/** Blend two colours (t = 0 keeps a). */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Scale a colour toward black (k = 1 keeps it). */
function shade(c: string, k: number): string {
  const x = rgb(c);
  return hex([x[0] * k, x[1] * k, x[2] * k]);
}

/** The colour's own luma as a grey. */
function greyOf(c: string): string {
  const x = rgb(c);
  const l = 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  return hex([l, l, l]);
}

/** The look of one weather on one track. 'clear' is the track's own look, unchanged. */
export function weatherLook(base: EnvLook, weather: Weather): EnvLook {
  if (weather === 'clear') return base;
  if (weather === 'rain') return rainLook(base);
  if (weather === 'dusk') return duskLook(base);
  if (weather === 'fog') return fogLook(base);
  return snowLook(base);
}

/** Rain: greyer and darker, a dimmer and cooler sun, a wet road (weather/wet.ts). */
function rainLook(base: EnvLook): EnvLook {
  const r = TUNE.rain;
  const night = base.grade.night;
  const overcast = night ? '#1b202b' : '#5c6874';
  const horizon = night ? '#2b3140' : '#7d8894';
  return {
    ...base,
    name: `${base.name} · 雨 rain`,
    sky: {
      top: mix(shade(base.sky.top, 1 - r.darken), overcast, r.grey),
      horizon: mix(shade(base.sky.horizon, 1 - r.darken * 0.45), horizon, r.grey),
      bottom: mix(shade(base.sky.bottom, 1 - r.darken * 0.7), horizon, r.grey * 0.8),
    },
    fog: { ...base.fog, color: mix(base.fog.color, overcast, r.grey * 0.85) },
    sun: {
      ...base.sun,
      color: mix(base.sun.color, '#9fb0c4', night ? 0.5 : 0.75),
      intensity: base.sun.intensity * (night ? 0.8 : r.sunMul),
    },
    ambient: {
      sky: mix(base.ambient.sky, night ? '#4a5464' : '#8d99a6', 0.5),
      ground: mix(base.ambient.ground, night ? '#3a3f4a' : '#6a6a66', 0.5),
      intensity: base.ambient.intensity * r.ambientMul,
    },
    grade: {
      saturation: base.grade.saturation * (night ? r.nightSatMul : r.satMul),
      contrast: base.grade.contrast * r.contrastMul,
      tint: mix(base.grade.tint, r.tint, 0.6),
      bloom: Math.max(base.grade.bloom, 0.2),
      night: base.grade.night,
    },
  };
}

/** Dusk: a low warm sun (same azimuth, ~16° up), a warm horizon and long shadows. */
function duskLook(base: EnvLook): EnvLook {
  const d = TUNE.dusk;
  const hx = base.sun.dir.x, hz = base.sun.dir.z;
  const len = Math.hypot(hx, hz) || 1;
  const flat = Math.sqrt(Math.max(0, 1 - d.sunY * d.sunY));
  const dir = { x: (hx / len) * flat, y: d.sunY, z: (hz / len) * flat };
  return {
    ...base,
    name: `${base.name} · 黄昏 dusk`,
    sky: { top: d.skyTop, horizon: d.skyHorizon, bottom: d.skyBottom },
    fog: { ...base.fog, color: d.fog },
    sun: { dir, color: d.sunColor, intensity: d.sunIntensity },
    ambient: { sky: d.ambientSky, ground: d.ambientGround, intensity: d.ambientIntensity },
    grade: {
      saturation: base.grade.saturation * d.satMul,
      contrast: base.grade.contrast * d.contrastMul,
      tint: d.tint,
      bloom: d.bloom,
      night: false,
    },
  };
}

/** Fog: the fog closes in (near and far × 0.35) and turns to a light grey of the sky. */
function fogLook(base: EnvLook): EnvLook {
  const f = TUNE.fog;
  const grey = mix(greyOf(base.sky.horizon), '#e6e9ea', f.grey * 0.65);
  return {
    ...base,
    name: `${base.name} · 雾 fog`,
    sky: {
      top: mix(base.sky.top, grey, f.skyBlend),
      horizon: mix(base.sky.horizon, grey, f.skyBlend * 0.95),
      bottom: mix(base.sky.bottom, grey, f.skyBlend),
    },
    fog: { color: grey, near: base.fog.near * f.pullIn, far: base.fog.far * f.pullIn },
    sun: { ...base.sun, intensity: base.sun.intensity * f.sunMul },
    ambient: { ...base.ambient, intensity: base.ambient.intensity * f.ambientMul },
    grade: {
      saturation: base.grade.saturation * f.satMul,
      contrast: base.grade.contrast * f.contrastMul,
      tint: mix(base.grade.tint, '#dfe6ec', 0.5),
      bloom: Math.max(base.grade.bloom, 0.2),
      night: base.grade.night,
    },
  };
}

/** Snow: a cold overcast sky, a whiter fog and a colder grade. */
function snowLook(base: EnvLook): EnvLook {
  const s = TUNE.snow;
  return {
    ...base,
    name: `${base.name} · 雪 snow`,
    sky: { top: s.skyTop, horizon: s.skyHorizon, bottom: s.skyBottom },
    fog: { color: s.fog, near: base.fog.near * s.fogPullIn, far: base.fog.far * s.fogPullIn },
    sun: { ...base.sun, color: mix(base.sun.color, '#eef4ff', 0.8), intensity: base.sun.intensity * s.sunMul },
    ambient: { sky: '#dce8f4', ground: '#cdd6e0', intensity: base.ambient.intensity * s.ambientMul },
    grade: {
      saturation: base.grade.saturation * s.satMul,
      contrast: base.grade.contrast * s.contrastMul,
      tint: s.tint,
      bloom: s.bloom,
      night: false,
    },
  };
}
