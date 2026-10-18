// Fairness scenarios (critic r1): the level-1 start does not mug a passive player, AI skills wait a few
// seconds after GO, the launch boost is reported as 'launch', and no phantom place change at GO.
import { events, openRace } from '../race-lib.mjs';

const DT = 1 / 30;

/** In-page: ride the passive human and count rival boost frames in view with no boost event behind them. */
const PULSE_CHECK = `window.__pulseCheck = (frames, dt) => {
  const br = window.__br, s = br.session(), p = s.player;
  const tick = window.__humanTick ??= window.__mkHuman('passive');
  const until = window.__boostUntil ??= new Map();
  if (!window.__pulseHooked) {
    window.__pulseHooked = true;
    // Boosts merge (max time, max power): a short boost after a long one must not shorten the explained window.
    br.app.bus.on('rider:boost', (e) => until.set(e.riderId, Math.max(until.get(e.riderId) ?? -1, s.time + e.time + 0.1)));
  }
  let vis = 0, total = 0, lifted = 0, slowLift = 0, maxRubber = 1;
  for (let i = 0; i < frames; i++) {
    tick(dt); br.step(1, dt);
    for (const r of s.riders) {
      if (r.isPlayer || r.mode !== 'racing' || s.phase !== 'racing') continue;
      const ds = r.s - p.s;
      if (ds < -4 || ds > 80) continue;
      total++;
      if (r.boostTime > 0 && (until.get(r.id) ?? -1) < s.time) vis++;
      if (r.rubber > 1.01) {
        // In view the rubber may only lift a slow bike up to its base pace (never above it).
        const a = br.race.ai().find((q) => q.id === r.id);
        if (!a || a.base === null || r.rubber * a.top > Math.max(a.top, a.base) * 1.01) lifted++; else slowLift++;
      }
    }
    for (const r of s.riders) maxRubber = Math.max(maxRubber, r.rubber);
  }
  return { vis, total, lifted, slowLift, maxRubber };
};`;

/** Ride the human controller until race time `secs` (or the race ends). */
async function rideUntil(h, secs, mode = 'passive') {
  for (let i = 0; i < 200; i++) {
    const t = await h.eval('window.__br.session()?.time ?? 0');
    if (t >= secs || (await h.eval('!!window.__rl.end'))) return;
    await h.eval(`window.__runHuman(60, ${DT}, 1000, '${mode}')`);
  }
}

/** Full race with the passive human player; returns samples, results and the event log. */
async function fullRace(h, seed, stub) {
  await openRace(h, `race=coast&seed=${seed}&level=1&manual=1&intro=0${stub}`);
  const samples = [];
  for (let i = 0; i < 40 && !(await h.eval('!!window.__rl.end')); i++) {
    samples.push(...(await h.eval(`window.__runHuman(300, ${DT}, 15, 'passive')`)));
  }
  return { samples, res: await h.eval('window.__rl.end ?? window.__br.race.results()') };
}

export const fairScenarios = {
  /** Close racing (critic r1): passive player, level 1 — median leader gap < 120 m, last place varies. */
  async close(page, h, { check, stub, a }) {
    const seeds = String(a.seeds ?? '1,2,3').split(',').map(Number);
    const lasts = [];
    for (const seed of seeds) {
      const { samples, res } = await fullRace(h, seed, stub);
      const racing = samples.filter((x) => x.phase === 'racing');
      const gaps = racing.map((x) => x.gapLead).sort((p, q) => p - q);
      const med = gaps[Math.floor(gaps.length / 2)] ?? 0;
      const last = res.at(-1)?.character;
      lasts.push(last);
      const me = res.find((r) => r.isPlayer);
      const info = { seed, medianLeadGap: med, maxLeadGap: gaps.at(-1), medianSpread: racing.map((x) => x.spread).sort((p, q) => p - q)[Math.floor(racing.length / 2)],
        player: me?.place, results: res.map((r) => `${r.place}.${r.character}:${r.time?.toFixed(1) ?? 'DNF'}`).join(' ') };
      check(`close race seed ${seed}: median leader gap < 120 m`, med < 120, info);
    }
    check('last place varies across seeds', new Set(lasts).size > 1, lasts);
  },

  /** Critic r2: a faster bike is a real edge — rival pace caps ignore the player's bike; the fixie run wins time and places. */
  async bikes(page, h, { check, stub, a }) {
    const out = {};
    for (const bike of ['roadbike', 'fixie']) {
      await openRace(h, `race=coast&seed=${a.seed ?? 3}&level=1&manual=1&intro=0&traffic=0&police=0&bike=${bike}${stub}`);
      await rideUntil(h, 2);
      const caps = await h.eval('window.__br.race.ai().filter((b) => b.pace !== null).map((b) => b.pace)');
      for (let i = 0; i < 40 && !(await h.eval('!!window.__rl.end')); i++) await h.eval(`window.__runHuman(300, ${DT}, 1000, 'passive')`);
      const res = await h.eval('window.__rl.end ?? window.__br.race.results()');
      const me = res.find((r) => r.isPlayer);
      out[bike] = { caps, place: me.place, time: me.time, winner: res[0].time };
    }
    const { roadbike: r, fixie: f } = out;
    const same = r.caps.length === f.caps.length && r.caps.every((c, i) => Math.abs(c - f.caps[i]) < 0.01);
    check('rival pace caps do not follow the player bike', same, { roadbike: r.caps, fixie: f.caps });
    check('the fixie finishes faster and places at least as well', f.time < r.time - 3 && f.place <= r.place,
      { roadbike: [r.place, r.time, r.winner], fixie: [f.place, f.time, f.winner] });
  },

  /** Critic r2: a KO buys a real gap — the KO'd rival is still ≥ 25 m behind 30 s later (catch-up ≤ 8 %, none for 12 s). */
  async koGap(page, h, { check, stub, a }) {
    await openRace(h, `race=coast&seed=${a.seed ?? 3}&level=1&manual=1&intro=0&traffic=0&police=0${stub}`);
    await rideUntil(h, 40);
    const id = await h.eval(`(() => { const s = window.__br.session(), p = s.player;
      const r = s.riders.filter((q) => !q.isPlayer && q.mode === 'racing').sort((x, y) => Math.abs(x.s - p.s) - Math.abs(y.s - p.s))[0];
      window.__br.ko(r.id, 0); return r.id; })()`);
    const t0 = await h.eval('window.__br.session().time');
    const gaps = [];
    // The passive player's own KO would hand the field the gap back: keep its HP topped up while measuring.
    const topUp = 'window.__br.session().player.hp = window.__br.session().player.maxHp';
    for (const dt of [15, 30, 45]) {
      while ((await h.eval('window.__br.session().time')) < t0 + dt) {
        await h.eval(topUp);
        await h.eval(`window.__runHuman(15, ${DT}, 1000, 'passive')`);
      }
      gaps.push(await h.eval(`+(window.__br.session().rider(${id}).s - window.__br.session().player.s).toFixed(1)`));
    }
    const playerDown = (await events(h, 'rider:crash')).filter((e) => e.p.riderId === 0 && e.time > t0).length;
    check("KO'd rival still ≥ 25 m behind 30 s after the KO", gaps[1] <= -25, { id, gaps, playerDown });
  },

  /** Passive player, level 1, seeds 1–6: ≤ 2 hits in the first 6 s and no KO in the first 30 s. */
  async mugging(page, h, { check, stub, a }) {
    const seeds = String(a.seeds ?? '1,2,3,4,5,6').split(',').map(Number);
    const rows = [];
    for (const seed of seeds) {
      await openRace(h, `race=coast&seed=${seed}&level=1&manual=1&intro=0${stub}`);
      await rideUntil(h, 30);
      const hits = (await events(h, 'combat:hit')).filter((e) => e.p.victim === 0 && !e.p.blocked);
      const kos = (await events(h, 'combat:ko')).filter((e) => e.p.victim === 0);
      const early = hits.filter((e) => e.time < 6).length;
      const ko30 = kos.filter((e) => e.time < 30).map((e) => e.time.toFixed(1));
      const hp = await h.eval('Math.round(window.__br.session().player.hp)');
      const by = hits.reduce((o, e) => ((o[e.p.attacker] = (o[e.p.attacker] ?? 0) + 1), o), {});
      rows.push({ seed, early, ko30, hits30: hits.length, hp, by });
      check(`mugging seed ${seed}: ≤ 2 hits in 6 s, no KO in 30 s`, early <= 2 && ko30.length === 0, rows.at(-1));
    }
  },

  /** A rival jittering ±0.7 m alongside the player never flips places; a real 3 m pass flips once. */
  async flicker(page, h, { check, stub }) {
    await openRace(h, `race=coast&seed=3&level=1&manual=1&intro=0&traffic=0&police=0${stub}`);
    await h.eval('window.__br.setControls({ throttle: 1 })');
    await h.step(240, 1 / 60);
    await h.eval(`(() => { const s = window.__br.session(), p = s.player;
      s.riders.forEach((r) => { if (!r.isPlayer && r.id !== 1) r.s = p.s - 200; }); })()`);
    const place = (dx, ds) => h.eval(`(() => { const s = window.__br.session(), p = s.player, r = s.rider(1);
      r.s = p.s + ${ds}; r.x = Math.max(-3, Math.min(3, p.x + ${dx})); r.speed = p.speed; })()`);
    await place(2.5, -6);
    await h.step(60, 1 / 60);
    const count = async () => (await events(h, 'race:placeChange')).filter((e) => e.p.riderId === 0).length;
    const n0 = await count();
    for (let k = 0; k < 12; k++) { await place(2.5, k % 2 ? 0.7 : -0.7); await h.step(12, 1 / 60); }
    const n1 = await count();
    await place(2.5, 3);
    for (let k = 0; k < 4; k++) { await h.step(15, 1 / 60); await place(2.5, 3); }
    const n2 = await count();
    check('rival jittering ±0.7 m alongside: no player place change', n1 === n0, { jitterChanges: n1 - n0 });
    check('a real pass (3 m ahead for 1 s) changes the player place once', n2 - n1 === 1, { passChanges: n2 - n1 });
  },

  /**
   * The rubber band never shows on rivals in view (−4…+80 m): no boost without a boost event, and rubber never
   * takes a rider above its base pace there (slow bikes may be lifted up to it); the unseen catch-up still works.
   */
  async pulses(page, h, { check, stub, a }) {
    await openRace(h, `race=coast&seed=${a.seed ?? 3}&level=1&manual=1&intro=0${stub}`);
    await h.eval(PULSE_CHECK);
    let vis = 0, total = 0, lifted = 0, slowLift = 0, maxRubber = 1;
    for (let i = 0; i < 12; i++) {
      const r = await h.eval(`window.__pulseCheck(300, ${DT})`);
      vis += r.vis; total += r.total; lifted += r.lifted; slowLift += r.slowLift; maxRubber = Math.max(maxRubber, r.maxRubber);
    }
    check('no unexplained boosts on rivals in view', vis === 0, { unexplained: vis, samples: total });
    check('in view, rubber never lifts a rival above its pace', lifted === 0 && maxRubber > 1.01,
      { lifted, slowLift, samples: total, maxRubber: +maxRubber.toFixed(3) });
  },

  /** No AI signature skill in the first 5 s; launch boost kind 'launch'; no player place change at GO. */
  async opening(page, h, { check, stub }) {
    await openRace(h, `race=coast&seed=4&level=1&manual=1&intro=0${stub}`);
    await h.eval(`window.__br.setControls({ throttle: 1 })`);
    await h.step(90, DT);
    await rideUntil(h, 16);
    const casts = (await events(h, 'skill:cast')).filter((e) => e.p.riderId !== 0);
    const boosts = (await events(h, 'rider:boost')).filter((e) => e.p.riderId === 0);
    const placeAtGo = (await events(h, 'race:placeChange')).filter((e) => e.p.riderId === 0 && e.time === 0);
    check('no AI skill before 5 s after GO', casts.every((e) => e.time >= 5), casts.map((e) => `${e.p.skillId}@${e.time.toFixed(1)}`));
    check('launch boost reported as kind launch', boosts.length > 0 && boosts[0].p.kind === 'launch', boosts.slice(0, 2).map((e) => e.p));
    check('no phantom player place change at GO', placeAtGo.length === 0, placeAtGo.map((e) => e.p));
  },
};
