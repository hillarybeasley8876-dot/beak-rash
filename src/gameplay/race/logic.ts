// Race logic (contract createRaceLogic): flow, AI, standings, results. Traffic, police, rivals (SPEC §18) and track
// events (SPEC §19) plug in here.
import type { RaceLogic, RaceResult, Session } from '../../core/contracts';
import { createAi } from './ai';
import { rollForm } from './ai/form';
import { createRaceCtx } from './ctx';
import { exposeRaceDebug } from './debug';
import { createFlow, INTRO_TIME } from './flow';
import { regrid } from './grid';
import { startIntroCamera, type IntroCamera } from './intro-camera';
import { createEventDirector } from './events';
import { createPolice } from './police';
import { buildResults, finalTimes, saveStats } from './results';
import { createSpectator } from './spectate';
import { createRivals } from './rivals';
import { createStandings } from './standings';
import { createTraffic } from './traffic';

export function createRaceLogic(session: Session): RaceLogic {
  const { app } = session;
  const { bus } = app;
  const form = rollForm(session);
  regrid(session, form);
  const ctx = createRaceCtx(session);
  const standings = createStandings(ctx);
  const ai = createAi(session, form);
  const traffic = session.config.traffic ? createTraffic(session) : null;
  const police = session.config.police ? createPolice(ctx) : null;
  const rivals = createRivals(ctx, ai);
  const events = createEventDirector(ctx, traffic, ai);
  let finalResults: RaceResult[] | null = null;
  let intro: IntroCamera | null = null;
  let started = false;
  let disposed = false;

  const end = (timedOut: boolean): void => {
    if (ctx.ended) return;
    ctx.ended = true;
    finalResults = buildResults(standings.order, finalTimes(ctx, standings.order, timedOut));
    saveStats(app, ctx, finalResults);
    bus.emit('race:end', { results: finalResults });
  };
  const flow = createFlow(ctx, end);

  /** First step: the rig, HUD and audio are attached by now, so the intro can begin. */
  const begin = (): void => {
    started = true;
    bus.emit('race:intro', { trackId: session.track.id, duration: session.phase === 'intro' ? INTRO_TIME : 0 });
    if (session.phase === 'intro') intro = startIntroCamera(ctx, flow, () => !disposed);
  };

  const undebug = exposeRaceDebug({
    skipIntro: () => flow.skipIntro(),
    introFocus: () => intro?.focus() ?? null,
    results: () => finalResults ?? buildResults(standings.order),
    ai: () => session.riders.map((r) => ai.brain(r.id)?.summary() ?? { id: r.id }),
    traffic: () => traffic?.summary() ?? [],
    police: () => police?.summary() ?? null,
    setHeat: (v) => { if (police) police.setHeat(v); else session.player.heat = v; },
    brake: (id, seconds) => { const b = ai.brain(id); if (b) b.holdBrake = seconds; },
    clock: () => ctx.clock,
    spectate: createSpectator(session),
  });

  return {
    preStep(dt) {
      if (!started) begin();
      flow.preStep(dt);
      traffic?.preStep(dt);
      police?.preStep(dt);
      rivals.preStep(dt);
      events.preStep(dt);
      ai.preStep(dt, flow.countdownTime);
    },
    postStep(dt) {
      if (!ctx.ended) standings.update(dt);
      else standings.rollOutLate();
      flow.postStep(dt);
      traffic?.sync();
      police?.sync();
      rivals.postStep(dt);
      events.postStep(dt);
    },
    results: () => finalResults ?? buildResults(standings.order),
    // r6 (SPEC §28): a human left the room — an AI rides its rider from this tick on.
    takeover: (id) => ai.takeover(id),
    dispose() {
      disposed = true;
      flow.dispose();
      ai.dispose();
      traffic?.dispose();
      police?.dispose();
      rivals.dispose();
      events.dispose();
      undebug();
    },
  };
}
