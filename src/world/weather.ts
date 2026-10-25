// Weather build (SPEC §20). A weather is a modifier on the track's own look plus its own road grip
// and a little geometry: rain adds puddles and a wet road, snow lays snow on the up-facing surfaces.
// The rain streaks / snow flakes are fx's job and the rain ambience is audio's.
import type { TrackId, Weather } from '../core/types';
import type { WorldCtx } from './ctx';
import { restoreLookSky } from './env/sky';
import { addRainPuddles } from './weather/puddles';import { applySnow } from './weather/snow';
import { ALLOWED, GRIP } from './weather/table';
import { applyWetRoad } from './weather/wet';

export { weatherLook } from './weather/look';
export { ALLOWED, GRIP } from './weather/table';

/** Weathers already warned about, so a track that rains twice does not spam the console. */
const warned = new Set<string>();

/** The weather a track is built with: the asked one, or 'clear' when the track does not allow it. */
export function resolveWeather(id: TrackId, asked?: Weather): Weather {
  if (!asked || asked === 'clear') return 'clear';
  if (ALLOWED[id].includes(asked)) return asked;
  const key = `${id}:${asked}`;
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[weather] ${id} has no "${asked}" weather (SPEC §20) — building clear instead`);
  }
  return 'clear';
}

/** The road grip of one weather (rain 0.85, snow 0.75, the rest 1). */
export function gripFor(weather: Weather): number {
  return GRIP[weather];
}

/** The rain puddles of a track: seeded patches of standing water on the drivable road. */
export function addPuddles(ctx: WorldCtx, weather: Weather): void {
  if (weather !== 'rain') return;
  addRainPuddles(ctx.L, ctx.id);
}

/** The weather's own materials: a wet road (rain) or snow on the up-facing surfaces (snow). */
export function applyWeatherMaterials(ctx: WorldCtx, weather: Weather): void {
  if (weather === 'clear') return;
  // A track may swap the sky for a scene of its own (the mountain's golden hour); a weather build
  // wants the plain look-driven sky, so the look's dome and cloud tint go back.
  restoreLookSky(ctx);
  if (weather === 'rain') applyWetRoad(ctx);
  else if (weather === 'snow') applySnow(ctx);
}
