// combat-check --soak: the SP economy over full races. Autopilot rides; on top an aggressive scripted player
// mashes J/L whenever a rival is in reach, fires U/I/O whenever they would land and P as soon as SP is full
// (harsher than a human). Per race it asserts at most two SHOWTIMEs, the first not before SOAK.firstCast s,
// no place lost while a cast is in the air, and no combat errors; it prints KOs (hand / SHOWTIME), SP earned
// and the achievements a fresh profile unlocked (summed over the races, like a player's first evening).
//   node tools/combat-check.mjs --soak [--tracks coast,city,mountain] [--seed 3] [--stub audio]
import { withPage } from '../lib.mjs';

const SOAK = { maxCasts: 2, firstCast: 35, frames: 16000, dt: 1 / 60 };

/** Page side: the bot and the per-race record on window.__soak. */
function install() {
  const br = window.__br, bus = br.app.bus;
  const S = () => br.session();
  const REACH = { none: 1.9, saltfish: 2.2, baguette: 2.6, pan: 2.0, leek: 2.5, umbrella: 2.4, selfie: 3.0, slipper: 2.0, keyboard: 2.3 };
  const st = { cur: null, last: { swing: -9, skill: -9, ult: -9 }, sp: 0 };
  window.__soak = st;
  const me = (id) => id === S()?.player.id;
  const t = () => S()?.time ?? 0;
  st.begin = () => { st.cur = { casts: [], kos: { hand: 0, ult: 0 }, earned: 0, ach: [], results: null }; st.sp = S().player.sp; };
  bus.on('ult:start', ({ riderId }) => { if (st.cur && me(riderId)) st.cur.casts.push({ t: +t().toFixed(1), place: S().player.place, worst: S().player.place, air: true }); });
  bus.on('ult:impact', ({ riderId }) => { const c = st.cur?.casts.at(-1); if (c && me(riderId)) c.air = false; });
  bus.on('combat:ko', ({ attacker, skillId }) => { if (st.cur && me(attacker)) st.cur.kos[skillId === 'pelican.ult' ? 'ult' : 'hand']++; });
  bus.on('achievement:unlock', ({ id }) => st.cur?.ach.push(id));
  bus.on('race:end', ({ results }) => { if (st.cur) st.cur.results = results.find((r) => r.isPlayer) ?? null; });
  const bot = () => {
    const s = S();
    if (!s || s.phase !== 'racing' || !st.cur) return;
    const p = s.player, now = br.app.clock.realTime;
    st.cur.earned += Math.max(0, p.sp - st.sp);
    st.sp = p.sp;
    const c = st.cur.casts.at(-1);
    if (c?.air) c.worst = Math.max(c.worst, p.place);
    if (p.mode !== 'racing') return;
    const rivals = s.riders.filter((o) => o !== p && o.mode === 'racing');
    if (now - st.last.swing > 0.14) {
      let side = 0;
      for (const o of rivals) {
        const ds = o.s - p.s, dx = o.x - p.x;
        if (Math.abs(ds) < 1.5 && Math.abs(dx) > 0.45 && Math.abs(dx) < (REACH[p.weapon] ?? 2)) side = dx < 0 ? -1 : 1;
      }
      if (side) { br.press(side < 0 ? 'attackL' : 'attackR'); st.last.swing = now; }
    }
    if (now - st.last.skill > 0.3) {
      const ahead = (lo, hi, w) => rivals.some((o) => { const ds = o.s - p.s; return ds > lo && ds < hi && Math.abs(o.x - p.x) < w(ds); });
      const fire = (k) => { br.press(k); st.last.skill = now; };
      if (p.cooldowns[0] <= 0 && ahead(5, 60, (ds) => ds * 0.45)) fire('skill1');
      else if (p.cooldowns[1] <= 0 && rivals.some((o) => Math.hypot(o.s - p.s, o.x - p.x) < 2.6)) fire('skill2');
      else if (p.cooldowns[2] <= 0 && ahead(2, 15, () => 2.5)) fire('skill3');
    }
    if (p.sp >= 100 && now - st.last.ult > 0.5) { br.press('ult'); st.last.ult = now; }
  };
  st.run = (n, dt) => {
    for (let i = 0; i < n && !st.cur?.results; i++) { bot(); br.step(1, dt); }
    return Boolean(st.cur?.results);
  };
  return true;
}

export async function runSoak(a) {
  const tracks = String(a.tracks ?? 'coast,city,mountain').split(',');
  const seed = Number(a.seed ?? 3);
  const stub = typeof a.stub === 'string' ? `&stub=${a.stub}` : '&stub=audio';
  const fails = [];
  const fail = (msg) => { fails.push(msg); console.log(`FAIL  ${msg}`); };
  await withPage(async (page, h) => {
    await h.goto(`/?race=${tracks[0]}&seed=${seed}&autopilot=1&manual=1${stub}`);
    await page.evaluate(install);
    await h.eval('window.__br.ach && (window.__br.ach.allowAutopilot(true), window.__br.ach.forget())');
    const unlocked = [];
    for (const [i, trackId] of tracks.entries()) {
      await page.evaluate(([id, sd]) => window.__br.start({ trackId: id, seed: sd }), [trackId, seed + i]);
      await page.evaluate((dt) => { const br = window.__br; for (let k = 0; k < 900 && br.session().phase !== 'racing'; k++) br.step(1, dt); window.__soak.begin(); }, SOAK.dt);
      let done = false;
      for (let f = 0; !done && f < SOAK.frames; f += 600) done = await page.evaluate(([n, dt]) => window.__soak.run(n, dt), [600, SOAK.dt]);
      const r = await page.evaluate(() => window.__soak.cur);
      unlocked.push(...r.ach);
      const lost = r.casts.filter((c) => c.worst > c.place);
      console.log(`${trackId} seed ${seed + i}: ${done ? `place ${r.results?.place}` : 'NOT ENDED'} · SHOWTIME ×${r.casts.length} at ${r.casts.map((c) => c.t).join(' / ') || '-'} s`
        + ` · KOs ${r.kos.hand} hand + ${r.kos.ult} SHOWTIME · SP earned ${Math.round(r.earned)} · achievements ${r.ach.length} (${r.ach.join(' ')})`);
      if (!done) fail(`${trackId}: the race did not end`);
      if (r.casts.length > SOAK.maxCasts) fail(`${trackId}: ${r.casts.length} SHOWTIMEs (max ${SOAK.maxCasts})`);
      if (r.casts.length && r.casts[0].t < SOAK.firstCast) fail(`${trackId}: first SHOWTIME at ${r.casts[0].t} s (< ${SOAK.firstCast} s)`);
      if (lost.length) fail(`${trackId}: places lost in the air ${lost.map((c) => `${c.place}→${c.worst}`).join(' ')}`);
    }
    console.log(`achievements over ${tracks.length} races (fresh profile): ${unlocked.length}`);
    const all = await h.errors();
    const errors = all.filter((e) => /\/src\/gameplay\/(combat|achievements)|\[(combat|modules)\]/.test(e));
    console.log(`console errors: ${all.length}${all.length ? ` (${all.slice(0, 2).map((e) => e.slice(0, 140)).join(' | ')})` : ''}`);
    if (errors.length) fail(`combat / achievement errors: ${errors.slice(0, 3).join(' | ')}`);
  });
  console.log(fails.length ? `\nSOAK FAILED (${fails.length})` : '\nSOAK OK');
  return fails.length === 0;
}
