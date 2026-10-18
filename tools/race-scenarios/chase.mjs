// Police chase scenarios (critic r1): a full-speed player outruns the corgi; a KO by a rival next to the
// corgi is no BUSTED (a self-inflicted crash still is); alert reasons spawn / lost / busted.
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
    if (i % 3 === 0 && c && c.mode !== 'off') out.push({ t: +br.session().time.toFixed(2), m: c.mode[0], gap: c.gap });
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

export const chaseScenarios = {
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

  /** heat 0.95, full throttle, no further offences → alongside, tires, then gives up within 45 s ('lost'). */
  async outrun(page, h, { check, stub, a }) {
    await openRace(h, `race=coast&seed=${a.seed ?? 11}&level=1&traffic=0&manual=1&intro=0${stub}`);
    await h.eval(`window.__runHuman(600, ${DT}, 1000, 'passive')`);
    await h.eval('window.__br.race.setHeat(0.95)');
    const t0 = await h.eval('window.__br.session().time');
    const rows = await ride(h, 60, (p) => p.mode === 'leaving' || p.mode === 'off');
    const alerts = (await events(h, 'police:alert')).map((e) => ({ level: e.p.level, reason: e.p.reason ?? null, t: +(e.time - t0).toFixed(1) }));
    const lost = alerts.find((e) => e.reason === 'lost');
    const along = rows.filter((r) => r.mode === 'chase' && Math.abs(r.gap) < 4).length / 2;
    const trace = rows.filter((_, i) => i % 6 === 0).map((r) => `${(r.t - t0).toFixed(0)}:${r.mode[0]}${r.gap}${r.tired ? 'T' : ''}/h${r.heat}`).join(' ');
    check('police spawn alert carries reason spawn', alerts[0]?.reason === 'spawn', alerts.slice(0, 2));
    check('full-speed player loses the corgi within 45 s', !!lost && lost.t <= 45, { lost, alongside: along, trace });
    // Design: the corgi catches up and rides alongside first; escaping takes a lead built over time (≥ 15 s).
    const tiredAt = rows.find((r) => r.tired)?.t;
    check('corgi rides alongside ≥ 4 s, and the escape takes ≥ 15 s', along >= 4 && !!lost && lost.t >= 15,
      { along, tiredAt: tiredAt && +(tiredAt - t0).toFixed(1), lost: lost?.t });
    check('no escape credit in the first 8 s of the chase', !lost || lost.t >= 8, lost);
  },

  /** A rival's KO next to the corgi is not BUSTED. */
  async koNoBust(page, h, { check, stub }) {
    const near = await corgiAlongside(h, 12, stub);
    const rival = await h.eval('window.__br.session().riders.find((r) => !r.isPlayer && r.mode === "racing").id');
    await h.eval(`window.__br.ko(0, ${rival})`);
    await ride(h, 7);
    const busted = (await events(h, 'police:busted')).length;
    check('KO by a rival next to the corgi is no BUSTED', near && busted === 0, { alongside: near, busted, now: await police(h) });
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
