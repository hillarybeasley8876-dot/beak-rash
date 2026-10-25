// Police chase scenarios (critic r1–r3, acceptance r1): natural chases stay on screen and end visibly; a plain
// full-speed player is let go (an escape needs a real 60 m lead); any wreck next to the corgi is BUSTED (SPEC §9
// 'slow or crashed', whoever wrecked you); alert reasons spawn / lost / busted.
import { events, openRace } from '../race-lib.mjs';

const DT = 1 / 30;
const police = (h) => h.eval('({ ...window.__br.race.police(), t: +window.__br.session().time.toFixed(1) })');

/** Ride the passive human controller for `secs`, sampling the police every 0.5 s; stop early on `until`. */
async function ride(h, secs, until = () => false) {
  const rows = [];
  for (let i = 0; i < secs * 2; i++) {
    await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
    const p = await police(h);
    rows.push(p);
    if (until(p)) break;
  }
  return rows;
}

/** In-page: step the brawler/autopilot for `frames`, sampling the corgi every 3 frames (gap, mode). */
const TRACE = `window.__policeTrace = (frames, dt, mode) => {
  const br = window.__br, out = window.__ptrace ??= [];
  const tick = mode === 'auto' ? () => {} : (window.__humanTick ??= window.__mkHuman(mode));
  for (let i = 0; i < frames && !window.__rl.end; i++) {
    tick(dt); br.step(1, dt);
    const c = br.race.police();
    if (i % 3 !== 0 || !c || c.mode === 'off') continue;
    // ov: the corgi overlaps a rival's body (track-space contact box |ds| < 1.7, |dx| < 0.75).
    const ov = br.session().riders.some((r) => !r.isPlayer && r.mode === 'racing' && Math.abs(r.s - c.s) < 1.7 && Math.abs(r.x - c.x) < 0.75);
    out.push({ t: +br.session().time.toFixed(2), m: c.mode[0], gap: c.gap, ov });
  }
  return out.length;
};`;

/** Split a police trace into chases (spawn alert → next spawn) with reach / lost times. */
function chases(trace, alerts) {
  const spawns = alerts.filter((e) => e.p.reason === 'spawn').map((e) => e.time);
  return spawns.map((t0, i) => {
    const t1 = spawns[i + 1] ?? Infinity;
    const rows = trace.filter((r) => r.t >= t0 && r.t < t1 && r.m === 'c');
    const reach = rows.find((r) => Math.abs(r.gap) < 6)?.t ?? null;
    const lost = alerts.find((e) => e.p.reason === 'lost' && e.time >= t0 && e.time < t1)?.time ?? null;
    const along = rows.filter((r) => Math.abs(r.gap) < 4).length * 3 / 30;
    return { t0, reach: reach && +(reach - t0).toFixed(1), lost: lost && +(lost - t0).toFixed(1), along: +along.toFixed(1) };
  });
}

/** Chase anatomy: seconds in 'chase', seconds in view (corgi beside or ahead: gap < 4.5 m), how it ended. */
function anatomy(trace, alerts) {
  const spawns = alerts.filter((e) => e.p.reason === 'spawn').map((e) => e.time);
  return spawns.map((t0, i) => {
    const t1 = spawns[i + 1] ?? Infinity;
    const rows = trace.filter((r) => r.t >= t0 && r.t < t1 && r.m === 'c');
    const end = alerts.find((e) => e.time > t0 && e.time < t1 && e.p.level === 0) ?? null;
    // Sim seconds between samples (slow-mo KO cinematics advance less per frame).
    let dur = 0, vis = 0, ov = 0;
    rows.forEach((r, k) => {
      const dt = Math.min(0.2, (rows[k + 1]?.t ?? r.t + 0.1) - r.t);
      dur += dt;
      if (r.gap < 4.5 && r.gap > -25) vis += dt;
      if (r.ov) ov += dt;
    });
    return { t0: +t0.toFixed(0), dur: +dur.toFixed(1), vis: +vis.toFixed(1), ov: +ov.toFixed(1), end: end ? end.p.reason ?? 'letgo' : 'open' };
  });
}

export const chaseScenarios = {
  /** Critic r3: natural chases (brawler L1–3) stay on screen ≥ 50 % of the time and always end visibly within ~26 s. */
  async visible(page, h, { check, stub, a }) {
    const runs = String(a.vruns ?? 'coast:1:1,coast:2:2,city:3:3,coast:4:3,mountain:5:2,coast:6:1').split(',').map((x) => x.split(':'));
    const list = [];
    for (const [track, seed, level] of runs) {
      if (list.filter((c) => c.end !== 'open').length >= 8) break;
      await openRace(h, `race=${track}&seed=${seed}&level=${level}&manual=1&intro=0${stub}`);
      await h.eval(TRACE);
      for (let i = 0; i < 12 && !(await h.eval('!!window.__rl.end')); i++) await h.eval(`window.__policeTrace(300, ${DT}, 'brawler')`);
      list.push(...anatomy(await h.eval('window.__ptrace'), await events(h, 'police:alert')).map((c) => ({ ...c, run: `${track}${seed}` })));
    }
    const done = list.filter((c) => c.end !== 'open');
    const dur = done.reduce((n, c) => n + c.dur, 0), vis = done.reduce((n, c) => n + c.vis, 0);
    const info = { share: +(vis / Math.max(1, dur)).toFixed(2), chases: done.map((c) => `${c.run}@${c.t0}:${c.vis}/${c.dur}s:${c.end}`).join(' ') };
    check('police: ≥ 6 natural chases, the corgi in view ≥ 50 % of chase time', done.length >= 6 && vis >= dur * 0.5, info);
    check('police: every chase ends (lost / busted / let-go) within 26 s', done.every((c) => c.dur <= 26), info);
    const ov = done.reduce((n, c) => n + c.ov, 0);
    check('police: the corgi rides around rivals (≤ 0.3 s overlapping a rival per chase)', ov <= 0.3 * done.length, { overlapS: +ov.toFixed(1), perChase: done.map((c) => c.ov) });
  },


  /** Critic r2: natural chases on boosting players (brawler / autopilot) arrive before any 'lost'. */
  async arrive(page, h, { check, stub, a }) {
    const runs = String(a.runs ?? 'brawler:1,brawler:2,brawler:3,auto:2').split(',').map((x) => x.split(':'));
    for (const [mode, seed] of runs) {
      await openRace(h, `race=coast&seed=${seed}&level=1&manual=1&intro=0${mode === 'auto' ? '&autopilot=1' : ''}${stub}`);
      await h.eval(TRACE);
      for (let i = 0; i < 30 && !(await h.eval('!!window.__rl.end')); i++) await h.eval(`window.__policeTrace(300, ${DT}, '${mode}')`);
      const list = chases(await h.eval('window.__ptrace'), await events(h, 'police:alert'));
      const bad = list.filter((c) => c.lost !== null && (c.reach === null || c.reach > c.lost || c.lost < 8));
      check(`arrive ${mode} seed ${seed}: every 'lost' comes after a reach and ≥ 8 s`, bad.length === 0, list);
      check(`arrive ${mode} seed ${seed}: chases spawn and the corgi reaches the player`, list.length > 0 && list.some((c) => c.reach !== null), list.length);
    }
  },

  /** heat 0.95, full throttle, no further offences → alongside, tires, then lets the player go by the 25 s cap
   *  (acceptance r1: 'lost' credit needs a 60 m lead held 2 s, which riding flat out alone never builds). */
  async outrun(page, h, { check, stub, a }) {
    await openRace(h, `race=coast&seed=${a.seed ?? 11}&level=1&traffic=0&manual=1&intro=0${stub}`);
    await h.eval(`window.__runHuman(600, ${DT}, 1000, 'passive')`);
    await h.eval('window.__br.race.setHeat(0.95)');
    const t0 = await h.eval('window.__br.session().time');
    const rows = await ride(h, 60, (p) => p.mode === 'leaving' || p.mode === 'off');
    const alerts = (await events(h, 'police:alert')).map((e) => ({ level: e.p.level, reason: e.p.reason ?? null, t: +(e.time - t0).toFixed(1) }));
    const lost = alerts.find((e) => e.reason === 'lost');
    const end = alerts.find((e) => e.level === 0);
    const along = rows.filter((r) => r.mode === 'chase' && Math.abs(r.gap) < 4).length / 2;
    const trace = rows.filter((_, i) => i % 6 === 0).map((r) => `${(r.t - t0).toFixed(0)}:${r.mode[0]}${r.gap}${r.tired ? 'T' : ''}/h${r.heat}`).join(' ');
    check('police spawn alert carries reason spawn', alerts[0]?.reason === 'spawn', alerts.slice(0, 2));
    check('full-speed player is let go (no escape credit) within 26 s', !!end && end.reason === null && end.t <= 26, { end, alongside: along, trace });
    // Design: the corgi catches up and rides alongside first, then tires and gives up.
    const tiredAt = rows.find((r) => r.tired)?.t;
    check('corgi rides alongside ≥ 4 s before it lets go', along >= 4 && !!end && end.t >= 8,
      { along, tiredAt: tiredAt && +(tiredAt - t0).toFixed(1), end: end?.t });
    check('no escape credit in the first 8 s of the chase', !lost || lost.t >= 8, lost);
  },

  /** A rival's KO next to the corgi is BUSTED too (acceptance r1: 'slow or crashed', whoever wrecked you). */
  async koBust(page, h, { check, stub }) {
    const near = await corgiAlongside(h, 12, stub);
    const rival = await h.eval('window.__br.session().riders.find((r) => !r.isPlayer && r.mode === "racing").id');
    await h.eval(`window.__br.ko(0, ${rival})`);
    await ride(h, 7);
    const busted = (await events(h, 'police:busted')).length;
    check('KO by a rival next to the corgi is BUSTED', near && busted === 1, { alongside: near, busted, now: await police(h) });
  },

  /** Crashing yourself next to the corgi is BUSTED (alert reason busted, then a 4 s hold). */
  async selfBust(page, h, { check, stub }) {
    const near = await corgiAlongside(h, 14, stub);
    await h.eval(`(() => { const s = window.__br.session(); s.physics.crash(s.player, 'wall', null); })()`);
    await ride(h, 6, () => false);
    const busted = await events(h, 'police:busted');
    const reasons = (await events(h, 'police:alert')).map((e) => e.p.reason ?? null);
    check('self-inflicted crash next to the corgi is BUSTED', near && busted.length === 1, { alongside: near, now: await police(h) });
    check('BUSTED alert carries reason busted', reasons.includes('busted'), reasons);
  },

  /** Police 2.0 (SPEC §14): the wanted stars. ★1 keeps the old chase, ★2 arms the baton, ★3 sends a
   *  backup and a roadblock, the officer can be fought back and the player can buy it off. */
  async stars(page, h, { check, stub }) {
    const RECORDER = `(() => { window.__pe = []; const bus = window.__br.app.bus;
      for (const t of ['police:wanted', 'police:windup', 'police:swing', 'npc:strike', 'police:roadblock',
        'police:hurt', 'police:down', 'police:bribe'])
        bus.on(t, (e) => window.__pe.push({ t, e: JSON.parse(JSON.stringify(e)), time: +window.__br.session().time.toFixed(2) })); })()`;
    /** A fresh race with the event recorder on, the rivals out of the way (the officer has to be able to
     *  reach the player's tail) and the player at a pace it can hold. */
    const start = async () => {
      await openRace(h, `race=coast&seed=3&manual=1&intro=0&traffic=0${stub}`);
      await h.eval('window.__throttle = 0.6');
      await h.eval(RECORDER);
      await h.eval(`window.__runHuman(60, ${DT}, 1000, 'passive')`);
      await h.eval(`(() => { const b = window.__br, s = b.session();
        for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 600 + r.id * 12, 0); })()`);
    };
    const evs = () => h.eval('window.__pe');
    const setHeat = (v) => h.eval(`window.__br.race.setHeat(${v})`);
    const starsOf = (list) => list.filter((e) => e.t === 'police:wanted').map((e) => e.e.level);
    /** Ride until the named event shows up (or `secs` run out); returns everything seen. */
    const untilEvent = async (name, secs) => {
      for (let i = 0; i < secs * 2; i++) {
        await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
        const list = await evs();
        if (list.some((e) => e.t === name)) return list;
      }
      return evs();
    };

    // ★1: the old chase, no baton.
    await start();
    await setHeat(0.55);
    await ride(h, 12, (p) => p.mode === 'chase' && Math.abs(p.gap) < 4);
    let ev = await evs();
    check('police 2.0: heat 0.55 → ★1', starsOf(ev).includes(1), { stars: starsOf(ev) });
    check('police 2.0: ★1 never winds the baton up', !ev.some((e) => e.t === 'police:windup'), {});

    // ★2: the baton winds up, swings, and a hit is an npc:strike the combat answers.
    await start();
    await setHeat(0.8);
    ev = await untilEvent('police:swing', 25);
    const wind = ev.find((e) => e.t === 'police:windup');
    const swing = ev.find((e) => e.t === 'police:swing');
    const strike = ev.find((e) => e.t === 'npc:strike');
    check('police 2.0: heat 0.8 → ★2', starsOf(ev).includes(2), { stars: starsOf(ev) });
    check('police 2.0: ★2 winds the baton up (0.45 s) and swings',
      !!wind && wind.e.time >= 0.3 && wind.e.time <= 0.5 && !!swing
      && swing.time - wind.time >= wind.e.time - 0.05 && swing.time - wind.time <= wind.e.time + 0.1,
      { wind: wind?.e, swing: swing?.e });
    check('police 2.0: a swing that hits is an npc:strike (baton, police)',
      !swing || !swing.e.hit || (!!strike && strike.e.weapon === 'baton' && strike.e.cause === 'police'),
      { hit: swing?.e.hit, strike: strike?.e });

    // ★2: the bribe 「V我50」 is taken and the chase lets the player go.
    await start();
    await setHeat(0.8);
    for (let i = 0; i < 60; i++) {
      const near = await h.eval('(() => { const p = window.__br.race.police(); return p && p.mode === "chase" && Math.abs(p.gap) < 4; })()');
      if (near) break;
      await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
    }
    await h.eval('window.__br.session().player.coins = 120');
    await h.eval('window.__br.press("bell")');
    ev = await untilEvent('police:bribe', 4);
    const bribe = ev.find((e) => e.t === 'police:bribe');
    const coins = await h.eval('window.__br.session().player.coins');
    check('police 2.0: 「V我50」 at ★2 is accepted (120 → 70) and the chase ends',
      !!bribe && bribe.e.accepted && bribe.e.amount === 50 && coins === 70, { bribe: bribe?.e, coins });

    // ★3: a backup corgi and a roadblock with one gap.
    await start();
    await setHeat(0.97);
    ev = await untilEvent('police:roadblock', 25);
    const block = ev.find((e) => e.t === 'police:roadblock');
    const backup = await h.eval('window.__br.session().obstacles.some((o) => o.id === 901 && o.active)');
    check('police 2.0: heat 0.97 → ★3 with a backup corgi', starsOf(ev).includes(3) && backup, { stars: starsOf(ev), backup });
    check('police 2.0: the roadblock is a gap in a line of solid barriers',
      !!block && block.e.gapWidth >= 3 && block.e.gapWidth <= 4.5, { block: block?.e });

    // Fight back: a thrown weapon hurts the officer, at 0 HP it goes down.
    await start();
    await setHeat(0.97);
    await untilEvent('police:roadblock', 25);
    await h.eval(`window.__br.app.bus.emit('combat:obstacleHit', { obstacleId: 900, attacker: 0, weapon: 'pan', damage: 35, thrown: true, pos: { x: 0, y: 1, z: 0 } })`);
    await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
    await h.eval(`window.__br.app.bus.emit('combat:obstacleHit', { obstacleId: 900, attacker: 0, weapon: 'pan', damage: 35, thrown: true, pos: { x: 0, y: 1, z: 0 } })`);
    await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
    ev = await evs();
    const hurt = ev.filter((e) => e.t === 'police:hurt').map((e) => e.e.hp);
    check('police 2.0: the officer has 60 HP and goes down at 0',
      hurt.length === 2 && hurt[0] === 25 && hurt[1] === 0 && ev.some((e) => e.t === 'police:down'),
      { hp: hurt, down: ev.some((e) => e.t === 'police:down') });
  },
};

/** New race on `seed`, heat 0.95 after 15 s; returns the police state once the corgi rides alongside. */
async function corgiAlongside(h, seed, stub) {
  await openRace(h, `race=coast&seed=${seed}&level=1&traffic=0&manual=1&intro=0${stub}`);
  await h.eval(`window.__runHuman(450, ${DT}, 1000, 'passive')`);
  await h.eval('window.__br.race.setHeat(0.95)');
  const rows = await ride(h, 25, (p) => p.mode === 'chase' && Math.abs(p.gap) < 3);
  const last = rows.at(-1);
  return last && last.mode === 'chase' && Math.abs(last.gap) < 3 ? last : null;
}
