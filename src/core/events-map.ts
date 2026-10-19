// Every cross-unit event. Emitters own the payload shape; listeners must tolerate extra fields.
import type { CharacterId, CrashCause, RiderId, Side, TrackId, Vec3Like, WeaponId } from './types';
import type { RaceConfig, RaceResult, ScreenId } from './contracts';

export interface GameEvents {
  // ---- flow (UI ⇄ core/game.ts) ----
  'flow:startRace': { config: Partial<RaceConfig> };
  'flow:restartRace': Record<string, never>;
  'flow:quitRace': Record<string, never>;
  'flow:pause': { paused: boolean };
  'flow:screen': { screen: ScreenId };            // emitted by game.ts whenever the screen changes
  'flow:loading': { progress: number; label: string };

  // ---- race lifecycle (gameplay/race) ----
  'race:intro': { trackId: TrackId; duration?: number };   // duration (s) of the flyover, for HUD pacing
  'race:countdown': { n: number };                // 3, 2, 1, then 0 = GO
  'race:start': Record<string, never>;
  'race:placeChange': { riderId: RiderId; from: number; to: number };
  'race:finishLine': { riderId: RiderId; place: number; time: number };
  'race:end': { results: RaceResult[] };          // all results final; game.ts shows results screen
  'race:finalStretch': { riderId: RiderId };       // player passes 85 % progress
  'race:introFocus': { riderId: RiderId | null };  // intro flyover's current subject (null = scenery shot)

  // ---- riding (sim/) ----
  'rider:bump': { a: RiderId; b: RiderId; strength: number; pos: Vec3Like };
  'rider:crash': { riderId: RiderId; cause: CrashCause; speed: number; pos: Vec3Like; attacker: RiderId | null };
  'rider:respawn': { riderId: RiderId };
  'rider:hop': { riderId: RiderId };
  'rider:land': { riderId: RiderId; airTime: number; perfect: boolean };
  'rider:drift': { riderId: RiderId; phase: 'start' | 'level' | 'end'; level: number };
  'rider:boost': { riderId: RiderId; kind: 'drift' | 'skill' | 'land' | 'draft' | 'pickup' | 'pad' | 'launch'; power: number; time: number };
  'rider:nearMiss': { riderId: RiderId; kind: 'traffic' | 'rider' };
  'rider:offroad': { riderId: RiderId; surface: string };
  'rider:obstacleHit': { riderId: RiderId; obstacleId: number; kind: string; speed: number; pos: Vec3Like };

  // ---- combat (gameplay/combat) ----
  'combat:swing': { riderId: RiderId; side: Side; heavy: boolean; weapon: WeaponId };
  'combat:hit': {
    attacker: RiderId; victim: RiderId; damage: number; side: Side; weapon: WeaponId;
    heavy: boolean; crit: boolean; blocked: boolean; pos: Vec3Like; skillId: string | null;
  };
  'combat:ko': { attacker: RiderId | null; victim: RiderId; cause: CrashCause; pos: Vec3Like; skillId: string | null; weapon: WeaponId };
  'combat:combo': { riderId: RiderId; count: number };
  'combat:weaponDrop': { riderId: RiderId; weapon: WeaponId; pos: Vec3Like };
  'combat:weaponPick': { riderId: RiderId; weapon: WeaponId; stolenFrom: RiderId | null };
  'combat:weaponBreak': { riderId: RiderId; weapon: WeaponId; pos: Vec3Like };
  'combat:bell': { riderId: RiderId; pos: Vec3Like; angered: RiderId[] };
  'projectile:spawn': { id: number; owner: RiderId; target: RiderId | null; kind: string; pos: Vec3Like };
  'projectile:end': { id: number; hit: RiderId | null; pos: Vec3Like };
  'skill:cast': { riderId: RiderId; skillId: string; slot: number };
  'skill:hit': { riderId: RiderId; skillId: string; victim: RiderId; pos: Vec3Like };
  'skill:end': { riderId: RiderId; skillId: string };
  'skill:denied': { riderId: RiderId; slot: number; reason: 'cooldown' | 'sp' | 'state' };
  'ult:start': { riderId: RiderId; skillId: string };      // UI cut-in + KO-style cinematic
  'ult:impact': { riderId: RiderId; skillId: string; pos: Vec3Like; victims: RiderId[] };
  'pickup:take': { riderId: RiderId; kind: string; pos: Vec3Like };
  'taunt': { riderId: RiderId; text: string; character: CharacterId };

  // ---- police / traffic (gameplay/race) ----
  'police:alert': { riderId: RiderId; level: number; reason?: 'spawn' | 'lost' | 'busted' };
  'police:busted': { riderId: RiderId; fine: number; hold?: number };   // hold = ticket-stop seconds (HUD assumes 4)
  'police:whistle': { riderId: RiderId; pos: Vec3Like };               // the corgi whistles at riderId
  'police:knock': { riderId: RiderId; weapon: WeaponId; pos: Vec3Like }; // riderId's swing knocked the corgi back
  /** A line from a speaker that is not a session rider but rides an Obstacle (the police corgi): listeners follow
   *  `session.obstacles` by id for the anchor and drop the line once that obstacle is gone. */
  'npc:say': { obstacleId: number; character: CharacterId; text: string };
  'traffic:honk': { obstacleId: number; pos: Vec3Like };

  // ---- meta (gameplay/achievements) ----
  'achievement:unlock': { id: string };

  // ---- cinematics (fx/ko director) ----
  'cine:ko': { phase: 'start' | 'peak' | 'end'; attacker: RiderId | null; victim: RiderId; chain: number };
  'cine:ult': { phase: 'start' | 'impact' | 'end'; riderId: RiderId };
  'cam:shake': { intensity: number; duration: number };
  'cam:kick': { fov: number; duration: number };
  'hitstop': { seconds: number };
}
