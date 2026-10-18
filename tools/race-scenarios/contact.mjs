// Contact scenarios (critic r2): AI riders brake for or steer around a slow / stopped rider instead of
// coasting into it (rear-end strength = closing speed × 0.8, > 5 is a ram); rivals the player hits hit back.
import { events, openRace } from '../race-lib.mjs';

const DT = 1 / 30;
const BUMPS = `window.__bumps = []; window.__br.app.bus.on('rider:bump', (p) => { if (p.a === 0 || p.b === 0)
  window.__bumps.push({ t: +window.__br.session().time.toFixed(2), other: p.a === 0 ? p.b : p.a, k: +p.strength.toFixed(1) }); })`;
const CHARS = 'Object.fromEntries(window.__br.session().riders.map((r) => [r.id, r.character]))';
const HOT = new Set(['goose', 'seagull', 'cat', 'shiba']);   // grudge ≥ 0.6 (ai/personality.ts)
const fmt = (bumps, chars) => bumps.map((b) => `${chars[b.other]}:${b.k}`).join(' ') || '-';

export const contactScenarios = {
  /** A brawling player (level 1, 100 s, seeds 1–6): hot-tempered rivals it hits hit back, nobody in the first 6 s. */
  async grudge(page, h, { check, stub, a }) {
    let hotN = 0, hotA = 0, hotL = 0, early = 0;
    for (const seed of String(a.seeds ?? '1,2,3,4,5,6').split(',').map(Number)) {
      await openRace(h, `race=coast&seed=${seed}&level=1&manual=1&intro=0${stub}`);
      for (let i = 0; i < 10 && !(await h.eval('!!window.__rl.end')); i++) await h.eval(`window.__runHuman(300, ${DT}, 1000, 'brawler')`);
      const hits = (await events(h, 'combat:hit')).filter((e) => !e.p.blocked);
      const given = hits.filter((e) => e.p.attacker === 0 && e.time >= 6);
      const taken = hits.filter((e) => e.p.victim === 0);
      // Episodes: the first hit on a rider after 5 s without hitting it (swing spam counts once); a victim that
      // crashes within 2 s (KO, ult, wall) cannot answer, so it is left out.
      const crashes = await events(h, 'rider:crash');
      const swings = await events(h, 'combat:swing');
      const episodes = given.filter((g, i) => !given.slice(0, i).some((q) => q.p.victim === g.p.victim && g.time - q.time < 5)
        && !crashes.some((c) => c.p.riderId === g.p.victim && c.time >= g.time && c.time - g.time < 2));
      const within = (g, e, id) => id === g.p.victim && e.time > g.time && e.time - g.time < 5;
      const answered = episodes.filter((g) => taken.some((t) => within(g, t, t.p.attacker)) || swings.some((w) => within(g, w, w.p.riderId)));
      const chars = await h.eval(CHARS);
      const hot = (g) => HOT.has(chars[g.p.victim]);
      const tag = (list) => list.map((g) => `${chars[g.p.victim]}@${g.time.toFixed(0)}`).join(' ');
      const landed = episodes.filter((g) => taken.some((t) => within(g, t, t.p.attacker)));
      hotN += episodes.filter(hot).length;
      hotA += answered.filter(hot).length;
      hotL += landed.filter(hot).length;
      early += taken.filter((e) => e.time < 6).length;
      console.log(`  grudge seed ${seed}: given ${given.length} taken ${taken.length} · answered ${tag(answered) || '-'} · unanswered ${tag(episodes.filter((g) => !answered.includes(g))) || '-'}`);
    }
    // Without grudges (personality.grudge = 0) hot rivals land a hit back in 7/29 fights; with them 14/26.
    check('grudge: hot-tempered rivals land a hit back in ≥ 40 % of fights within 5 s (all seeds)', hotN > 0 && hotL >= hotN * 0.4,
      { landedBack: `${hotL}/${hotN}`, swungBack: `${hotA}/${hotN}` });
    check('grudge: nobody hits the brawler in the first 6 s', early === 0, { early });
  },

  /** The player parked mid-lane 70 m ahead of the pack: nobody rams it (no bump > 5), seeds 1–3, two lanes. */
  async stopped(page, h, { check, stub, a }) {
    for (const seed of String(a.seeds ?? '1,2,3').split(',').map(Number)) {
      for (const x of [0, -2.5]) {
        await openRace(h, `race=coast&seed=${seed}&level=1&manual=1&intro=0&traffic=0&police=0${stub}`);
        await h.eval(`window.__runHuman(450, ${DT}, 1000, 'passive')`);
        await h.eval(BUMPS);
        await h.eval(`(() => { const s = window.__br.session(), p = s.player;
          const lead = Math.max(...s.riders.filter((r) => !r.isPlayer).map((r) => r.s));
          p.s = lead + 70; p.x = ${x}; p.speed = 0; p.vx = 0; window.__laneX = ${x}; window.__throttle = 0; window.__brake = 1; })()`);
        let pushed = 0;
        for (let i = 0; i < 40; i++) {
          await h.eval(`window.__runHuman(6, ${DT}, 1000, 'passive')`);
          pushed = Math.max(pushed, await h.eval('window.__br.session().player.speed'));
        }
        const bumps = await h.eval('window.__bumps');
        const hard = bumps.filter((b) => b.k > 5);
        check(`stopped seed ${seed} x=${x}: no ram (bump > 5) into a stopped rider`, hard.length === 0,
          { bumps: fmt(bumps, await h.eval(CHARS)), pushedTo: +pushed.toFixed(1) });
      }
    }
  },

  /**
   * The player brakes hard in the pack: riders behind brake too (no bump > 5), seeds 1–3, 5, 6. Seed 4 still
   * rams (cross-unit, sim): the penguin's draft slingshot fires as it pulls out to avoid, and the boost push
   * (16 m/s²) cancels its brake — passes once sim drops slingshots / boost pushes under braking.
   */
  async brakecheck(page, h, { check, stub, a }) {
    for (const seed of String(a.seeds ?? '1,2,3,5,6').split(',').map(Number)) {
      await openRace(h, `race=coast&seed=${seed}&level=1&manual=1&intro=0&traffic=0&police=0${stub}`);
      await h.eval(BUMPS);
      for (let i = 0; i < 200; i++) {
        await h.eval(`window.__runHuman(6, ${DT}, 1000, 'passive')`);
        const n = await h.eval(`(() => { const s = window.__br.session(), p = s.player; return s.riders.filter((r) => !r.isPlayer && r.mode === 'racing'
          && p.s - r.s > 1.5 && p.s - r.s < 12 && Math.abs(r.x - p.x) < 1.2).length; })()`);
        if (n >= 1 && (await h.eval('window.__br.session().time')) > 12) break;
      }
      const t0 = await h.eval('window.__br.session().time');
      await h.eval('window.__throttle = 0; window.__brake = 1');
      await h.eval(`window.__runHuman(72, ${DT}, 1000, 'passive')`);
      await h.eval('window.__throttle = 1; window.__brake = 0');
      const bumps = (await h.eval('window.__bumps')).filter((b) => b.t >= t0);
      check(`brakecheck seed ${seed}: riders behind a braking player do not ram it`, bumps.every((b) => b.k <= 5),
        { t0: +t0.toFixed(1), bumps: fmt(bumps, await h.eval(CHARS)) });
    }
  },
};
