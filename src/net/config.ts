// The host's race setup → the RaceConfig of an online race (SPEC §28). The host decides everything (the track,
// the weather, the seed, the AI field); the relay forwards the config untouched and every client builds the same
// race from it (core/race-config.ts → onlineRaceConfig). Nothing here is read from the local save: a save would
// split the race.
import { BIKES } from '../data/bikes';
import { RACERS, ROSTER } from '../data/roster';
import { TRACKS } from '../data/tracks';
import { Rng } from '../core/rng';
import type { OnlineHuman, OnlineRace, RaceConfig } from '../core/contracts';
import type { BikeId, CharacterId, SkillLoadout, TrackId, Weather } from '../core/types';
import type { Member, RoomSetup } from './protocol';

/** The size of the grid of an online race: the humans first, the AI fills the rest. */
export const ONLINE_GRID = 8;
/** The career level of an online race (the AI aggression, the traffic density). */
export const ONLINE_LEVEL = 2;
/** The weathers a host may pick. */
const WEATHERS: readonly Weather[] = ['clear', 'rain', 'snow', 'fog', 'dusk'];

/** The config the host sends: the race parts the clients need, the rest the core derives identically. */
export interface OnlineConfig extends Partial<RaceConfig> {
  online: OnlineRace;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTrack = (v: unknown): v is TrackId => typeof v === 'string' && Object.hasOwn(TRACKS, v);
const isBike = (v: unknown): v is BikeId => typeof v === 'string' && Object.hasOwn(BIKES, v);
const isCharacter = (v: unknown): v is CharacterId => typeof v === 'string' && Object.hasOwn(ROSTER, v);
/** A racer is on the grid (the police corgi is not). */
const isRacer = (v: unknown): v is CharacterId => isCharacter(v) && ROSTER[v].racer;
const isWeather = (v: unknown): v is Weather => typeof v === 'string' && (WEATHERS as readonly string[]).includes(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A kit as the wire carries it: three slots and an ult (the ids are checked by the core). */
export function toLoadout(raw: unknown): SkillLoadout {
  const slots: Array<string | null> = [null, null, null];
  let ult: string | null = null;
  if (isRecord(raw)) {
    const rawSlots = Array.isArray(raw.slots) ? raw.slots : [];
    for (let i = 0; i < 3; i++) slots[i] = typeof rawSlots[i] === 'string' ? rawSlots[i] : null;
    ult = typeof raw.ult === 'string' ? raw.ult : null;
  }
  return { slots: [slots[0] ?? null, slots[1] ?? null, slots[2] ?? null], ult };
}

/**
 * The host's config: the setup of the room, a fresh seed, the AI field (RACERS without the humans, shuffled)
 * and the humans in join order — the slot order the relay's ticks use.
 *
 * The rival kits are NOT sent: the core builds them as `rivalLoadout(c, false)` (the same kit an offline race's
 * rivals have). Sending them raw would make the core validate them into a full kit with the ult — the AI would
 * freeze the humans.
 */
export function buildOnlineConfig(code: string, members: readonly Member[], setup: RoomSetup): OnlineConfig {
  const humans: OnlineHuman[] = members.map((m, slot) => {
    const character = isRacer(m.character) ? m.character : 'pelican';
    return {
      slot,
      member: m.id,
      name: m.name,
      character,
      bike: isBike(m.bike) ? m.bike : ROSTER[character].defaultBike,
      loadout: toLoadout(m.loadout),
    };
  });
  // The seed is the host's dice — it is not gameplay, and every client gets the result.
  const seed = Math.floor(Math.random() * 1e9);
  const taken = new Set(humans.map((h) => h.character));
  const rng = new Rng(seed);
  const field = rng.shuffle(RACERS.filter((c) => !taken.has(c))).slice(0, ONLINE_GRID - humans.length);
  const trackId = isTrack(setup.trackId) ? setup.trackId : 'coast';
  return {
    trackId,
    mode: 'quick',
    seed,
    level: ONLINE_LEVEL,
    traffic: true,
    police: false,
    autopilot: false,
    weather: isWeather(setup.weather) ? setup.weather : undefined,
    reverse: setup.reverse === true,
    route: 0,
    rivals: field,
    rivalBikes: field.map((c) => ROSTER[c].defaultBike),
    online: { room: code, humans, local: 0 },
  };
}

/** The config the relay forwarded: checked field by field, so a broken host cannot crash a client. */
export function parseStartConfig(raw: unknown): OnlineConfig | null {
  if (!isRecord(raw)) return null;
  const online = raw.online;
  if (!isRecord(online)) return null;
  const rawHumans = online.humans;
  if (!Array.isArray(rawHumans) || rawHumans.length === 0) return null;
  const humans: OnlineHuman[] = [];
  for (const h of rawHumans) {
    if (!isRecord(h)) return null;
    const member = num(h.member);
    if (member === null) return null;
    const character = isRacer(h.character) ? h.character : 'pelican';
    humans.push({
      slot: humans.length,
      member,
      name: typeof h.name === 'string' ? h.name : '',
      character,
      bike: isBike(h.bike) ? h.bike : ROSTER[character].defaultBike,
      loadout: toLoadout(h.loadout),
    });
  }
  const rivals = Array.isArray(raw.rivals) ? raw.rivals.filter(isCharacter) : [];
  const rivalBikes = Array.isArray(raw.rivalBikes) ? raw.rivalBikes.filter(isBike) : [];
  return {
    trackId: isTrack(raw.trackId) ? raw.trackId : 'coast',
    mode: 'quick',
    seed: num(raw.seed) ?? 1,
    level: num(raw.level) ?? ONLINE_LEVEL,
    traffic: raw.traffic !== false,
    police: false,
    autopilot: false,
    weather: isWeather(raw.weather) ? raw.weather : undefined,
    reverse: raw.reverse === true,
    route: num(raw.route) ?? 0,
    rivals,
    rivalBikes,
    online: { room: typeof online.room === 'string' ? online.room : '', humans, local: 0 },
  };
}
