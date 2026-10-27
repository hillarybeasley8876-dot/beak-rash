// Track events (SPEC §19): one or two seeded events per race ahead of the player — a fish truck tipping
// over, geese crossing, roadworks, market stalls. The director arms an event when the player is 180–260 m
// before its spot ('race:event' warn), puts the props up when the player gets close ('start') and reports
// the end when the props are gone ('end'). Wired by race/logic.ts (traffic is null when the race has none).
import { Vector3 } from 'three';
import type { EventKind } from '../../../data/event-lines';
import type { RaceCtx } from '../ctx';
import type { Traffic } from '../traffic';
import { createFishSpill } from './fish-spill';
import { createGeese } from './geese';
import { planEvents } from './plan';
import { createRoadworks, roadworksPieces } from './roadworks';
import { createStalls } from './stalls';
import { EVENT_TUNING as T } from './tuning';
import type { EventProps, EventSlot } from './types';
import { buildEventWarmKit, warmReflectLayer } from './warm';

export interface EventDirector {
  preStep(dt: number): void;
  postStep(dt: number): void;
  dispose(): void;
}

/** The debug surface the acceptance test drives: window.__br.events. */
export interface EventsDebug {
  list(): Array<{ kind: EventKind; s: number }>;
  /** Arm an event at a track position right now (warn → start as usual). */
  force(kind: EventKind, s: number): void;
}

type WithEvents = { events?: EventsDebug };

export function createEventDirector(ctx: RaceCtx, traffic: Traffic | null): EventDirector {
  const { session } = ctx;
  const { app, track } = session;
  const rng = session.rng.fork(0x3e7e7);
  const slots: EventSlot[] = [];
  // The events bring their own props; the traffic manager has nothing to add here.
  void traffic;
  // The stand-ins of the props go up with the race, so core's warm-up compiles their programs behind the
  // loading screen: an event that appears in the middle of the race never has to compile one.
  const warm = buildEventWarmKit();
  session.world.add(warm.group);
  // The wet road's mirror draws the track's reflection layer with a camera that sees no lights: those
  // programs are warmed here too, or the mirror compiles them the first time the player rides past a
  // retaining wall.
  warmReflectLayer(session);

  for (const p of planEvents(rng, track, session.config.level)) {
    slots.push({ id: slots.length, kind: p.kind, s: p.s, phase: 'planned', props: null });
  }

  const tmp = new Vector3();
  const emit = (slot: EventSlot, phase: 'warn' | 'start' | 'end'): void => {
    const p = track.toWorld(slot.s, 0, 0, tmp);
    app.bus.emit('race:event', { kind: slot.kind, phase, s: slot.s, pos: { x: p.x, y: p.y, z: p.z } });
  };

  let made = 0;
  const create = (kind: EventKind, s: number): EventProps => {
    // Every event gets its own obstacle id range (a scheduled and a forced event of the same kind must
    // not share ids). The roadworks puts up a whole wall of pieces, so the range is wide.
    const setup = { session, s, rng: rng.fork(0x9e37 + made), idBase: 5000 + made * 500, traffic };
    made++;
    switch (kind) {
      case 'fishSpill': return createFishSpill(setup);
      case 'geese': return createGeese(setup);
      case 'roadworks': return createRoadworks(setup);
      case 'stalls': return createStalls(setup);
    }
  };

  const force = (kind: EventKind, s: number): void => {
    slots.push({ id: slots.length, kind, s, phase: 'planned', props: null });
  };

  const br = window.__br as (WithEvents & object) | undefined;
  const api: EventsDebug = { list: () => slots.map((slot) => ({ kind: slot.kind, s: slot.s })), force };
  if (br) br.events = api;

  return {
    preStep() {
      const player = session.player;
      for (const slot of slots) {
        if (slot.phase === 'planned') {
          const d = slot.s - player.s;
          if (d < -60) { slot.phase = 'ended'; continue; }   // the player is already past the spot
          if (d <= T.warnDist) {
            slot.phase = 'warned';
            emit(slot, 'warn');
            // The traffic has to know about the work zone before its wall goes up: the cars merge into
            // the open lane while the zone is only announced, so none of them stands in a closed lane
            // when the barriers appear.
            if (slot.kind === 'roadworks' && traffic) traffic.planZone(slot.id, roadworksPieces(session, slot.s));
          }
        }
        if (slot.phase === 'warned' && slot.s - player.s <= T.startDist) {
          slot.phase = 'started';
          slot.props = create(slot.kind, slot.s);
          emit(slot, 'start');
        }
      }
    },
    postStep(dt) {
      for (const slot of slots) {
        if (slot.phase !== 'started' || !slot.props) continue;
        slot.props.update(dt);
        if (!slot.props.done) continue;
        slot.props.dispose();
        slot.props = null;
        slot.phase = 'ended';
        traffic?.dropZone(slot.id);
        emit(slot, 'end');
      }
    },
    dispose() {
      for (const slot of slots) {
        slot.props?.dispose();
        slot.props = null;
        traffic?.dropZone(slot.id);
      }
      slots.length = 0;
      warm.dispose();
      if (br && br.events === api) delete br.events;
    },
  };
}
