// Bus → HUD routing. Every handler is presentation-only and tolerant of missing riders/sessions.
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../core/events-map';
import type { Session } from '../../core/contracts';
import type { Cluster } from './cluster';
import type { CutinLayer } from './cutins/layer';
import type { Hints } from './hints';
import type { PlaceBlock } from './place';
import type { Quip } from './quip';
import type { Speedo } from './speedo';
import type { WorldOverlay } from './world/overlay';

/** SPEC §9 / race police.ts: BUSTED = a fine + a 4 s ticket stop (mode 'busted'); no time is added at the finish. */
export const TICKET_HOLD = 4;

export interface HudParts {
  session(): Session | null;
  place: PlaceBlock;
  speedo: Speedo;
  cluster(): Cluster | null;
  world: WorldOverlay;
  cutins: CutinLayer;
  /** The player's own lines (KO / skill / respawn) from the cluster portrait. */
  quip: Quip;
  /** First-race control prompts: each leaves once the player does what it asks. */
  hints: Hints;
  /** The player was BUSTED (starts the ticket-stop countdown next to the timer). */
  busted(): void;
}

export function wireHudEvents(bus: EventBus<GameEvents>, p: HudParts): () => void {
  const me = (id: number | null): boolean => id !== null && p.session()?.player.id === id;
  const offs = [
    bus.on('race:intro', (e) => p.cutins.intro.setDuration(e.duration)),
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
      if (e.phase === 'start') p.hints.done('drift');
      p.speedo.onDrift(e.phase, e.level);
      p.cutins.drift(e);
    }),
    bus.on('rider:hop', (e) => {
      if (me(e.riderId)) p.hints.done('hop');
    }),
    bus.on('combat:swing', (e) => {
      if (me(e.riderId)) p.hints.done('swing');
    }),
    bus.on('rider:land', (e) => p.cutins.land(e)),
    bus.on('rider:nearMiss', (e) => p.cutins.nearMiss(e)),
    bus.on('rider:boost', (e) => p.cutins.boost(e)),
    bus.on('rider:crash', (e) => p.cutins.crash(e)),
    bus.on('rider:respawn', (e) => {
      if (me(e.riderId)) p.quip.say('hurt');
    }),
    bus.on('combat:hit', (e) => {
      if (me(e.victim) && !e.blocked) p.cluster()?.hurt();
      p.world.onHit(e);
    }),
    bus.on('combat:ko', (e) => {
      if (me(e.attacker)) {
        p.cluster()?.scored();
        p.quip.say('ko');
      }
      p.cutins.combatKo(e);
    }),
    bus.on('combat:combo', (e) => p.cutins.combo(e)),
    bus.on('skill:cast', (e) => {
      if (me(e.riderId)) {
        p.quip.say('skill', e.slot);
        // The band plays for the first cast of each skill per race; later casts get the compact cast tag.
        if (!p.cutins.playerSkill(e)) p.cluster()?.castTag(e.skillId);
      } else p.cutins.rivalSkill(e);
      p.world.onSkillCast(e);
    }),
    bus.on('skill:denied', (e) => {
      if (me(e.riderId)) p.cluster()?.skills.deny(e.slot, e.reason);
    }),
    bus.on('ult:start', (e) => {
      if (me(e.riderId)) p.hints.done('ult');
      p.cutins.ultStart(e.riderId);
    }),
    bus.on('cine:ult', (e) => p.cutins.cineUlt(e)),
    bus.on('cine:ko', (e) => p.cutins.cineKo(e)),
    bus.on('pickup:take', (e) => p.cutins.pickup(e)),
    bus.on('achievement:unlock', (e) => p.cutins.achievement(e.id)),
    // The player's own lines (bell, gulp swallow) go to the cluster quip, not over the road.
    bus.on('taunt', (e) => (me(e.riderId) ? p.quip.line(e.text) : p.world.onTaunt(e))),
    bus.on('projectile:spawn', (e) => {
      p.cutins.projectile(e);
      p.world.onProjectile(e);
    }),
    bus.on('projectile:end', (e) => p.world.incoming.end(e.id)),
    bus.on('police:alert', (e) => {
      if (me(e.riderId)) p.world.edges.policeAlert(e.level);
    }),
    bus.on('police:busted', (e) => {
      if (!me(e.riderId)) return;
      p.busted();
      p.cutins.busted(e);
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
