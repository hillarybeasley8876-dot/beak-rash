// Bus → HUD routing. Every handler is presentation-only and tolerant of missing riders/sessions.
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { Session } from '../../core/contracts';
import type { Cluster } from './cluster';
import type { CutinLayer } from './cutins/layer';
import type { PlaceBlock } from './place';
import type { Speedo } from './speedo';
import type { WorldOverlay } from './world/overlay';

/** SPEC §9: BUSTED costs a 4 s time penalty (shown next to the timer). */
export const BUSTED_PENALTY = 4;

export interface HudParts {
  session(): Session | null;
  place: PlaceBlock;
  speedo: Speedo;
  cluster(): Cluster | null;
  world: WorldOverlay;
  cutins: CutinLayer;
  /** Adds seconds of penalty; returns the new total. */
  addPenalty(seconds: number): number;
}

export function wireHudEvents(bus: EventBus<GameEvents>, p: HudParts): () => void {
  const me = (id: number | null): boolean => id !== null && p.session()?.player.id === id;
  const offs = [
    bus.on('race:countdown', (e) => p.cutins.countdown(e.n)),
    bus.on('race:placeChange', (e) => {
      const s = p.session();
      if (!s || !me(e.riderId) || s.phase !== 'racing' || s.time < 1) return;
      p.place.flash(e.from, e.to);
      p.cutins.placeChange(e);
    }),
    bus.on('race:finishLine', (e) => p.cutins.finish(e)),
    bus.on('race:finalStretch', (e) => p.cutins.finalStretch(e)),
    bus.on('rider:drift', (e) => {
      if (!me(e.riderId)) return;
      p.speedo.onDrift(e.phase, e.level);
      p.cutins.drift(e);
    }),
    bus.on('rider:land', (e) => p.cutins.land(e)),
    bus.on('rider:nearMiss', (e) => p.cutins.nearMiss(e)),
    bus.on('rider:boost', (e) => p.cutins.boost(e)),
    bus.on('rider:crash', (e) => p.cutins.crash(e)),
    bus.on('combat:hit', (e) => {
      if (me(e.victim) && !e.blocked) p.cluster()?.hurt();
      // Combat wears a weapon only on landed melee hits (blocked swings are free).
      if (me(e.attacker) && !e.blocked) p.cluster()?.weapon.used(e.weapon, e.skillId);
      p.world.onHit(e);
    }),
    bus.on('combat:ko', (e) => {
      if (me(e.attacker)) p.cluster()?.scored();
      p.cutins.combatKo(e);
    }),
    bus.on('combat:combo', (e) => p.cutins.combo(e)),
    bus.on('combat:weaponPick', (e) => {
      if (me(e.riderId)) p.cluster()?.weapon.picked(e.weapon);
    }),
    bus.on('skill:cast', (e) => {
      p.cutins.skillCast(e);
      p.world.onSkillCast(e);
    }),
    bus.on('skill:denied', (e) => {
      if (me(e.riderId)) p.cluster()?.skills.deny(e.slot, e.reason);
    }),
    bus.on('ult:start', (e) => p.cutins.ultStart(e.riderId)),
    bus.on('cine:ult', (e) => p.cutins.cineUlt(e)),
    bus.on('cine:ko', (e) => p.cutins.cineKo(e)),
    bus.on('pickup:take', (e) => p.cutins.pickup(e)),
    bus.on('taunt', (e) => p.world.onTaunt(e)),
    bus.on('police:alert', (e) => {
      if (me(e.riderId)) p.world.edges.policeAlert(e.level);
    }),
    bus.on('police:busted', (e) => {
      if (!me(e.riderId)) return;
      p.addPenalty(BUSTED_PENALTY);
      p.cutins.busted(e, BUSTED_PENALTY);
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
