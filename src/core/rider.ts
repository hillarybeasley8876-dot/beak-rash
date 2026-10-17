// RiderState factory with every field initialised (units may rely on all fields existing).
import { BIKES } from '../data/bikes';
import { ROSTER } from '../data/roster';
import { defaultMods } from './types';
import type { BikeId, CharacterId, RiderId, RiderState } from './types';

export function createRiderState(
  id: RiderId, character: CharacterId, bike: BikeId, isPlayer: boolean,
): RiderState {
  const def = ROSTER[character];
  const maxHp = 60 + def.stats.hp * 12 + BIKES[bike].durability;
  return {
    id, character, bike, isPlayer, name: def.name,
    s: 0, x: 0, y: 0, speed: 0, vx: 0, vy: 0, yaw: 0, lean: 0,
    airborne: false, airTime: 0, drifting: false, driftCharge: 0, boostTime: 0, boostPower: 0,
    surface: 'road', draft: 0,
    mode: 'grid', modeTime: 0, place: id + 1, progress: 0, finishTime: null, rubber: 1,
    hp: maxHp, maxHp, sp: 0, weapon: 'none', statuses: [], mods: defaultMods(), action: null,
    cooldowns: [0, 0, 0], combo: 0, comboTimer: 0, kos: 0, wrecked: 0,
    lastHitBy: null, lastHitTime: -999, invuln: 0, coins: 0, heat: 0, crash: null,
  };
}
