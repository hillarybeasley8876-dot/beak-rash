// AI director: one Brain per AI rider (and the player on autopilot), shared perception and racing
// line, today's form (form.ts) and the pace-normalised rubber band (pace.ts), one hunter on the player at a time, the hunt budget
// (hits landed on the player), grudges (rivals the player hits), bell after overtaking the player, taunts.
import type { Session } from '../../../core/contracts';
import type { RiderId, RiderState } from '../../../core/types';
import type { BlunderGate } from './blunder';
import { Brain, type AiWorld } from './brain';
import type { HuntToken } from './fight';
import { paceOffset, type FormTable } from './form';
import { buildRacingLine } from './line';
import { basePace, easeRubber, paceCap, paybackPace, unseenBehind } from './pace';
import { makePersonality } from './personality';
import { Senses } from './sense';
import { Taunts } from './taunts';

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
  dispose(): void;
}

/** `form` = today's form of every rival (form.ts): personality dice and pace offsets. */
export function createAi(session: Session, form: FormTable): AiDirector {
  const { config, track, app } = session;
  const rng = session.rng.fork(0xa1);
  const line = buildRacingLine(track);
  const token: HuntToken = { holder: null };
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
    brains.set(r.id, new Brain(r, c, p, rng.fork(0x100 + r.id), token, r.id === nemesisId));
  }
  const offsets = new Map(session.riders.filter((r) => !r.isPlayer).map((r) => [r.id, paceOffset(r, form.get(r.id))]));
  const taunts = new Taunts(session, rng.fork(0x7a), (id) => brains.get(id)?.p.taunty ?? 1, nemesisId);
  const lastDs = new Map<RiderId, number>();
  const respawnAt = new Map<RiderId, number>();
  let blunders = config.traffic ? BLUNDERS : 0;
  const blunder: BlunderGate = {
    may: (r) => {
      const ahead = r.s - session.player.s;
      return blunders > 0 && !r.isPlayer && session.phase === 'racing' && session.time > BLUNDER_FROM
        && app.rig.mode === 'chase' && ahead > BLUNDER_AHEAD[0] && ahead < BLUNDER_AHEAD[1];
    },
    spend: () => { blunders--; },
  };
  const world: AiWorld = {
    phase: session.phase, countdownTime: 0, time: 0, riders: session.riders, player: session.player, line,
    senses: new Senses(session),
    bounds: (s) => track.bounds(s),
    blunder,
  };
  const offs = [
    app.bus.on('combat:hit', ({ attacker, victim, blocked }) => {
      const p = session.player;
      if (blocked || attacker === victim) return;
      if (victim === p.id) brains.get(attacker)?.fighter.landedOnPlayer(session.time, p);
      else if (attacker === p.id) brains.get(victim)?.fighter.wronged(p, session.time);
    }),
    app.bus.on('rider:respawn', ({ riderId }) => { respawnAt.set(riderId, session.time); }),
  ];

  /** The player's brain drives on autopilot, and rolls the bike out after the finish line. */
  const driveFor = (r: RiderState): boolean => config.autopilot || r.finishTime !== null;

  const rubberBand = (b: Brain, dt: number): void => {
    const r = b.r, p = session.player;
    if (r.isPlayer || session.phase !== 'racing') {
      b.paceTop = b.basePace = Infinity;
      if (!r.isPlayer) r.rubber = 1;
      return;
    }
    const chaseCam = app.rig.mode === 'chase';
    const huntingPlayer = b.fighter.hunt === p;
    const recovering = session.time - (respawnAt.get(r.id) ?? -Infinity) < RECOVER;
    const offset = offsets.get(r.id) ?? 0;
    const payback = !recovering && b.fighter.paybackChase(p, dt);
    b.basePace = basePace(config.level, offset);
    b.paceTop = paceCap({ rider: r, player: p, level: config.level, offset, huntingPlayer, chaseCam, recovering, payback, nemesis: b.nemesis });
    const inView = payback ? paybackPace(b.basePace, p) : b.basePace;
    easeRubber(r, b.paceTop, inView, unseenBehind(r, p, chaseCam, huntingPlayer), dt, payback);
  };

  const bellCheck = (b: Brain): void => {
    const r = b.r, p = session.player;
    if (r.isPlayer) return;
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
        if (b.r.isPlayer && !driveFor(b.r)) continue;
        rubberBand(b, dt);
        if (session.phase === 'racing') bellCheck(b);
        b.update(dt, world);
      }
      taunts.update(dt);
    },
    dispose() {
      for (const off of offs) off();
      taunts.dispose();
      for (const b of brains.values()) b.fighter.release();
      brains.clear();
    },
  };
}
