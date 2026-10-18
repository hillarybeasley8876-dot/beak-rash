// AI director: one Brain per AI rider (and the player on autopilot), shared perception and racing
// line, pace-normalised rubber band (pace.ts), one hunter on the player at a time, the hunt budget
// (hits landed on the player), grudges (rivals the player hits), bell after overtaking the player, taunts.
import type { Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderId, RiderState } from '../../../core/types';
import { riderRating } from '../grid';
import { Brain, type AiWorld } from './brain';
import type { HuntToken } from './fight';
import { buildRacingLine } from './line';
import { basePace, easeRubber, paceCap, paybackPace, unseenBehind } from './pace';
import { makePersonality } from './personality';
import { Senses } from './sense';
import { Taunts } from './taunts';

const PACE_SPREAD = 0.02;   // ± pace offset between the best and the worst rival of the day
const RANK_WEIGHT = 0.25;   // share of the offset that comes from strength rank (the rest is today's form)
const RECOVER = 12;         // s after a respawn without catch-up (a KO buys a real gap)

export interface AiDirector {
  preStep(dt: number, countdownTime: number): void;
  brain(id: RiderId): Brain | undefined;
  dispose(): void;
}

/**
 * Per-rider pace offsets within ±PACE_SPREAD: mostly today's form (per race dice), a quarter from strength
 * rank (strongest +, weakest −), so the favourites start a little quicker without owning the podium.
 */
function paceOffsets(riders: readonly RiderState[], rng: Rng): Map<RiderId, number> {
  const rivals = riders.filter((r) => !r.isPlayer).sort((a, b) => riderRating(b) - riderRating(a));
  const n = Math.max(1, rivals.length - 1);
  const offset = (rank: number): number => PACE_SPREAD * (RANK_WEIGHT * (1 - (2 * rank) / n) + (1 - RANK_WEIGHT) * rng.range(-1, 1));
  return new Map(rivals.map((r, i) => [r.id, offset(i)]));
}

export function createAi(session: Session): AiDirector {
  const { config, track, app } = session;
  const rng = session.rng.fork(0xa1);
  const line = buildRacingLine(track);
  const token: HuntToken = { holder: null };
  const brains = new Map<RiderId, Brain>();
  for (const r of session.riders) {
    const c = session.controls.get(r.id);
    if (!c) continue;
    const p = makePersonality(r.character, config.level, rng.fork(r.id + 1));
    brains.set(r.id, new Brain(r, c, p, rng.fork(0x100 + r.id), token));
  }
  const offsets = paceOffsets(session.riders, rng.fork(0xf0f));
  const taunts = new Taunts(session, rng.fork(0x7a), (id) => brains.get(id)?.p.taunty ?? 1);
  const lastDs = new Map<RiderId, number>();
  const respawnAt = new Map<RiderId, number>();
  const world: AiWorld = {
    phase: session.phase, countdownTime: 0, time: 0, riders: session.riders, player: session.player, line,
    senses: new Senses(session),
    bounds: (s) => track.bounds(s),
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
    b.paceTop = paceCap({ rider: r, player: p, level: config.level, offset, huntingPlayer, chaseCam, recovering, payback });
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
