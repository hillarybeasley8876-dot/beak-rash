// Every cross-unit event. Emitters own the payload shape; listeners must tolerate extra fields.
import type { CharacterId, CrashCause, Element, Reaction, RiderId, Side, TrackId, TrickKind, Vec3Like, WeaponId } from './types';
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
  // ---- r4 rivals & track events (SPEC §18–§19) ----
  'race:nemesis': { riderId: RiderId; character: CharacterId; grudge: number };
  'race:nemesisDown': { riderId: RiderId; attacker: RiderId; bonus: number };
  'race:alliance': { phase: 'form' | 'break'; members: RiderId[]; target: RiderId; reason: 'leader' | 'rampage' | 'betrayal' | 'timeout' | 'ko' };
  'race:event': { kind: 'fishSpill' | 'geese' | 'roadworks' | 'stalls'; phase: 'warn' | 'start' | 'end'; s: number; pos: Vec3Like };

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
  /** Air tricks (sim, SPEC §16): 'start' per trick, 'land' once per clean landing (count = tricks in that air,
   *  points = base STYLE points), 'fail' when a trick or superman is unfinished at touchdown (the rider crashes). */
  'rider:trick': { riderId: RiderId; phase: 'start' | 'land' | 'fail'; kind: TrickKind; count: number; points: number };

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
  /** r7 (SPEC §29): what a cast achieved, in a few words the HUD shows the caster (+30 HP, 偷到 15 SP, 吸到 3 个, 没人可抢). */
  'skill:result': { riderId: RiderId; skillId: string; text: string; good: boolean };
  'skill:denied': { riderId: RiderId; slot: number; reason: 'cooldown' | 'sp' | 'state' };
  'ult:start': { riderId: RiderId; skillId: string };      // UI cut-in + KO-style cinematic
  'ult:impact': { riderId: RiderId; skillId: string; pos: Vec3Like; victims: RiderId[] };
  'pickup:take': { riderId: RiderId; kind: string; pos: Vec3Like };
  // ---- r4 combat (SPEC §15) ----
  'combat:throw': { riderId: RiderId; weapon: WeaponId; dir: 1 | -1; pos: Vec3Like; projectileId: number };
  'combat:parry': { riderId: RiderId; attacker: RiderId | null; obstacleId: number | null; weapon: WeaponId; pos: Vec3Like };
  /** A swing, a thrown weapon or a skill (r6: skillId set) reached an obstacle (traffic, a police corgi, event props,
   *  secret props). `ko` (r6) = the blow is meant to knock an officer out whatever its HP (SHOWTIME, big ults). */
  'combat:obstacleHit': { obstacleId: number; attacker: RiderId; weapon: WeaponId; damage: number; thrown: boolean; pos: Vec3Like; skillId?: string | null; ko?: boolean };
  /** Request: combat puts a pickup on the road (track events, secrets). */
  'pickup:spawn': { kind: 'coin' | 'fish' | 'can' | 'crate' | 'weapon'; s: number; x: number; weapon?: WeaponId };
  /** Request: a non-rider attacker (police baton, event hazard) strikes `victim`; `side` = the attacker's side of the
   *  victim. combat resolves it like a melee hit (block, pan parry, shield, intangible, invuln, damage, knock, KO with
   *  `cause`, attacker null) and always answers with 'npc:hit'. */
  'npc:strike': { victim: RiderId; obstacleId: number; damage: number; knock: number; side: Side; heavy: boolean; weapon: WeaponId; pos: Vec3Like; cause: CrashCause };
  'npc:hit': { victim: RiderId; obstacleId: number; damage: number; blocked: boolean; parried: boolean; side: Side; weapon: WeaponId; pos: Vec3Like };
  // ---- r4 STYLE chains (gameplay/style, SPEC §17) ----
  'style:chain': { riderId: RiderId; action: string; label: string; points: number; total: number; mult: number; count: number };
  'style:bank': { riderId: RiderId; total: number; count: number; sp: number; coins: number; broken: boolean };
  'taunt': { riderId: RiderId; text: string; character: CharacterId };
  // ---- r6 elements (SPEC §24): an element landed on a rider (aura applied), and the reactions between two of them ----
  'combat:element': { attacker: RiderId | null; victim: RiderId; element: Element; pos: Vec3Like };
  /** `victims` = every rider the reaction touched (electro chains, overload blasts, swirl spreads), victim first. */
  'combat:reaction': { reaction: Reaction; attacker: RiderId | null; victim: RiderId; victims: RiderId[]; damage: number; pos: Vec3Like };

  // ---- police / traffic (gameplay/race) ----
  'police:alert': { riderId: RiderId; level: number; reason?: 'spawn' | 'lost' | 'busted' };
  'police:busted': { riderId: RiderId; fine: number; hold?: number };   // hold = ticket-stop seconds (HUD assumes 4)
  'police:whistle': { riderId: RiderId; pos: Vec3Like };               // the corgi whistles at riderId
  'police:knock': { riderId: RiderId; weapon: WeaponId; pos: Vec3Like }; // riderId's swing knocked the corgi back
  'police:horn': { riderId: RiderId; pos: Vec3Like };                  // the corgi toots as it lets riderId go
  // ---- r4 police 2.0 (SPEC §14); obstacleId 900 = first corgi, 901 = backup ----
  'police:wanted': { riderId: RiderId; level: number; prev: number };  // wanted stars 0..3
  'police:windup': { riderId: RiderId; obstacleId: number; side: Side; pos: Vec3Like; time: number }; // time = s until the strike
  'police:swing': { riderId: RiderId; obstacleId: number; side: Side; pos: Vec3Like; hit: boolean };
  'police:roadblock': { riderId: RiderId; s: number; gapX: number; gapWidth: number; pos: Vec3Like };
  'police:hurt': { obstacleId: number; attacker: RiderId; damage: number; hp: number; pos: Vec3Like };
  'police:down': { obstacleId: number; attacker: RiderId; pos: Vec3Like };
  'police:bribe': { riderId: RiderId; obstacleId: number; amount: number; accepted: boolean };
  // ---- r6 police (SPEC §25): the bounty for an officer down, the 特警 squad after three downs, 警局下班 ----
  /** An officer down paid the player: `bounty` coins, `refund` = fines of this race given back. */
  'police:bounty': { riderId: RiderId; obstacleId: number; bounty: number; refund: number; downs: number; pos: Vec3Like };
  /** The 特警 squad (obstacle ids 910+): called after the third officer down, arrives, each one down, all down. */
  'police:squad': { phase: 'call' | 'arrive' | 'down' | 'clear'; obstacleId: number | null; left: number };
  /** 警局下班: every squad member down — no police for the rest of the race. */
  'police:offDuty': { riderId: RiderId };
  /** A line from a speaker that is not a session rider but rides an Obstacle (the police corgi): listeners follow
   *  `session.obstacles` by id for the anchor and drop the line once that obstacle is gone. */
  'npc:say': { obstacleId: number; character: CharacterId; text: string };
  'traffic:honk': { obstacleId: number; pos: Vec3Like };

  // ---- meta (gameplay/achievements) ----
  'achievement:unlock': { id: string };
  /** An easter egg found (gameplay/secrets, SPEC §21); first = never found before on this profile. */
  'secret:found': { id: string; riderId: RiderId | null; pos: Vec3Like | null; first: boolean };

  // ---- cinematics (fx/ko director) ----
  'cine:ko': { phase: 'start' | 'peak' | 'end'; attacker: RiderId | null; victim: RiderId; chain: number };
  'cine:ult': { phase: 'start' | 'impact' | 'end'; riderId: RiderId };
  'cam:shake': { intensity: number; duration: number };
  'cam:kick': { fov: number; duration: number };
  'hitstop': { seconds: number };
}
