// RaceConfig from menu overrides + URL params, validated against the ids this build knows: a stale or
// mistyped id (?race=nowhere, ?bike=rocket, ?rivals=dragon) falls back to a default with a warning
// instead of breaking the loading screen or the session.
import { BIKES } from '../data/bikes';
import { randomLoadout, rivalLoadout, validLoadout } from '../data/loadouts';
import { RACERS, ROSTER } from '../data/roster';
import { TRACKS, TRACK_WEATHER } from '../data/tracks';
import { Rng } from './rng';
import type { RaceConfig } from './contracts';
import type { SaveStore } from './save';
import type { BikeId, CharacterId, TrackId, Weather } from './types';

const MAX_LEVEL = 10;
const WEATHERS: readonly Weather[] = ['clear', 'rain', 'snow', 'fog', 'dusk'];
/** A rival needs at least this grudge (SaveData.rivalry, 0..100) to come back as the nemesis (SPEC §18). */
const NEMESIS_GRUDGE = 50;

const isTrack = (v: unknown): v is TrackId => typeof v === 'string' && Object.hasOwn(TRACKS, v);
const isBike = (v: unknown): v is BikeId => typeof v === 'string' && Object.hasOwn(BIKES, v);
const isCharacter = (v: unknown): v is CharacterId => typeof v === 'string' && Object.hasOwn(ROSTER, v);
/** r6 (SPEC §23): the player may race as any racer (not the police corgi). */
const isRacer = (v: unknown): v is CharacterId => isCharacter(v) && ROSTER[v].racer;
const isWeather = (v: unknown): v is Weather => typeof v === 'string' && (WEATHERS as readonly string[]).includes(v);

function valid<T>(value: unknown, ok: (v: unknown) => v is T, fallback: T, what: string): T {
  if (ok(value)) return value;
  if (value !== undefined && value !== null) console.warn(`[game] unknown ${what} "${String(value)}", using "${String(fallback)}"`);
  return fallback;
}

function finiteOr(raw: unknown, fallback: number): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Validated track id from ?race= (jump straight into a race), or null when absent. */
export function raceParam(params: URLSearchParams): TrackId | null {
  const raw = params.get('race');
  return raw === null ? null : valid(raw, isTrack, 'coast', 'track');
}

/** The rival in this field holding the biggest grudge ≥ NEMESIS_GRUDGE, or null (?nemesis=<id> forces one in tests). */
function nemesisOf(params: URLSearchParams, save: SaveStore, rivals: readonly CharacterId[]): CharacterId | null {
  const forced = params.get('nemesis');
  if (forced !== null) return isCharacter(forced) && rivals.includes(forced) ? forced : null;
  let best: CharacterId | null = null;
  let grudge = NEMESIS_GRUDGE - 1;
  for (const id of rivals) {
    const g = save.data.rivalry[id] ?? 0;
    if (g > grudge) { grudge = g; best = id; }
  }
  return best;
}

export function buildRaceConfig(params: URLSearchParams, save: SaveStore, o: Partial<RaceConfig> = {}): RaceConfig {
  const seed = Math.floor(Math.abs(finiteOr(o.seed ?? params.get('seed'), Math.floor(Math.random() * 1e9))));
  const rng = new Rng(seed);
  const rivalsParam = params.get('rivals');
  const asked: readonly string[] | null = o.rivals ?? (rivalsParam ? rivalsParam.split(',') : null);
  const known = (asked ?? []).filter((id): id is CharacterId => {
    if (!isCharacter(id)) console.warn(`[game] unknown rival "${id}", skipped`);
    return isCharacter(id);
  });
  // The player's character: the menu's pick, ?character= in tests, else the profile's (SPEC §23).
  const saved = save.data.character;
  const playerCharacter = valid(o.playerCharacter ?? params.get('character') ?? saved, isRacer, isRacer(saved) ? saved : 'pelican', 'player character');
  // An explicit empty list is a solo test race; a list of only unknown ids falls back to a random field drawn
  // from every other racer (the pelican rides as a rival when the player picked someone else).
  const random = asked === null || (asked.length > 0 && known.length === 0);
  const rivals = random ? rng.shuffle(RACERS.filter((c) => c !== playerCharacter)).slice(0, 7) : known;
  const rivalBikes = (o.rivalBikes ?? []).slice(0, rivals.length)
    .map((b, i) => valid(b, isBike, ROSTER[rivals[i]].defaultBike, 'rival bike'));
  const trackId = valid(o.trackId ?? params.get('race') ?? params.get('track') ?? 'coast', isTrack, 'coast', 'track');
  const ownWeather = TRACK_WEATHER[trackId][0] ?? 'clear';
  const nemesis = o.nemesis !== undefined ? o.nemesis : nemesisOf(params, save, rivals);
  // The player's skills (SPEC §24): the menu's loadout, the 盲盒 roll, or the saved kit — always validated.
  const blind = params.get('blindbox') === '1' || (params.get('blindbox') !== '0' && save.data.blindBox);
  const loadout = o.loadout ? validLoadout(o.loadout, playerCharacter)
    : blind ? randomLoadout(playerCharacter, rng.fork(0xb11d))
      : validLoadout(save.data.loadouts[playerCharacter], playerCharacter);
  return {
    trackId,
    mode: o.mode ?? 'quick',
    seed,
    level: Math.min(MAX_LEVEL, Math.max(1, Math.round(finiteOr(o.level ?? params.get('level'), 1)))),
    playerCharacter,
    playerBike: valid(o.playerBike ?? params.get('bike') ?? save.data.bike, isBike, save.data.bike, 'bike'),
    rivals,
    rivalBikes,
    traffic: o.traffic ?? params.get('traffic') !== '0',
    police: o.police ?? params.get('police') !== '0',
    autopilot: o.autopilot ?? params.get('autopilot') === '1',
    weather: valid(o.weather ?? params.get('weather') ?? ownWeather, isWeather, ownWeather, 'weather'),
    reverse: o.reverse ?? params.get('reverse') === '1',
    route: Math.max(0, Math.floor(finiteOr(o.route ?? params.get('route'), 0))),
    nemesis,
    loadout,
    rivalLoadouts: o.rivalLoadouts ?? rivals.map((c) => rivalLoadout(c, c === nemesis)),
  };
}
