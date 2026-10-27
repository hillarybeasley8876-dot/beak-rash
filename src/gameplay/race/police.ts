// Police: when the player's heat passes 0.5 the corgi officer sprints in from behind (siren, whistle),
// rides alongside, and BUSTS you if you stay next to it for 2 s while slow (below 60 % of your top speed),
// wrecked or respawning (SPEC §9 'slow or crashed', whoever wrecked you): fine 100 and a 4 s stop served on the
// road (so crossing order = final order). Counterplay: it cruises just under your top speed, tires after riding
// alongside for a while, gets stuck behind traffic and can be knocked back. The chase stays on screen: once it
// trails you (behind the camera for 2 s) it sprints back once with a line, and the next time it trails it gives
// up (left far behind before it ever arrived, it first takes one out-of-sight shortcut back). Only a real lead is
// an escape ('lost' + toast): 60 m held for 2 s, built from its closest approach; every other end (stuck or trailing
// out of sight, a cooled heat, the 25 s cap) is a let-go with its own line and toot. No escape in the first 8 s.
// Police 2.0 (SPEC §14): the wanted stars (★0..3) drive the rest — at ★2 the officer arms its baton and swings,
// at ★3 a second corgi (901) joins in and a roadblock goes up ahead, the officer can be fought back (60 HP) and the
// player can buy the officer off with 「V我50」. The corgi's lines, whistle, knocks and toot are bus events
// (npc:say / police:*): ui-hud and audio place them.
// Police 2.0 r6 (SPEC §25 薄纱警察): the police can be beaten. The officer stays in reach of the player's swings
// (it tails the player at ★2+ and a hit only nudges it aside), the skills reach it, going down pays a bounty and
// drops its baton, three officers down call the 特警 squad, and the whole squad down means 警局下班: no police for
// the rest of the race.
import { Quaternion, Vector3 } from 'three';
import { clamp } from '../../core/math';
import { POLICE_LINES } from '../../data/roster';
import type { Vec3Like } from '../../core/types';
import { topOf } from './ai/control';
import type { RaceCtx } from './ctx';
import { ride, tired, type RideWorld } from './police-chase';
import { createHeat } from './police-heat';
import { trackPose } from './pose';
import { createCorgiUnit, disposeCorgiUnit, liftCorgi, placeCorgi, type PoliceCorgi } from './police/corgi';
import { takeBribe } from './police/bribe';
import { createField, type Field } from './police/field';
import { listenFight, tryKnock, type FightCtx } from './police/fight';
import { inTunnel } from './police/roadblock';
import { createPayoff, type Payoff } from './police/payoff';
import { rideOfficer, trail, type OfficerRide, type TrailCtx } from './police/ride';
import { chooseSide } from './police/side';
import { listenSkills, WING_DAMAGE } from './police/skills';
import { createSquad, type Squad } from './police/squad';
import { CHASE, FIGHT, LET_GO_LINES, T } from './police/tuning';
import { createWanted } from './police/wanted';
import { buildPoliceWarmKit } from './police/warm';

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
  const wanted = createWanted();
  // Both officers are built (hidden) with the race, so core's warm-up compiles them behind the loading
  // screen; a spawn only places and shows one.
  const primary = createCorgiUnit(app, session.world, 900, 99);
  // The roadblock goes up in the middle of a chase: its stand-ins go up with the race, so the block never
  // compiles a shader program in front of the player.
  const warm = buildPoliceWarmKit();
  session.world.add(warm.group);
  const field: Field = createField({
    app, session, player, wanted, rng,
    officers: () => officers(),
    lead: () => primary,
    say: (c, text) => say(c, text),
    at: (c) => at(c),
  });
  const corgis = [primary, field.backup];
  // The 特警 squad (r6): three corgis with riot shields, built with the race and hidden until they are called.
  const squad: Squad = createSquad({
    app, session, player, rng,
    say: (c, text) => say(c, text),
    at: (c) => at(c),
    onClear: () => standDown(),
  });
  /** Every officer on the road: the first, the backup and the squad. */
  const officers = (): PoliceCorgi[] => [...corgis, ...squad.members];
  // The payoff of a down (r6): the slow-mo, the line, the baton on the road and the bounty.
  const payoff: Payoff = createPayoff({
    app, playerId: player.id,
    pos: (c) => at(c),
    fines: () => fines,
    pay: (coins) => { player.coins += coins; },
  });
  const rideWorld: RideWorld = { track, obstacles: session.obstacles, riders: session.riders, playerTop: topOf(player), playerSpeed: 0 };
  let mode: Mode = 'off';
  let side: 1 | -1 = 1;
  let modeT = 0, bustT = 0, lostT = 0, whistleCd = 0, cooldown = 0, alertLevel = 0, simAcc = 0, lastReal = app.clock.realTime;
  let wingT = 0;                              // s left of the player's Wing Dash
  let minGap = Infinity;                      // closest approach (player.s − corgi.s) this chase
  let trailT = 0;                             // s trailing more than CHASE.trailGap behind the player
  let farT = 0;                               // s more than CHASE.farGap behind the player
  let resprinted = false;                     // the one re-sprint of this chase is used
  let shortcut = false;                       // the one out-of-sight catch-up of this chase is used
  let spoke = false;                          // the chase line (first time alongside) is said
  let level = 0;                              // the wanted stars (the level the events report)
  let pendingBust = false;                    // the player crashed because of the police
  let bribes = 0;                             // bribe attempts this race
  let fines = 0;                              // the fines this race (the bounty gives them back)
  let offDuty = false;                        // 警局下班: no police for the rest of the race
  const pos = new Vector3(), quat = new Quaternion();
  /** Corgi speech: a bubble over the officer (ui-hud anchors it on its obstacle id), rate limited. */
  const say = (c: PoliceCorgi, text: string): void => {
    if (!text) return;
    if (ctx.clock - c.lastSay < T.sayGap) return;
    c.lastSay = ctx.clock;
    app.bus.emit('npc:say', { obstacleId: c.id, character: 'corgi', text });
  };
  /** Where the officer is (world, body height): whistle, knock and toot sounds come from here. */
  const at = (c: PoliceCorgi): Vec3Like => track.toWorld(c.st.s, c.st.x, 1.1, new Vector3());
  const alert = (level: number, reason?: Reason): void => {
    if (level === alertLevel) return;
    alertLevel = level;
    app.bus.emit('police:alert', { riderId: player.id, level, reason });
  };
  const setMode = (m: Mode): void => { mode = m; modeT = 0; };

  const fightCtx: FightCtx = {
    app, session, player, wanted, rng,
    get now(): number { return ctx.clock; },
    state: { lastWindup: -99, why: 'none' },
    pos: (c) => at(c),
    say,
    onDown: (c, attacker) => {
      payoff.down(c, attacker);
      field.onDown();
      if (squad.members.includes(c)) squad.noteDown(c);
      else if (payoff.downs >= FIGHT.squadAt) squad.call();
    },
    heat: (v) => heat.offence(v),
    officers: () => officers(),
    chasing: () => mode === 'chase',
  };

  /** The wanted stars changed: tell the world, arm the batons, call the backup, put up the block. */
  const syncWanted = (): void => {
    const next = wanted.level;
    if (next === level) return;
    const prev = level;
    level = next;
    app.bus.emit('police:wanted', { riderId: player.id, level: next, prev });
    const armed = next >= 2;
    // The squad keeps its batons: it is on the road whatever the stars say.
    for (const c of officers()) if (c.active) c.st.weapon = armed || c.shield ? 'baton' : 'none';
    if (next < 3 || prev >= 3) return;
    field.onStars();
  };

  const spawn = (): void => {
    setMode('chase');
    placeCorgi(primary, session, CHASE.spawnBehind, clamp(player.x, -4, 4));
    bustT = lostT = trailT = farT = 0;
    resprinted = spoke = shortcut = false;
    minGap = player.s - primary.st.s;
    whistleCd = 2.5;
    rideWorld.playerTop = topOf(player);
    alert(1, 'spawn');
    say(primary, rng.pick(POLICE_LINES.alert));
  };

  const despawn = (): void => {
    setMode('off');
    for (const c of corgis) liftCorgi(c, session);
    field.reset();
    cooldown = CHASE.chaseCooldown;
    alert(0);
    if (!squad.called) { wanted.reset(); syncWanted(); }
  };

  /** 警局下班: the whole squad is down — no police for the rest of the race. */
  const standDown = (): void => {
    offDuty = true;
    setMode('off');
    for (const c of officers()) liftCorgi(c, session);
    field.reset();
    squad.reset();
    wanted.reset();
    syncWanted();
    player.heat = 0;
    alert(0);
    app.bus.emit('police:offDuty', { riderId: player.id });
  };

  /** The chase ends: an escape ('lost' alert + toast) or a let-go (its own line and toot, no escape credit). */
  const giveUp = (escaped: boolean): void => {
    setMode('leaving');
    field.reset();      // the block comes down and the backup goes home with the chase
    player.heat = Math.min(player.heat, CHASE.calmHeat);
    // The squad is still on the road: the stars stay up until it is beaten.
    if (!squad.called) { wanted.reset(); syncWanted(); }
    alert(0, escaped ? 'lost' : undefined);
    if (escaped) app.ui.toast(`甩掉了柯基警官！  “${rng.pick(POLICE_LINES.lost)}”`, 'meme');
    else if (player.finishTime === null) {
      say(primary, rng.pick(LET_GO_LINES));
      app.bus.emit('police:horn', { riderId: player.id, pos: at(primary) });
    }
  };

  const bust = (): void => {
    app.bus.emit('police:busted', { riderId: player.id, fine: CHASE.fine });
    player.coins -= CHASE.fine;
    fines += CHASE.fine;      // the bounty of a down gives the fines of this race back
    ctx.bustedCount.set(player.id, (ctx.bustedCount.get(player.id) ?? 0) + 1);
    player.heat = 0;
    field.reset();
    // The squad is still on the road: the stars stay up until it is beaten.
    if (!squad.called) { wanted.reset(); syncWanted(); }
    if (player.mode === 'racing') { player.mode = 'busted'; player.modeTime = 0; }
    setMode('ticket');
    alert(0, 'busted');
    say(primary, `${rng.pick(POLICE_LINES.busted)}  罚 ${CHASE.fine} 小鱼干，靠边 ${CHASE.penalty} 秒`);
  };

  const whistle = (): void => {
    whistleCd = CHASE.whistleCd;
    app.bus.emit('police:whistle', { riderId: player.id, pos: at(primary) });
    const slow = player.statuses.find((s) => s.id === 'slow');
    if (slow) slow.time = Math.max(slow.time, 1);
    else player.statuses.push({ id: 'slow', time: 1, strength: 0.15, source: null });
  };

  const offs = [
    listenFight(fightCtx),
    listenSkills(fightCtx),
    app.bus.on('skill:cast', (e) => { if (e.riderId === player.id && e.skillId === 'pelican.wing') wingT = CHASE.wingTime; }),
  ];

  const trailCtx: TrailCtx = {
    officer: primary, rng, say,
    get resprinted(): boolean { return resprinted; },
    set resprinted(v: boolean) { resprinted = v; },
    get trailT(): number { return trailT; },
    set trailT(v: number) { trailT = v; },
  };
  const officerRide: OfficerRide = { world: rideWorld, session, player, wanted, fight: fightCtx };

  const chase = (dt: number): void => {
    const st = primary.st;
    const gap = player.s - st.s;
    const down = player.mode === 'crashed' || player.mode === 'respawning';
    const slow = player.speed < CHASE.slow * rideWorld.playerTop;
    side = chooseSide(side, gap, primary.st.x, session, player, track);
    rideWorld.playerSpeed = player.speed;
    rideOfficer(officerRide, primary, dt, side);
    if (field.backup.active) rideOfficer(officerRide, field.backup, dt, side === 1 ? -1 : 1);
    const alongside = Math.abs(gap) < 4 && Math.abs(player.x - st.x) < 3.4;
    if (alongside && !spoke) { spoke = true; say(primary, rng.pick(POLICE_LINES.chase)); }
    const offending = down || slow;
    bustT = alongside && offending ? bustT + dt : Math.max(0, bustT - dt * 0.6);
    if (bustT >= CHASE.bustTime) { bust(); return; }
    whistleCd -= dt;
    if (gap > -1 && gap < 12 && whistleCd <= 0 && !tired(primary.ride) && player.mode === 'racing') whistle();
    minGap = Math.min(minGap, Math.max(0, gap));
    farT = gap > CHASE.farGap ? farT + dt : 0;
    // Left far behind before it ever arrived (a SHOWTIME leap, a boost chain): once the gap has settled for a
    // second, one shortcut back to the spawn gap, out of sight, so the chase is seen instead of ending as a phantom.
    if (!shortcut && minGap > CHASE.reached && farT > CHASE.shortcutAfter) {
      shortcut = true;
      st.s = player.s - CHASE.spawnBehind;
      minGap = CHASE.spawnBehind;
      trailT = farT = 0;
      return;
    }
    // Escaping needs a real lead built during the chase (never just a corgi that has not arrived yet): 25 m
    // pulled from its closest approach and 60 m held for 2 s. Falling 38 m back for 3 s (out of sight), trailing
    // twice, a calm lead of 15 m after it rode alongside, the 25 s cap and a cooled-down heat end it as a let-go.
    const settled = modeT > CHASE.minChase;
    lostT = settled && gap - minGap > CHASE.leadBuilt && gap > CHASE.loseGap ? lostT + dt : Math.max(0, lostT - dt);
    if (lostT > CHASE.loseTime) { giveUp(true); return; }
    const calm = settled && ((minGap < CHASE.reached && gap > CHASE.calmGap && player.heat < CHASE.calmHeat) || farT > CHASE.farTime);
    const outOfTime = modeT > CHASE.max || (player.heat < CHASE.letGoHeat && modeT > 20);
    if (calm || (trail(trailCtx, dt, gap) && settled) || outOfTime || player.finishTime !== null) { giveUp(false); return; }
    alert(alongside || gap < 20 ? 2 : 1);
  };

  /** The ticket stop is the time penalty: the player is held (also after a respawn) for CHASE.penalty s. */
  const ticket = (dt: number): void => {
    for (const c of corgis) if (c.active) ride(c.ride, rideWorld, dt, 0, player.x + side * 1.5, 5);
    const holding = modeT < CHASE.penalty;
    if (holding && player.mode === 'racing') { player.mode = 'busted'; player.modeTime = 0; }
    if (player.mode === 'busted') { player.speed = 0; player.vx = 0; }
    if (holding) return;
    if (player.mode === 'busted') { player.mode = 'racing'; player.modeTime = 0; player.invuln = Math.max(player.invuln, 1); }
    setMode('leaving');
  };

  const leave = (dt: number): void => {
    for (const c of corgis) {
      if (!c.active) continue;
      const hw = track.bounds(c.st.s).halfWidth;
      ride(c.ride, rideWorld, dt, Math.max(0, c.st.speed - 6 * dt), side * (hw - 0.8), 3);
    }
    if (player.s - primary.st.s > 45 || primary.st.s - player.s > 120 || modeT > CHASE.max) despawn();
  };

  /** 「V我50」: the player rings the bell next to an officer and offers 50 coins. */
  const bribe = (): void => {
    const offer = field.offer(bribes);
    if (!offer.officer) return;
    bribes += 1;
    takeBribe({
      app, player, wanted, offer, say,
      letGo: () => giveUp(false),   // a let-go, not an escape: no 'lost' credit
      coolFor: (s) => { cooldown = Math.max(cooldown, s); },
      syncWanted,
    });
  };

  const offBell = app.bus.on('combat:bell', (e) => { if (e.riderId === player.id) bribe(); });
  const offCrash = app.bus.on('rider:crash', (e) => {
    if (e.riderId === player.id && e.cause === 'police') pendingBust = true;
  });
  const offBarrier = app.bus.on('rider:obstacleHit', (e) => {
    if (e.riderId !== player.id || e.speed <= T.crashSpeed) return;
    if (field.isBarrier(e.obstacleId)) pendingBust = true;
  });

  return {
    setHeat: (v) => heat.set(v),
    preStep(dt) {
      simAcc += dt;
      cooldown -= dt;
      modeT += dt;
      payoff.update(app.clock.realTime);   // the slow-mo of a down is real time
      if (offDuty) {
        // 警局下班: no police for the rest of the race — the heat is pinned at zero.
        player.heat = 0;
        wanted.update(0);
        syncWanted();
        return;
      }
      wanted.update(player.heat);
      syncWanted();
      if (wingT > 0) { wingT -= dt; tryKnock(fightCtx, 1.4, null, 'none', false, WING_DAMAGE); }
      if (mode === 'chase') chase(dt);
      else if (mode === 'ticket') ticket(dt);
      else if (mode === 'leaving') leave(dt);
      field.update(dt, mode === 'chase');
      squad.update(dt, fightCtx, rideWorld);
      syncWanted();   // a knock, a KO next to an officer or an officer going down can change the stars
      // In a tunnel the heat cools twice as fast while every officer is far behind.
      const far = officers().every((c) => !c.active || player.s - c.st.s > T.tunnelGap);
      const coolMul = inTunnel(session) && far ? T.tunnelCool : 1;
      heat.update(dt, mode === 'chase' ? player.s - primary.st.s : null, coolMul);
      // A police crash (the baton, the roadblock) busts the player as soon as they are back on the bike.
      if (pendingBust && player.mode === 'racing') { pendingBust = false; bust(); }
      const canSpawn = session.config.police && session.phase === 'racing' && player.mode === 'racing'
        && player.s < track.length * CHASE.spawnBefore;
      if (mode === 'off' && cooldown <= 0 && canSpawn && player.heat > CHASE.spawnHeat) spawn();
      for (const c of officers()) { c.ob.s = c.st.s; c.ob.x = c.st.x; c.ob.speed = c.st.speed; }
    },
    sync() {
      const real = app.clock.realTime;
      const live = officers().filter((c) => c.active);
      if (!live.length) { simAcc = 0; lastReal = real; return; }
      for (const c of live) {
        if (!c.active) continue;
        trackPose(track, c.st.s, c.st.x, 0, c.st.yaw, c.st.lean, pos, quat);
        c.view.update(c.st, pos, quat, simAcc, Math.max(0, real - lastReal), mode !== 'leaving');
      }
      simAcc = 0;
      lastReal = real;
    },
    summary: () => ({
      mode, s: +primary.st.s.toFixed(1), x: +primary.st.x.toFixed(2), v: +primary.st.speed.toFixed(1),
      gap: +(player.s - primary.st.s).toFixed(1),
      heat: +player.heat.toFixed(2), bustT: +bustT.toFixed(2), cooldown: +Math.max(0, cooldown).toFixed(1),
      tired: tired(primary.ride), knocked: primary.ride.knockT > 0, closeT: +primary.ride.closeT.toFixed(1),
      minGap: Number.isFinite(minGap) ? +minGap.toFixed(1) : null, chaseT: +primary.ride.chaseT.toFixed(1),
      trailT: +trailT.toFixed(1), resprinted,
      wanted: level, hp: primary.hp, backup: field.backup.active, roadblock: field.summary().roadblock,
      windup: +primary.baton.windup.toFixed(2), cd: +primary.baton.cooldown.toFixed(2),
      ds: +(player.s - primary.st.s).toFixed(2), lat: +(primary.st.x - player.x).toFixed(2), why: fightCtx.state.why,
      downs: payoff.downs, squad: squad.activeIds(), offDuty,
    }),
    dispose() {
      for (const off of offs) off();
      offBell();
      offCrash();
      offBarrier();
      heat.dispose();
      if (mode !== 'off') alert(0);
      for (const c of officers()) {
        const i = session.obstacles.indexOf(c.ob);
        if (i >= 0) session.obstacles.splice(i, 1);
      }
      disposeCorgiUnit(primary);
      squad.dispose();
      field.dispose();
      warm.dispose();
    },
  };
}
