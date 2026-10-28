// RaceConfig from menu overrides + URL params, validated against the ids this build knows: a stale or
// mistyped id (?race=nowhere, ?bike=rocket, ?rivals=dragon) falls back to a default with a warning
// instead of breaking the loading screen or the session.
import { BIKES } from '../data/bikes';
import { randomLoadout, rivalLoadout, validLoadout } from '../data/loadouts';
import { RACERS, ROSTER } from '../data/roster';
import { TRACKS, TRACK_WEATHER } from '../data/tracks';
import { Rng } from './rng';
import type { OnlineHuman, OnlineRace, RaceConfig } from './contracts';
import { MAX_HUMANS } from '../net/protocol';
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

/** The grid of an online race: eight riders, the humans first. */
const ONLINE_GRID = 8;

/**
 * An online race's config (SPEC §28) is the host's, identical on every client: built only from it — never from this
 * client's URL or save (a ?traffic=0 or a grudge here would split the race). Humans and AI are validated like a
 * local race's; the rest falls back to fixed defaults.
 */
export function onlineRaceConfig(o: Partial<RaceConfig> & { online: OnlineRace }): RaceConfig {
  const humans: OnlineHuman[] = o.online.humans.slice(0, MAX_HUMANS).map((h, slot) => {
    const character = valid(h.character, isRacer, 'pelican', 'online character');
    return {
      slot, member: h.member, name: String(h.name ?? '').slice(0, 12) || '骑手', character,
      bike: valid(h.bike, isBike, ROSTER[character].defaultBike, 'online bike'), loadout: validLoadout(h.loadout, character),
    };
  });
  if (humans.length === 0) throw new Error('online race without humans');
  const local = Math.min(Math.max(0, Math.floor(finiteOr(o.online.local, 0))), humans.length - 1);
  const me = humans[local] as OnlineHuman;
  const seed = Math.floor(Math.abs(finiteOr(o.seed, 1)));
  const rng = new Rng(seed);
  const taken = new Set(humans.map((h) => h.character));
  const asked = (o.rivals ?? []).filter((id): id is CharacterId => isRacer(id));
  const rivals = (asked.length ? asked : rng.shuffle(RACERS.filter((c) => !taken.has(c)))).slice(0, ONLINE_GRID - humans.length);
  const trackId = valid(o.trackId, isTrack, 'coast', 'track');
  const ownWeather = TRACK_WEATHER[trackId][0] ?? 'clear';
  return {
    trackId,
    mode: 'quick',
    seed,
    level: Math.min(MAX_LEVEL, Math.max(1, Math.round(finiteOr(o.level, 2)))),
    playerCharacter: me.character,
    playerBike: me.bike,
    rivals,
    rivalBikes: rivals.map((c, i) => valid(o.rivalBikes?.[i], isBike, ROSTER[c].defaultBike, 'rival bike')),
    traffic: o.traffic ?? true,
    police: false,
    autopilot: false,
    weather: valid(o.weather ?? ownWeather, isWeather, ownWeather, 'weather'),
    reverse: o.reverse ?? false,
    route: Math.max(0, Math.floor(finiteOr(o.route, 0))),
    nemesis: null,
    loadout: me.loadout,
    rivalLoadouts: rivals.map((c, i) => (o.rivalLoadouts?.[i] ? validLoadout(o.rivalLoadouts[i], c) : rivalLoadout(c, false))),
    online: { room: String(o.online.room ?? ''), humans, local },
  };
}

export function buildRaceConfig(params: URLSearchParams, save: SaveStore, o: Partial<RaceConfig> = {}): RaceConfig {
  if (o.online) return onlineRaceConfig({ ...o, online: o.online });
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
