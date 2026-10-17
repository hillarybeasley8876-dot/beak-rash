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

export const chaseScenarios = {
  /** heat 0.95, full throttle, no further offences → the corgi gives up within 45 s ('lost'). */
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
    check('corgi tires at some point or is outrun before', rows.some((r) => r.tired) || (lost && lost.t < 25), { along });
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
