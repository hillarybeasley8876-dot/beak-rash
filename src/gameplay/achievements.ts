// Achievements: rules (achievements/rules-*.ts) watch bus events during a race and unlock ids from
// data/achievements.ts. An unlock is saved once (app.save achievements, no duplicates) and announced
// with `achievement:unlock`. Only an attached, human-driven race can unlock anything: attract/autopilot
// races, quits and restarts never do (rules only fire from that race's own events).
import type { AppContext, Session } from '../core/contracts';
import type { AchievementId } from '../data/achievements';
import { makeRuleCtx, newFacts, type RaceFacts } from './achievements/facts';
import { careerRules } from './achievements/rules-career';
import { combatRules } from './achievements/rules-combat';
import { eggRules } from './achievements/rules-eggs';
import { policeRules } from './achievements/rules-police';
import { raceRules } from './achievements/rules-race';
import { rivalRules } from './achievements/rules-rivals';
import { rideRules } from './achievements/rules-ride';
import { trickRules } from './achievements/rules-tricks';

export interface AchievementSystem {
  /** Track a race (game.ts calls this next to ui.attach); null when the race is over or quit. */
  attach(session: Session | null): void;
  /** Ids unlocked during the current / most recent race, in unlock order. */
  fresh(): readonly AchievementId[];
  dispose(): void;
}

interface AchDebug {
  fresh(): readonly AchievementId[];
  facts(): Record<string, unknown> | null;
  /** Let autopilot races unlock (tests only). */
  allowAutopilot(on: boolean): void;
  /** Remove every unlocked achievement from the save (tests only). */
  forget(): void;
}

export function createAchievements(app: AppContext): AchievementSystem {
  let offs: Array<() => void> = [];
  let current: Session | null = null;
  let facts: RaceFacts | null = null;
  let fresh: AchievementId[] = [];
  let autopilotOk = false;

  const unlock = (session: Session, id: AchievementId): void => {
    if (session !== current || app.save.data.achievements.includes(id)) return;
    app.save.update((d) => {
      if (!d.achievements.includes(id)) d.achievements.push(id);
    });
    fresh.push(id);
    app.bus.emit('achievement:unlock', { id });
  };

  const detach = (): void => {
    for (const off of offs) off();
    offs = [];
    current = null;
    facts = null;
  };

  const attach = (session: Session | null): void => {
    detach();
    exposeDebug(debugApi);
    if (!session) return;
    fresh = [];
    if (session.config.autopilot && !autopilotOk) return;
    current = session;
    facts = newFacts();
    const ctx = makeRuleCtx(app, session, facts, (id) => unlock(session, id));
    offs = [
      ...raceRules(ctx), ...rideRules(ctx), ...combatRules(ctx), ...careerRules(ctx),
      ...trickRules(ctx), ...policeRules(ctx), ...rivalRules(ctx), ...eggRules(ctx),
    ];
    // Registered last, so it runs after the rules' own race:end handlers: once results are final the
    // race can no longer earn anything (teardown events such as the police leaving are not "real").
    offs.push(app.bus.on('race:end', () => {
      for (const off of offs) off();
      offs = [];
    }));
  };

  const debugApi: AchDebug = {
    fresh: () => fresh,
    facts: () => (facts ? snapshot(facts) : null),
    allowAutopilot: (on) => { autopilotOk = on; },
    forget: () => app.save.update((d) => { d.achievements = []; }),
  };

  return {
    attach,
    fresh: () => fresh,
    dispose: () => {
      detach();
      hideDebug(debugApi);
    },
  };
}

function snapshot(f: RaceFacts): Record<string, unknown> {
  return {
    ...f,
    koSpecies: [...f.koSpecies],
    wing: { active: f.wing.active, hits: [...f.wing.hits] },
    ult: { ...f.ult, victims: [...f.ult.victims] },
    robbedBy: Object.fromEntries(f.robbedBy),
  };
}

type WithAch = { ach?: AchDebug };

function exposeDebug(api: AchDebug): void {
  const br = typeof window === 'undefined' ? undefined : (window.__br as (WithAch & object) | undefined);
  if (br) br.ach = api;
}

function hideDebug(api: AchDebug): void {
  const br = typeof window === 'undefined' ? undefined : (window.__br as (WithAch & object) | undefined);
  if (br && br.ach === api) delete br.ach;
}
