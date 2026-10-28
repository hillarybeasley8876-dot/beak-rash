// AI director: one Brain per rider (the AI ones, and a human once it has finished), shared perception and racing
// line, today's form (form.ts) and the pace-normalised rubber band (pace.ts), one hunter per human at a time
// (the hunt token), the hunt budget (hits landed on a human), grudges (the humans a rival hits), bell after
// overtaking a human, taunts.
// The sim's "the player" is a HUMAN, never the local rider (SPEC §28): offline there is one (the player),
// online there is one per member — every rule below works per human.
import type { Session } from '../../../core/contracts';
import type { RiderId, RiderState } from '../../../core/types';
import type { BlunderGate } from './blunder';
import { Brain, type AiWorld } from './brain';
import type { HuntTokens } from './fight';
import { paceOffset, type FormTable } from './form';
import { buildRacingLine } from './line';
import { basePace, easeRubber, paceCap, paybackPace, unseenBehind } from './pace';
import { makePersonality } from './personality';
import { Senses } from './sense';
import { Taunts } from './taunts';
import { nearestHuman } from '../humans';
import type { WorkZone } from '../ctx';

const RECOVER = 12;         // s after a respawn without catch-up (a KO buys a real gap)
const BLUNDERS = 1;         // in-view traffic blunders per race (blunder.ts)…
const BLUNDER_FROM = 15;    // …not before this race time…
const BLUNDER_AHEAD = [-4, 30] as const;  // …by a rival this far ahead of the player (close in the chase camera)

/** r4 (SPEC §18): the pack that gangs up on the player (围剿) as the AI sees it. */
export interface AllianceView {
  members: readonly RiderId[];
  target: RiderId;
  /** member → the ally it is feuding with (5 s after a friendly fire). */
  feuds: ReadonlyMap<RiderId, RiderId>;
}

/** 宿敌: the nemesis fights harder (SPEC §18). */
export const NEMESIS_AGGRESSION = 1.5;

export interface AiDirector {
  preStep(dt: number, countdownTime: number): void;
  brain(id: RiderId): Brain | undefined;
  /** The alliance of this frame (the rivals gang up on the player). */
  setAlliance(view: AllianceView): void;
  /** A rival says a line right now (paced like the other taunts). */
  taunt(riderId: RiderId, text: string): void;
  /** r6 (SPEC §28): the human that rode `id` left — an AI rides it from now on. */
  takeover(id: RiderId): void;
  /** A work zone is announced (or gone): the AI rides its open lane (the closed side is a dead end). */
  setZone(id: number, zone: WorkZone | null): void;
  dispose(): void;
}

/** `form` = today's form of every rival (form.ts): personality dice and pace offsets. */
export function createAi(session: Session, form: FormTable): AiDirector {
  const { config, track, app } = session;
  const rng = session.rng.fork(0xa1);
  const line = buildRacingLine(track);
  const online = !!config.online;
  // One hunt token per human (SPEC §28): a hunter per human, not per race.
  const tokens: HuntTokens = new Map();
  const brains = new Map<RiderId, Brain>();
  // 宿敌: the rival with the biggest grudge (≥ 50) in this field. It fights harder and hunts the player.
  const nemesisId = config.nemesis === null || config.nemesis === undefined
    ? null
    : (session.riders.find((r) => r.character === config.nemesis)?.id ?? null);
  for (const r of session.riders) {
    const c = session.controls.get(r.id);
    if (!c) continue;
    const p = makePersonality(r.character, config.level, rng.fork(r.id + 1), form.get(r.id));
    if (r.id === nemesisId) p.aggression = Math.min(1, p.aggression * NEMESIS_AGGRESSION);
    brains.set(r.id, new Brain(r, c, p, rng.fork(0x100 + r.id), tokens, r.id === nemesisId));
  }
  const offsets = new Map(session.riders.filter((r) => !r.human).map((r) => [r.id, paceOffset(r, form.get(r.id))]));
  const taunts = new Taunts(session, rng.fork(0x7a), (id) => brains.get(id)?.p.taunty ?? 1, nemesisId);
  const lastDs = new Map<RiderId, number>();
  const respawnAt = new Map<RiderId, number>();
  /** The work zones of the race (the AI rides their open lane). */
  const zones = new Map<number, WorkZone>();
  const zoneAt = (s: number): WorkZone | null => {
    for (const z of zones.values()) {
      if (s >= z.s0 && s <= z.s1) return z;
    }
    return null;
  };
  let blunders = config.traffic ? BLUNDERS : 0;
  const blunder: BlunderGate = {
    may: (r) => {
      const h = nearestHuman(session, r);
      if (!h) return false;
      const ahead = r.s - h.s;
      return blunders > 0 && !r.human && session.phase === 'racing' && session.time > BLUNDER_FROM
        && (online || app.rig.mode === 'chase') && ahead > BLUNDER_AHEAD[0] && ahead < BLUNDER_AHEAD[1];
    },
    spend: () => { blunders--; },
  };
  const world: AiWorld = {
    phase: session.phase, countdownTime: 0, time: 0, riders: session.riders, humans: session.humans,
    humanFor: (r) => nearestHuman(session, r) ?? r, zoneAt, line,
    senses: new Senses(session),
    bounds: (s) => track.bounds(s),
    blunder,
    weather: config.weather,
  };
  const offs = [
    app.bus.on('combat:hit', ({ attacker, victim, blocked }) => {
      if (blocked || attacker === victim) return;
      // The humans of the race are the ones the fairness rules count: a hit on a human spends the budget of
      // that human, a hit by a human may be answered with a grudge.
      for (const h of session.humans) {
        if (victim === h.id) brains.get(attacker)?.fighter.landedOnHuman(session.time, h);
        else if (attacker === h.id) brains.get(victim)?.fighter.wronged(h, session.time);
      }
    }),
    app.bus.on('rider:respawn', ({ riderId }) => { respawnAt.set(riderId, session.time); }),
  ];

  /** The brain drives: every AI rider, a human that finished, and the autopilot player (offline only). */
  const driveFor = (r: RiderState): boolean =>
    !r.human || (!online && config.autopilot && r.isPlayer) || r.finishTime !== null;

  const rubberBand = (b: Brain, dt: number): void => {
    const r = b.r, p = nearestHuman(session, r);
    if (r.human || session.phase !== 'racing' || !p) {
      b.paceTop = b.basePace = Infinity;
      if (!r.human) r.rubber = 1;
      return;
    }
    // Online the camera is always the chase camera: the riders behind a human are unseen.
    const chaseCam = online || app.rig.mode === 'chase';
    const huntingPlayer = b.fighter.hunt === p;
    const recovering = session.time - (respawnAt.get(r.id) ?? -Infinity) < RECOVER;
    const offset = offsets.get(r.id) ?? 0;
    const payback = !recovering && b.fighter.paybackChase(p, dt);
    b.basePace = basePace(config.level, offset);
    b.paceTop = paceCap({ rider: r, human: p, level: config.level, offset, huntingPlayer, chaseCam, recovering, payback, nemesis: b.nemesis });
    const inView = payback ? paybackPace(b.basePace, p) : b.basePace;
    easeRubber(r, b.paceTop, inView, unseenBehind(r, p, chaseCam, huntingPlayer), dt, payback);
  };

  const bellCheck = (b: Brain): void => {
    const r = b.r, p = nearestHuman(session, r);
    if (r.human || !p) return;
    const d = r.s - p.s;
    const prev = lastDs.get(r.id) ?? d;
    lastDs.set(r.id, d);
    if (prev < 0 && d >= 0 && Math.abs(r.x - p.x) < 4 && rng.next() < b.p.bell) b.ringBell = true;
  };

  return {
    brain: (id) => brains.get(id),
    setAlliance(view) {
      for (const b of brains.values()) b.setAlliance(view.members, view.target, view.feuds);
    },
    taunt(riderId, text) {
      const r = session.rider(riderId);
      if (r) taunts.sayNow(r, text);
    },
    preStep(dt, countdownTime) {
      world.phase = session.phase;
      world.countdownTime = countdownTime;
      world.time = session.time;
      for (const b of brains.values()) {
        if (!driveFor(b.r)) continue;
        rubberBand(b, dt);
        if (session.phase === 'racing') bellCheck(b);
        b.update(dt, world);
      }
      taunts.update(dt);
    },
    takeover(id) {
      // The human left: this rider is AI-driven from now on, and the hunt token of that human is free again.
      const tok = tokens.get(id);
      if (tok) tok.holder = null;
      tokens.delete(id);
      brains.get(id)?.takeOver();
    },
    setZone(id, zone) {
      if (zone) zones.set(id, zone);
      else zones.delete(id);
    },
    dispose() {
      for (const off of offs) off();
      taunts.dispose();
      for (const b of brains.values()) b.fighter.release();
      brains.clear();
      zones.clear();
    },
  };
}
