// SPEC §20 weather table: which weather each track allows, the road grip per weather and the tuning
// numbers the weather build uses (fog pull-in, rain look and puddles, snow cover, dusk sun).
import type { TrackId, Weather } from '../../core/types';

/** Weather each track allows (SPEC §20). Anything else falls back to 'clear'. */
export const ALLOWED: Record<TrackId, readonly Weather[]> = {
  coast: ['clear', 'rain', 'dusk', 'fog'],
  city: ['clear', 'rain', 'fog'],
  mountain: ['clear', 'snow', 'fog', 'rain'],
  watertown: ['clear', 'rain', 'fog'],
  gobi: ['clear', 'dusk', 'fog'],
};

/** Road grip per weather (SPEC §20): rain 0.85, snow 0.75, the rest 1. */
export const GRIP: Record<Weather, number> = { clear: 1, rain: 0.85, snow: 0.75, fog: 1, dusk: 1 };

/** Tuning of the weather look and the weather geometry. */
export const TUNE = {
  /** Fog: near / far pull-in, how far the fog colour goes to the sky's grey and the sky's own fade. */
  fog: { pullIn: 0.35, grey: 0.85, skyBlend: 0.85, satMul: 0.85, contrastMul: 0.95, sunMul: 0.6, ambientMul: 1.12 },
  /** Rain: greyer and darker grade, the cool overcast colours, the wet road. */
  rain: {
    satMul: 0.68, nightSatMul: 0.86, contrastMul: 0.92, darken: 0.26, grey: 0.65,
    sunMul: 0.55, ambientMul: 0.9, tint: '#c9d6e4', wetDark: 0.6, sheen: 0.85, spec: 0.45,
  },
  /** Rain puddles: how many a rainy track gets, and where they may sit. */
  puddle: { min: 3, extra: 1, keepClear: 120, lenMin: 5, lenMax: 9, wideMin: 1.4, wideMax: 3.2, margin: 1.2, block: 14 },
  /** Snow: the cover on up-facing surfaces and the colours around it. */
  snow: {
    amount: 1, slopeLo: 0.1, slopeHi: 0.5, color: '#f0f5fb',
    skyTop: '#ccd8e6', skyHorizon: '#eef3f9', skyBottom: '#dde6ef', fog: '#e8eef5', tint: '#dbe7f7',
    sunMul: 0.7, ambientMul: 1.15, fogPullIn: 0.8, satMul: 0.8, contrastMul: 0.98, bloom: 0.35,
  },
  /** Dusk: the low warm sun and the evening sky. */
  dusk: {
    sunY: -0.28, sunColor: '#ff9640', sunIntensity: 1.9,
    skyTop: '#2c3f74', skyHorizon: '#ff9a55', skyBottom: '#8a4a63',
    ambientSky: '#7a6a95', ambientGround: '#8a4f3a', ambientIntensity: 0.8,
    fog: '#b5775f', satMul: 1.02, contrastMul: 1.04, tint: '#ffe3c4', bloom: 0.4,
  },
} as const;
