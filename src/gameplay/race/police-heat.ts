// Police heat (player only): rises when you hit rivals or crash into traffic (more with the corgi
// watching), cools over time — three times faster after 10 s without an offence.
import { clamp01 } from '../../core/math';
import type { Session } from '../../core/contracts';

// A player who keeps fighting (a landed hit every few seconds) reaches the spawn heat within the first minute
// on every track (acceptance r1: city seed 2 peaked at 0.47 with the old 0.07 per hit and 0.012/s cooling).
const HIT = 0.09;
const KO = 0.25;
const SKILL_HIT = 0.07;
const TRAFFIC_CRASH = 0.3;
const OBSTACLE_HIT = 0.12;
const WATCHED = 1.6;          // multiplier while the corgi is chasing within 60 m
const COOL = 0.01;            // /s
const CALM_AFTER = 10;        // s without an offence before cooling speeds up
const CALM_MUL = 3;

export interface Heat {
  /** Cool down; `chaseGap` = metres the player leads the active corgi by (null = no corgi).
   *  `coolMul` > 1 cools faster (a tunnel with the officers far behind, SPEC §14). */
  update(dt: number, chaseGap: number | null, coolMul?: number): void;
  /** An offence the race itself detects (e.g. knocking the officer about). */
  offence(v: number): void;
  /** Debug/tests: set the heat as if an offence just happened. */
  set(v: number): void;
  dispose(): void;
}

export function createHeat(session: Session): Heat {
  const { bus } = session.app;
  const player = session.player;
  let gap: number | null = null;
  let calmT = 0;
  const add = (v: number): void => {
    if (session.phase !== 'racing' || player.finishTime !== null) return;
    const watched = gap !== null && gap < 60 ? WATCHED : 1;
    player.heat = clamp01(player.heat + v * watched);
    calmT = 0;
  };
  const offs = [
    bus.on('combat:hit', ({ attacker, blocked, skillId }) => {
      if (attacker === player.id && !blocked) add(skillId ? SKILL_HIT : HIT);
    }),
    bus.on('combat:ko', ({ attacker }) => { if (attacker === player.id) add(KO); }),
    bus.on('rider:crash', ({ riderId, cause }) => { if (riderId === player.id && cause === 'traffic') add(TRAFFIC_CRASH); }),
    bus.on('rider:obstacleHit', ({ riderId, kind }) => {
      if (riderId === player.id && kind !== 'police' && kind !== 'oil' && kind !== 'puddle') add(OBSTACLE_HIT);
    }),
  ];
  return {
    update(dt, chaseGap, coolMul = 1) {
      gap = chaseGap;
      calmT += dt;
      player.heat = clamp01(player.heat - COOL * coolMul * (calmT > CALM_AFTER ? CALM_MUL : 1) * dt);
    },
    offence: add,
    set(v) {
      player.heat = clamp01(v);
      calmT = 0;
    },
    dispose() {
      for (const off of offs) off();
    },
  };
}
