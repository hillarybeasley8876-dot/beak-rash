// The fight (SPEC §14): the officer's baton and the player's answer to it. At ★2+ the corgi
// winds up behind the player and swings; the player can swerve away, hop over it or brake out
// of reach. A player swing or a thrown weapon that reaches the officer hurts it (60 HP); at 0 it
// goes down, tumbles and clocks off.
import type { AppContext, Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderId, RiderState, Vec3Like, WeaponId } from '../../../core/types';
import { CORGI_LINES } from '../../../data/police-lines';
import { WEAPONS } from '../../../data/weapons';
import { knock, tired } from '../police-chase';
import { cooldownTime, startWindup, stepBaton, windupTime } from './baton';
import type { PoliceCorgi } from './corgi';
import { CHASE, T } from './tuning';
import type { Wanted } from './wanted';

export interface FightCtx {
  app: AppContext;
  session: Session;
  player: RiderState;
  wanted: Wanted;
  rng: Rng;
  /** Sim time (s) of the current frame. */
  now: number;
  /** Shared between the officers: two of them never wind up within T.windupGap of each other. */
  state: { lastWindup: number; why?: string };
  /** Where an officer is in the world (its chest). */
  pos(c: PoliceCorgi): Vec3Like;
  /** A line from an officer (rate limited per officer). */
  say(c: PoliceCorgi, text: string): void;
  /** An officer was knocked out: the chase may call a backup. */
  onDown(c: PoliceCorgi): void;
  /** An offence the police counts (the heat it adds). */
  heat(v: number): void;
  /** Every officer on the road. */
  officers(): PoliceCorgi[];
  /** Is the chase running? */
  chasing(): boolean;
}

/** The damage a player swing does to an officer. */
export function swingDamage(weapon: WeaponId, heavy: boolean): number {
  const base = WEAPONS[weapon]?.damage ?? 0;
  return Math.round(base * (heavy ? 1.5 : 1));
}

/** The officer winds up: the tell, the lunge and the pose the actors view plays. */
function beginWindup(ctx: FightCtx, c: PoliceCorgi): void {
  const side = c.st.x >= ctx.player.x ? 1 : -1;
  const time = windupTime(ctx.wanted.level);
  c.lunge = Math.max(c.st.speed, ctx.player.speed) + T.lunge;
  startWindup(c.st, c.baton, side, time);
  ctx.state.lastWindup = ctx.now;
  ctx.app.bus.emit('police:windup', { riderId: ctx.player.id, obstacleId: c.id, side, pos: ctx.pos(c), time });
  ctx.say(c, ctx.rng.pick(CORGI_LINES.windup));
}

/** The swing: it always swings, it only connects if the player is still in the box. */
function swing(ctx: FightCtx, c: PoliceCorgi): void {
  const { player } = ctx;
  const ds = player.s - c.st.s;              // > 0 = the player is ahead of the officer
  const lat = Math.abs(c.st.x - player.x);
  const hit = ds <= T.hitDs && ds >= -T.hitBehind && lat <= T.hitLateral
    && player.y < T.hitHeight && player.mode === 'racing';
  const level = ctx.wanted.level;
  const pos = ctx.pos(c);
  ctx.app.bus.emit('police:swing', { riderId: player.id, obstacleId: c.id, side: c.baton.side, pos, hit });
  if (hit) {
    ctx.app.bus.emit('npc:strike', {
      victim: player.id, obstacleId: c.id, damage: level >= 3 ? T.damageW3 : T.damage, knock: T.knock,
      side: c.baton.side, heavy: level >= 3, weapon: 'baton', pos, cause: 'police',
    });
    ctx.say(c, ctx.rng.pick(CORGI_LINES.strike));
  }
  c.baton.cooldown = cooldownTime(level);
  c.baton.strikeT = 0;
}

/** May this officer start a wind-up right now? (the reason it did not is kept for the debug summary) */
function canWindup(ctx: FightCtx, c: PoliceCorgi): boolean {
  const no = (why: string): boolean => { ctx.state.why = why; return false; };
  if (ctx.wanted.level < 2) return no('level');
  if (c.baton.cooldown > 0 || c.baton.windup > 0) return no('cooldown');
  if (c.down || c.leaving) return no('gone');
  if (tired(c.ride) || c.ride.knockT > 0) return no('tired');
  if (ctx.player.mode !== 'racing') return no('player');
  if (ctx.now - ctx.state.lastWindup < T.windupGap) return no('gap');
  const ds = ctx.player.s - c.st.s;
  if (ds < -T.hitBehind * 0.5 || ds > T.reachDs) return no('ds');   // it strikes from beside or behind
  const lat = Math.abs(c.st.x - ctx.player.x);
  if (lat < T.lateralMin || lat > T.lateralMax) return no('lat');
  ctx.state.why = 'ok';
  return true;
}

/** Drive one officer: the baton timer, the wind-up and the strike. */
export function stepOfficer(ctx: FightCtx, c: PoliceCorgi, dt: number): void {
  const winding = c.baton.windup > 0;
  stepBaton(c.st, c.baton, dt);
  if (winding && c.baton.windup <= 0) {
    swing(ctx, c);
    return;
  }
  if (c.baton.windup > 0) return;
  if (canWindup(ctx, c)) beginWindup(ctx, c);
}

/** A player swing or a thrown weapon that reaches the officer. */
export function hurtOfficer(ctx: FightCtx, c: PoliceCorgi, damage: number, attacker: RiderId): void {
  c.hp = Math.max(0, c.hp - damage);
  knock(c.ride, Math.sign(c.st.x - ctx.player.x) || 1);
  ctx.app.bus.emit('police:hurt', { obstacleId: c.id, attacker, damage, hp: c.hp, pos: ctx.pos(c) });
  if (c.hp <= 0) knockDown(ctx, c, attacker);
}

/** The officer is out of HP: it tumbles, clocks off and the stars go up. */
export function knockDown(ctx: FightCtx, c: PoliceCorgi, attacker: RiderId): void {
  if (c.down) return;
  c.down = true;
  c.downT = 0;
  c.st.mode = 'crashed';
  c.st.crash = {
    cause: 'ko', attacker: null, origin: ctx.pos(c),
    vel: { x: 0, y: 3.2, z: 0 }, spin: { x: 0, y: 5, z: 0 },
  };
  ctx.app.bus.emit('police:down', { obstacleId: c.id, attacker, pos: ctx.pos(c) });
  ctx.wanted.bump(3);
  ctx.onDown(c);
}

/** A player swing (side = null: either side) or Wing Dash ram (weapon 'none') reaching an officer knocks it
 *  back and hurts it. */
export function tryKnock(ctx: FightCtx, reach: number, sideSign: number | null, weapon: WeaponId, heavy: boolean): void {
  if (!ctx.chasing()) return;
  const damage = swingDamage(weapon, heavy);
  for (const c of ctx.officers()) {
    if (!c.active || c.down || c.leaving || c.ride.knockT > 0) continue;
    const ds = c.st.s - ctx.player.s, dx = c.st.x - ctx.player.x;
    if (Math.abs(ds) > 1.6 || Math.abs(dx) > reach || (sideSign !== null && Math.sign(dx) !== sideSign)) continue;
    knock(c.ride, Math.sign(dx) || 1);
    ctx.heat(CHASE.knockHeat);
    ctx.wanted.knock();
    ctx.app.bus.emit('police:knock', { riderId: ctx.player.id, weapon, pos: ctx.pos(c) });
    if (damage > 0) hurtOfficer(ctx, c, damage, ctx.player.id);
  }
}

/** Listen for the player's swings, thrown weapons and rival KOs that reach an officer. */
export function listenFight(ctx: FightCtx): () => void {
  const offs = [
    ctx.app.bus.on('combat:swing', (e) => {
      if (e.riderId === ctx.player.id) tryKnock(ctx, WEAPONS[e.weapon].reach, e.heavy ? null : e.side, e.weapon, e.heavy);
    }),
    ctx.app.bus.on('combat:obstacleHit', (e) => {
      const c = ctx.officers().find((x) => x.id === e.obstacleId);
      if (!c || !c.active || c.down) return;
      ctx.heat(T.thrownHit);
      ctx.wanted.knock();
      hurtOfficer(ctx, c, e.damage, e.attacker);
    }),
    ctx.app.bus.on('rider:obstacleHit', (e) => {
      if (e.riderId !== ctx.player.id || e.kind === 'police') return;
      for (const c of ctx.officers()) {
        if (!c.active) continue;
        if (Math.abs(ctx.player.s - c.st.s) > T.trafficRadius) continue;
        ctx.heat(T.trafficHit);   // smashing into traffic right next to an officer annoys it
        break;
      }
    }),
    ctx.app.bus.on('combat:ko', (e) => {
      if (e.attacker !== ctx.player.id || !ctx.chasing()) return;
      const victim = ctx.session.rider(e.victim);
      if (!victim) return;
      for (const c of ctx.officers()) {
        if (!c.active) continue;
        if (Math.hypot(victim.s - c.st.s, victim.x - c.st.x) > T.koRadius) continue;
        ctx.heat(T.rivalKo);
        ctx.wanted.bump(2);
        break;
      }
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
