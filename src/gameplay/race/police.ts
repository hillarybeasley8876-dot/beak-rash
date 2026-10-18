// Police: when the player's heat passes 0.5 the corgi officer sprints in from behind (siren, whistle),
// rides alongside, and BUSTS you if you stay slow (or crash yourself) next to it for 2 s: fine 100 and a
// 4 s stop served on the road (so crossing order = final order). Counterplay: it cruises just under
// your top speed, tires after riding alongside for a while, gets stuck behind traffic and can be
// knocked back. The chase stays on screen: once it trails you (behind the camera for 2 s) it sprints back once with
// a line, and the next time it trails it gives up (escape toast). A real lead (25 m from its closest
// approach, then 38 m for 2 s, or 15 m with the heat cooled) also loses it; a chase ends after 25 s
// (escape when you ride ahead of it, else a let-go with its own toast). No escape in the first 8 s.
import { Quaternion, Vector3 } from 'three';
import { clamp } from '../../core/math';
import { createRiderState } from '../../core/rider';
import { POLICE_LINES, ROSTER } from '../../data/roster';
import { WEAPONS } from '../../data/weapons';
import type { CrashCause, Obstacle } from '../../core/types';
import { topOf } from './ai/control';
import type { RaceCtx } from './ctx';
import { createCorgi, knock, resetCorgi, resprint, ride, sprinting, tire, tired, WALK_BACK, type RideWorld } from './police-chase';
import { createHeat } from './police-heat';
import { PoliceView } from './police-view';
import { trackPose } from './pose';

const SPAWN_HEAT = 0.5;
const SPAWN_BEHIND = 20;      // m: out of the chase camera, close enough to arrive in ~3 s
const SPAWN_BEFORE = 0.9;     // no new chase in the last 10 % of the track
const SLOW = 8;               // m/s: slower than this next to the corgi counts toward BUSTED
const BUST_TIME = 2;
const FINE = 100, PENALTY = 4; // the penalty is the ticket stop itself
const WHISTLE_CD = 9;
const COOLDOWN = 20;
const LOSE_GAP = 38, LOSE_TIME = 2;
const LEAD_BUILT = 25;        // m the player must pull away from the corgi's closest approach to escape
const MIN_CHASE = 8;          // s: no escape before the chase has really begun
const REACHED = 6;            // m: the corgi has caught up with the player this chase
const CALM_HEAT = 0.3, CALM_GAP = 15;
const LET_GO_HEAT = 0.12;     // a model citizen alongside: the corgi lets it go (no 'lost' credit)
const TRAIL_GAP = 4.5, TRAIL_TIME = 2; // behind the chase camera for this long: re-sprint once, then give up
const CHASE_MAX = 25;         // s: the chase ends (escape, or a let-go when still beside the player)
const SIDE_CLEAR = 1.2;       // m clearance from other riders at the spot beside the player
const LET_GO_LINES = ['算了，下不为例。', '今天心情好，放你一马。', '下次再让我看见……就算了。'];
const KNOCK_HEAT = 0.05;      // knocking the officer about is an offence too
const WING_TIME = 2.2;        // pelican.wing duration (SPEC §7)

type Mode = 'off' | 'chase' | 'ticket' | 'leaving';
type Reason = 'spawn' | 'lost' | 'busted';

export interface Police {
  preStep(dt: number): void;
  /** Debug/tests: force the player's heat (counts as a fresh offence). */
  setHeat(v: number): void;
  sync(): void;
  summary(): Record<string, unknown> | null;
  dispose(): void;
}

export function createPolice(ctx: RaceCtx): Police {
  const { session } = ctx;
  const { app, track } = session;
  const player = session.player;
  const rng = session.rng.fork(0xc0601);
  const heat = createHeat(session);
  const st = createRiderState(99, 'corgi', 'mtb', false);
  st.name = ROSTER.corgi.name;
  st.mode = 'racing';
  const corgi = createCorgi(st);
  const rideWorld: RideWorld = { track, obstacles: session.obstacles, riders: session.riders, playerTop: topOf(player), playerSpeed: 0 };
  const ob: Obstacle = { id: 900, kind: 'police', s: 0, x: 0, speed: 0, halfWidth: 0.45, halfLength: 0.9, height: 1.6, solid: false, active: false };
  let view: PoliceView | null = null;
  let mode: Mode = 'off';
  let side: 1 | -1 = 1;
  let modeT = 0, bustT = 0, lostT = 0, whistleCd = 0, cooldown = 0, alertLevel = 0, simAcc = 0, lastReal = app.clock.realTime;
  let wingT = 0;                              // s left of the player's Wing Dash
  let minGap = Infinity;                      // closest approach (player.s − corgi.s) this chase
  let trailT = 0;                             // s trailing more than TRAIL_GAP behind the player
  let resprinted = false;                     // the one re-sprint of this chase is used
  let spoke = false;                          // the chase line (first time alongside) is said
  let selfCrash = false;                      // the player's current crash was their own doing
  const pos = new Vector3(), quat = new Quaternion();

  // Corgi speech (content's POLICE_LINES) stays in toasts, only for the arrival, the fine and an escape
  // (no world-anchored bubble for non-riders yet).
  const say = (text: string): void => app.ui.toast(`${ROSTER.corgi.name}：${text}`, 'warn');
  const alert = (level: number, reason?: Reason): void => {
    if (level === alertLevel) return;
    alertLevel = level;
    app.bus.emit('police:alert', reason ? { riderId: player.id, level, reason } : { riderId: player.id, level });
  };
  const setMode = (m: Mode): void => { mode = m; modeT = 0; };

  const spawn = (): void => {
    setMode('chase');
    resetCorgi(corgi);
    st.s = Math.max(5, player.s - SPAWN_BEHIND);
    st.x = clamp(player.x, -4, 4);
    st.speed = Math.max(player.speed + 4, 12);
    st.vx = 0;
    bustT = lostT = trailT = 0;
    resprinted = spoke = false;
    minGap = player.s - st.s;
    whistleCd = 2.5;
    rideWorld.playerTop = topOf(player);
    view ??= new PoliceView(app, session.world);
    view.visible = true;
    ob.active = true;
    if (!session.obstacles.includes(ob)) session.obstacles.push(ob);
    alert(1, 'spawn');
    say(rng.pick(POLICE_LINES.alert));
  };

  const despawn = (): void => {
    setMode('off');
    if (view) view.visible = false;
    ob.active = false;
    const i = session.obstacles.indexOf(ob);
    if (i >= 0) session.obstacles.splice(i, 1);
    cooldown = COOLDOWN;
    alert(0);
  };

  /** The chase ends: an escape ('lost' alert + toast) or a let-go (its own toast and toot, no escape credit). */
  const giveUp = (escaped: boolean): void => {
    setMode('leaving');
    player.heat = Math.min(player.heat, CALM_HEAT);
    alert(0, escaped ? 'lost' : undefined);
    if (escaped) app.ui.toast(`甩掉了柯基警官！  “${rng.pick(POLICE_LINES.lost)}”`, 'meme');
    else if (player.finishTime === null) {
      say(rng.pick(LET_GO_LINES));
      app.audio.sfx('traffic.horn.police');
    }
  };

  const bust = (): void => {
    app.bus.emit('police:busted', { riderId: player.id, fine: FINE });
    player.coins -= FINE;
    ctx.bustedCount.set(player.id, (ctx.bustedCount.get(player.id) ?? 0) + 1);
    player.heat = 0;
    if (player.mode === 'racing') { player.mode = 'busted'; player.modeTime = 0; }
    setMode('ticket');
    alert(0, 'busted');
    say(`${rng.pick(POLICE_LINES.busted)}  罚 ${FINE} 小鱼干，靠边 ${PENALTY} 秒`);
  };

  const whistle = (): void => {
    whistleCd = WHISTLE_CD;
    app.audio.sfx('police.whistle');
    const slow = player.statuses.find((s) => s.id === 'slow');
    if (slow) slow.time = Math.max(slow.time, 1);
    else player.statuses.push({ id: 'slow', time: 1, strength: 0.15, source: null });
  };

  /** A player swing (side = null: either side) or Wing Dash ram reaching the corgi knocks it back. */
  const tryKnock = (reach: number, sideSign: number | null, sfx: string): void => {
    if (mode !== 'chase' || corgi.knockT > 0) return;
    const ds = st.s - player.s, dx = st.x - player.x;
    if (Math.abs(ds) > 1.6 || Math.abs(dx) > reach || (sideSign !== null && Math.sign(dx) !== sideSign)) return;
    knock(corgi, Math.sign(dx) || 1);
    heat.offence(KNOCK_HEAT);
    app.audio.sfx(sfx);
  };
  const offs = [
    app.bus.on('combat:swing', (e) => {
      if (e.riderId === player.id) tryKnock(WEAPONS[e.weapon].reach, e.heavy ? null : e.side, `hit.${e.weapon}`);
    }),
    app.bus.on('skill:cast', (e) => { if (e.riderId === player.id && e.skillId === 'pelican.wing') wingT = WING_TIME; }),
    app.bus.on('rider:crash', (e) => { if (e.riderId === player.id) selfCrash = isSelfCrash(e.cause, e.attacker); }),
  ];

  /** Is the spot beside the player at lateral `x` taken by another rider? */
  const taken = (x: number): boolean => session.riders.some((r) => !r.isPlayer && (r.mode === 'racing' || r.mode === 'finished')
    && Math.abs(r.s - player.s) < 2.5 && Math.abs(r.x - x) < SIDE_CLEAR);

  /** Side of the player to ride on: off the road → the other side; taken by a rival → the other side if it is free. */
  const chooseSide = (gap: number): void => {
    if (Math.abs(gap) > 14) side = st.x <= player.x ? -1 : 1;
    const hw = track.bounds(player.s).halfWidth;
    const here = player.x + side * 1.7, there = player.x - side * 1.7;
    const offRoad = (x: number): boolean => Math.abs(x) > hw - 0.6;
    if (offRoad(here) || (taken(here) && !offRoad(there) && !taken(there))) side = side === 1 ? -1 : 1;
  };

  /** Trailing behind the camera: one more sprint back (with a line), then the corgi gives up. */
  const trail = (dt: number, gap: number): boolean => {
    trailT = gap > TRAIL_GAP && !sprinting(corgi) ? trailT + dt : 0;
    if (trailT < TRAIL_TIME) return false;
    trailT = 0;
    if (resprinted || tired(corgi)) return true;
    resprinted = true;
    resprint(corgi);
    say(rng.pick(POLICE_LINES.chase));
    return false;
  };

  const chase = (dt: number): void => {
    const gap = player.s - st.s;
    const down = player.mode === 'crashed' || player.mode === 'respawning';
    // Only crashes the player caused count; a rival's KO (and its respawn grace) is not an offence.
    const excused = !selfCrash && (down || player.invuln > 0);
    const want = gap < -3 && player.speed < 3 ? -WALK_BACK
      : gap < 6 ? player.speed + gap * 1.5 : player.speed + clamp(gap * 0.7, -5, 9);
    chooseSide(gap);
    rideWorld.playerSpeed = player.speed;
    ride(corgi, rideWorld, dt, want, Math.abs(gap) < 14 ? player.x + side * 1.7 : player.x, 5.5);
    const alongside = Math.abs(gap) < 4 && Math.abs(player.x - st.x) < 3.4;
    tire(corgi, dt, gap);
    if (alongside && !spoke) { spoke = true; say(rng.pick(POLICE_LINES.chase)); }
    const offending = !excused && (down || player.speed < SLOW);
    bustT = alongside && offending ? bustT + dt : Math.max(0, bustT - dt * 0.6);
    if (bustT >= BUST_TIME) { bust(); return; }
    whistleCd -= dt;
    if (gap > -1 && gap < 12 && whistleCd <= 0 && !tired(corgi) && player.mode === 'racing') whistle();
    minGap = Math.min(minGap, Math.max(0, gap));
    // Escaping needs a lead built during the chase (never just a corgi that has not arrived yet): 25 m
    // pulled from its closest approach and 38 m held for 2 s, or a calm lead of 15 m after it rode alongside.
    const settled = modeT > MIN_CHASE;
    lostT = settled && gap - minGap > LEAD_BUILT && gap > LOSE_GAP ? lostT + dt : Math.max(0, lostT - dt);
    const calmEscape = settled && minGap < REACHED && gap > CALM_GAP && player.heat < CALM_HEAT;
    if (lostT > LOSE_TIME || calmEscape || (trail(dt, gap) && settled)) { giveUp(true); return; }
    if (player.finishTime !== null) { giveUp(false); return; }
    // Out of time: an escape when the player rides ahead of it, a let-go when it is still beside a slow player;
    // a cooled-down player is let go unless the corgi is already trailing.
    if (modeT > CHASE_MAX) { giveUp(gap > 2 && player.speed >= SLOW); return; }
    if (player.heat < LET_GO_HEAT && modeT > 20) { giveUp(gap > TRAIL_GAP); return; }
    alert(alongside || gap < 20 ? 2 : 1);
  };

  /** The ticket stop is the time penalty: the player is held (also after a respawn) for PENALTY s. */
  const ticket = (dt: number): void => {
    ride(corgi, rideWorld, dt, 0, player.x + side * 1.5, 5);
    const holding = modeT < PENALTY;
    if (holding && player.mode === 'racing') { player.mode = 'busted'; player.modeTime = 0; }
    if (player.mode === 'busted') { player.speed = 0; player.vx = 0; }
    if (holding) return;
    if (player.mode === 'busted') { player.mode = 'racing'; player.modeTime = 0; player.invuln = Math.max(player.invuln, 1); }
    setMode('leaving');
  };

  const leave = (dt: number): void => {
    const hw = track.bounds(st.s).halfWidth;
    ride(corgi, rideWorld, dt, Math.max(0, st.speed - 6 * dt), side * (hw - 0.8), 3);
    if (player.s - st.s > 45 || st.s - player.s > 120 || modeT > 25) despawn();
  };

  return {
    setHeat: (v) => heat.set(v),
    preStep(dt) {
      simAcc += dt;
      cooldown -= dt;
      modeT += dt;
      if (wingT > 0) { wingT -= dt; tryKnock(1.4, null, 'hit.none'); }
      if (mode === 'chase') chase(dt);
      else if (mode === 'ticket') ticket(dt);
      else if (mode === 'leaving') leave(dt);
      heat.update(dt, mode === 'chase' ? player.s - st.s : null);
      const canSpawn = session.config.police && session.phase === 'racing' && player.mode === 'racing'
        && player.s < track.length * SPAWN_BEFORE;
      if (mode === 'off' && cooldown <= 0 && canSpawn && player.heat > SPAWN_HEAT) spawn();
      ob.s = st.s; ob.x = st.x; ob.speed = st.speed;
    },
    sync() {
      const real = app.clock.realTime;
      if (!view || mode === 'off') { simAcc = 0; lastReal = real; return; }
      trackPose(track, st.s, st.x, 0, st.yaw, st.lean, pos, quat);
      view.update(st, pos, quat, simAcc, Math.max(0, real - lastReal), mode !== 'leaving');
      simAcc = 0;
      lastReal = real;
    },
    summary: () => ({
      mode, s: +st.s.toFixed(1), x: +st.x.toFixed(2), v: +st.speed.toFixed(1), gap: +(player.s - st.s).toFixed(1),
      heat: +player.heat.toFixed(2), bustT: +bustT.toFixed(2), cooldown: +Math.max(0, cooldown).toFixed(1),
      tired: tired(corgi), knocked: corgi.knockT > 0, closeT: +corgi.closeT.toFixed(1),
      minGap: Number.isFinite(minGap) ? +minGap.toFixed(1) : null, chaseT: +corgi.chaseT.toFixed(1),
      trailT: +trailT.toFixed(1), resprinted,
    }),
    dispose() {
      for (const off of offs) off();
      heat.dispose();
      if (mode !== 'off') alert(0);
      const i = session.obstacles.indexOf(ob);
      if (i >= 0) session.obstacles.splice(i, 1);
      view?.dispose();
    },
  };
}

/** Crashes the player caused (traffic, walls, water, props) — not KOs or skill hits by rivals. */
const isSelfCrash = (cause: CrashCause, attacker: number | null): boolean =>
  attacker === null && cause !== 'ko' && cause !== 'skill';
