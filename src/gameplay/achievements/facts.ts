// Per-race facts the achievement rules accumulate from bus events, and the context each rule module gets.
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { AppContext, Session } from '../../core/contracts';
import type { CharacterId, RiderId, RiderState } from '../../core/types';
import type { AchievementId } from '../../data/achievements';

/** A rival skill during which it may pass the player (pigeon.ghost → 'pigeon', sloth.flash → 'sloth'). */
export interface PassWindow { rider: RiderId; achievement: 'pigeon' | 'sloth'; wasBehind: boolean; until: number }

/** The last blow that reached an officer: who hit it and whether it was a skill (SPEC §25). */
export interface PoliceHit { attacker: RiderId; skill: boolean }

export interface RaceFacts {
  started: boolean;              // race:start seen (launch boosts come just before it)
  attacked: boolean;             // player swung, cast a skill or the ult
  hurt: boolean;                 // player took damage or crashed
  hp: number;                    // player HP at the last sample (any drop = damage, whatever dealt it)
  wasLast: boolean;              // player was in last place at some point after GO
  placeAtStretch: number | null; // player's place when entering the final stretch
  wrecks: number;
  kos: number;                   // KOs by the player's own hands (SHOWTIME's own KOs not included)
  koTimes: number[];             // sim times of the player's recent hand KOs
  koSpecies: Set<CharacterId>;
  oneMores: number;              // ONE MORE! calls for the player
  steals: number;                // weapons the player took out of rivals' hands
  perfectLandings: number;
  nearMisses: number;
  slingshotAt: number;           // sim time of the player's last slingshot (draft) boost
  slingshotPasses: number;       // slingshots the player turned into a place gained within the window
  wing: { active: boolean; hits: Set<RiderId> };
  ult: { at: number; victims: Set<RiderId>; kos: number };
  robbedBy: Map<RiderId, number>; // seagull id → sim time it robbed the player
  passes: PassWindow[];
  chase: { active: boolean; busted: boolean };
  wanted3: boolean;        // the player's wanted stars reached ★3 (police 2.0, SPEC §14)
  alliance: boolean;       // an alliance formed against the player (SPEC §18)
  events: number;          // track events that started in this race (SPEC §19)
  policeDowns: number;     // officers the player downed in this race (SPEC §25)
  policeHits: Map<number, PoliceHit>;  // the last blow on each officer (a swing takes a skill hit back)
}

export function newFacts(): RaceFacts {
  return {
    started: false, attacked: false, hurt: false, hp: Infinity, wasLast: false, placeAtStretch: null,
    wrecks: 0, kos: 0, koTimes: [], koSpecies: new Set(), oneMores: 0, steals: 0, perfectLandings: 0, nearMisses: 0,
    slingshotAt: -Infinity, slingshotPasses: 0,
    wing: { active: false, hits: new Set() },
    ult: { at: -Infinity, victims: new Set(), kos: 0 },
    robbedBy: new Map(), passes: [], chase: { active: false, busted: false },
    wanted3: false, alliance: false, events: 0,
    policeDowns: 0, policeHits: new Map(),
  };
}

/** What a rule module needs; every handler it registers must be returned as an unsubscribe. */
export interface RuleCtx {
  readonly app: AppContext;
  readonly session: Session;
  readonly facts: RaceFacts;
  readonly bus: EventBus<GameEvents>;
  readonly player: RiderState;
  isPlayer(id: RiderId | null): boolean;
  character(id: RiderId | null): CharacterId | null;
  /** Sim seconds since GO (slow-mo and pause stretch it like every gameplay window). */
  now(): number;
  /** Compare the player's HP with the last sample: bumps and hits both show up as a drop. */
  sampleHp(): void;
  unlock(id: AchievementId): void;
}

export function makeRuleCtx(app: AppContext, session: Session, facts: RaceFacts, unlock: (id: AchievementId) => void): RuleCtx {
  return {
    app, session, facts, unlock, bus: app.bus, player: session.player,
    isPlayer: (id) => id !== null && id === session.player.id,
    character: (id) => (id === null ? null : session.rider(id)?.character ?? null),
    now: () => session.time,
    sampleHp: () => {
      const hp = session.player.hp;
      if (hp < facts.hp - 1e-3) facts.hurt = true;
      facts.hp = hp;
    },
  };
}
