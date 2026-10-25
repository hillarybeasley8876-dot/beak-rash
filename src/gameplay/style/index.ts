// STYLE chains (SPEC §17): the player's actions chain into a multiplier, and a chain banks its points when it
// times out (3 s without an action), breaks (a hit taken, a crash) or the race ends. Player only: every event
// of another rider is ignored.
import type { AppContext, Session } from '../../core/contracts';
import type { RiderId } from '../../core/types';
import type { SessionModuleLike } from '../session-module';
import { driftAction, fixedAction, hitAction, trickAction, type StyleAction } from './actions';
import { StyleChain } from './chain';
import { CHAIN_WINDOW, COINS_PER_POINT, SP_CAP, SP_PER_POINT } from './tuning';

export function createStyle(app: AppContext): SessionModuleLike {
  const chain = new StyleChain();
  let session: Session | null = null;
  let offs: Array<() => void> = [];
  let best = 0;            // best banked total of this race
  let lastAt = -Infinity;  // sim time of the last scored action

  const isPlayer = (id: RiderId | null): boolean =>
    session !== null && id !== null && id === session.player.id;

  /** Bank the chain: its points go to the race's best and to the save. */
  const bank = (broken: boolean): void => {
    if (!session || !chain.active) return;
    const total = Math.round(chain.total * chain.multiplier);
    const count = chain.actions;
    chain.reset();
    if (total > best) best = total;
    if (total > app.save.data.stats.bestStyle) app.save.update((d) => { d.stats.bestStyle = total; });
    app.bus.emit('style:bank', {
      riderId: session.player.id, total, count,
      sp: Math.min(SP_CAP, Math.floor(total / SP_PER_POINT)),
      coins: Math.floor(total / COINS_PER_POINT), broken,
    });
  };

  /** Score an action: it extends the chain, or starts a new one once the old one banked. */
  const score = (action: StyleAction): void => {
    if (!session) return;
    const now = session.time;
    if (chain.active && now - lastAt > CHAIN_WINDOW) bank(false);
    const points = chain.push(action.kind, action.points);
    lastAt = now;
    app.bus.emit('style:chain', {
      riderId: session.player.id, action: action.kind, label: action.label,
      points, total: chain.total, mult: chain.multiplier, count: chain.actions,
    });
  };

  /** The 3 s timeout: without an action the chain banks. */
  const checkTimeout = (): void => {
    if (!session || !chain.active) return;
    if (session.time - lastAt > CHAIN_WINDOW) bank(false);
  };

  const listen = (): Array<() => void> => {
    const bus = app.bus;
    return [
      bus.on('rider:boost', (e) => {
        if (!isPlayer(e.riderId)) return;
        if (e.kind === 'drift') score(driftAction(e.power));
        else if (e.kind === 'draft') score(fixedAction('slingshot'));
      }),
      bus.on('rider:nearMiss', (e) => { if (isPlayer(e.riderId)) score(fixedAction('nearMiss')); }),
      bus.on('rider:land', (e) => { if (isPlayer(e.riderId) && e.perfect) score(fixedAction('perfect')); }),
      bus.on('rider:trick', (e) => {
        if (!isPlayer(e.riderId) || e.phase !== 'land') return;
        const action = trickAction(e.points);
        if (action) score(action);
      }),
      bus.on('combat:hit', (e) => {
        if (!session || e.blocked) return;   // a blocked hit neither scores nor breaks the chain
        if (e.victim === session.player.id) { bank(true); return; }
        if (e.attacker === session.player.id) score(hitAction(e.heavy, e.weapon, session.player.weapon));
      }),
      bus.on('npc:hit', (e) => { if (isPlayer(e.victim) && e.damage > 0) bank(true); }),
      bus.on('combat:ko', (e) => { if (isPlayer(e.attacker)) score(fixedAction('ko')); }),
      bus.on('combat:parry', (e) => { if (isPlayer(e.riderId)) score(fixedAction('parry')); }),
      bus.on('combat:weaponPick', (e) => {
        if (isPlayer(e.riderId) && e.stolenFrom !== null) score(fixedAction('steal'));
      }),
      bus.on('police:swing', (e) => { if (isPlayer(e.riderId) && !e.hit) score(fixedAction('batonDodge')); }),
      bus.on('rider:crash', (e) => { if (isPlayer(e.riderId)) bank(true); }),
      bus.on('race:end', (e) => {
        bank(false);   // a chain that is still open when the race ends still counts
        const me = e.results.find((r) => r.isPlayer);
        if (me && best > 0) me.styleBest = best;
      }),
    ];
  };

  const detach = (): void => {
    for (const off of offs) off();
    offs = [];
    chain.reset();
    session = null;
  };

  const attach = (next: Session | null): void => {
    detach();
    if (!next) return;
    session = next;
    best = 0;
    lastAt = -Infinity;
    offs = listen();
  };

  // core calls update() once per frame after the session stepped: one compare, no allocation.
  return { attach, update: checkTimeout, dispose: detach };
}
