#!/usr/bin/env node
// r4 acceptance: w2-police (SPEC §14 Police 2.0). Lead-owned, read-only for workers. Drives heat with
// __br.race.setHeat and reads __br.race.police() + bus events.   node tools/r4/w2-police.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const RIDE = { throttle: 0.75 };

/** Step 2 frames at a time until `pred(events)` or `frames` run out; returns the matching events. */
async function until(page, controls, frames, pred) {
  for (let i = 0; i < frames; i += 2) {
    await hold(page, controls, 2);
    const ev = await events(page);
    if (pred(ev)) return ev;
  }
  return events(page);
}

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3, extra: '&traffic=0&police=1' });
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 600 + r.id * 12, 0); });
  await capture(page, ['police:wanted', 'police:windup', 'police:swing', 'npc:strike', 'npc:hit', 'police:bribe', 'police:hurt',
    'police:down', 'police:roadblock', 'police:busted', 'npc:say', 'rider:crash']);
  const heat = (v) => page.evaluate((x) => window.__br.race.setHeat(x), v);
  const summary = () => page.evaluate(() => window.__br.race.police());
  const lastWanted = (ev) => ev.filter((x) => x.n === 'police:wanted').map((x) => x.e.level).pop();

  // 1. heat 0.55 → wanted ★1: the corgi comes, whistles, never swings a baton
  await heat(0.55);
  let ev = await until(page, RIDE, 480, (e) => e.some((x) => x.n === 'police:wanted' && x.e.level === 1));
  expect(lastWanted(ev) === 1, `heat 0.55 → police:wanted level 1 (${JSON.stringify(ev.filter((x) => x.n === 'police:wanted').map((x) => x.e))})`);
  await hold(page, RIDE, 360);
  expect(!(await events(page, 'police:windup')).length, '★1: no baton wind-ups');

  // 2. heat 0.8 → ★2: a baton wind-up (~0.45 s) then a swing; a hit is an npc:strike combat answers
  await page.evaluate(() => { window.__br.session().player.hp = window.__br.session().player.maxHp; });
  await heat(0.8);
  ev = await until(page, RIDE, 900, (e) => e.some((x) => x.n === 'police:swing'));
  expect(lastWanted(ev) === 2, `heat 0.8 → police:wanted level 2 (${lastWanted(ev)})`);
  const wind = ev.find((x) => x.n === 'police:windup');
  expect(!!wind && wind.e.riderId === 0 && wind.e.obstacleId >= 900 && wind.e.time >= 0.3 && wind.e.time <= 0.5, `★2: police:windup at the player (${JSON.stringify(wind?.e)})`);
  const swing = ev.find((x) => x.n === 'police:swing');
  expect(!!swing && !!wind && swing.t - wind.t >= wind.e.time - 0.05 && swing.t - wind.t <= wind.e.time + 0.1, `★2: the swing comes when the wind-up ends (${swing ? (swing.t - wind.t).toFixed(2) : '-'} s)`);
  await hold(page, RIDE, 6);
  ev = await events(page);
  const strikes = ev.filter((x) => x.n === 'npc:strike');
  const hits = ev.filter((x) => x.n === 'police:swing' && x.e.hit);
  expect(hits.length === strikes.length && strikes.every((x) => x.e.victim === 0 && x.e.weapon === 'baton' && x.e.cause === 'police' && x.e.damage === 10),
    `★2: every swing that hits sends npc:strike {damage 10, baton, police} (${hits.length} hits, ${strikes.length} strikes)`);

  // 3. dodge: brake hard when a wind-up starts → that swing misses, no strike
  await clearEvents(page);
  ev = await until(page, RIDE, 900, (e) => e.some((x) => x.n === 'police:windup'));
  await hold(page, { throttle: 0, brake: 1 }, 40);
  ev = await events(page);
  const dodge = ev.filter((x) => x.n === 'police:swing');
  expect(dodge.length >= 1 && dodge.every((x) => !x.e.hit) && !ev.some((x) => x.n === 'npc:strike'), `dodge: braking out of reach makes the swing miss (${JSON.stringify(dodge.map((x) => x.e.hit))})`);

  // 4. 「V我50」: bell next to the corgi at ★2 with 120 race coins → accepted, −50, the chase ends
  await clearEvents(page);
  await page.evaluate(() => { window.__br.session().player.coins = 120; });
  const near = async () => { const s = await summary(); return s && Math.abs(s.gap) < 4 && s.mode === 'chase'; };
  for (let i = 0; i < 300 && !(await near()); i++) await hold(page, RIDE, 3);
  await page.evaluate(() => window.__br.press('bell'));
  ev = await until(page, RIDE, 60, (e) => e.some((x) => x.n === 'police:bribe'));
  const bribe = ev.find((x) => x.n === 'police:bribe');
  const coins = await page.evaluate(() => window.__br.session().player.coins);
  expect(!!bribe && bribe.e.accepted && bribe.e.amount === 50 && coins === 70, `V我50 at ★2: accepted, 120 → ${coins} coins (${JSON.stringify(bribe?.e)})`);
  await hold(page, RIDE, 240);
  const after = await summary();
  const wantedNow = lastWanted(await events(page));
  expect(after && after.mode !== 'chase' && after.heat <= 0.2 && wantedNow === 0, `after the bribe: no chase, heat ${after?.heat}, wanted ${wantedNow} (${after?.mode})`);

  // 5. ★3: refused bribe, a backup corgi (901), a roadblock with a 3 m gap ahead
  await clearEvents(page);
  await hold(page, RIDE, 1900); // the 30 s no-chase window after a bribe
  await page.evaluate(() => { window.__br.session().player.coins = 120; });
  await heat(0.97);
  ev = await until(page, RIDE, 1500, (e) => e.some((x) => x.n === 'police:roadblock'));
  expect(lastWanted(ev) === 3, `heat 0.97 → police:wanted level 3 (${lastWanted(ev)})`);
  const backup = await page.evaluate(() => window.__br.session().obstacles.some((o) => o.id === 901 && o.active));
  expect(backup, '★3: a backup corgi (obstacle 901) is out');
  const rb = ev.find((x) => x.n === 'police:roadblock');
  expect(!!rb && rb.e.gapWidth >= 3, `★3: police:roadblock with a gap ≥ 3 m (${JSON.stringify(rb?.e)})`);
  if (rb) {
    const geo = await page.evaluate((s) => {
      const ss = window.__br.session(), b = ss.track.bounds(s);
      const bars = ss.obstacles.filter((o) => o.kind === 'barrier' && o.active && Math.abs(o.s - s) < 6).map((o) => [o.x - o.halfWidth, o.x + o.halfWidth]).sort((a, c) => a[0] - c[0]);
      let gap = 0, x = -b.left;
      for (const [x0, x1] of bars) { gap = Math.max(gap, x0 - x); x = Math.max(x, x1); }
      gap = Math.max(gap, b.right - x);
      return { n: bars.length, gap, solid: ss.obstacles.filter((o) => o.kind === 'barrier' && Math.abs(o.s - s) < 6).every((o) => o.solid) };
    }, rb.e.s);
    expect(geo.n >= 2 && geo.solid && geo.gap >= 3 && geo.gap <= 4.5, `★3: solid barriers across the road leave one ~3.2 m gap (${geo.n} barriers, widest gap ${geo.gap.toFixed(2)} m)`);
  }
  await clearEvents(page);
  for (let i = 0; i < 300 && !(await near()); i++) await hold(page, RIDE, 3);
  await page.evaluate(() => window.__br.press('bell'));
  ev = await until(page, RIDE, 60, (e) => e.some((x) => x.n === 'police:bribe'));
  const refused = ev.find((x) => x.n === 'police:bribe');
  expect(!!refused && !refused.e.accepted && (await page.evaluate(() => window.__br.session().player.coins)) === 120, `★3: the bribe is refused, coins kept (${JSON.stringify(refused?.e)})`);

  // 6. fight back: hurt events, then the corgi goes down (r6: officer HP is 40, read it from the summary)
  await clearEvents(page);
  const hp0 = await page.evaluate(() => window.__br.race.police()?.hp ?? 0);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__br.app.bus.emit('combat:obstacleHit', { obstacleId: 900, attacker: 0, weapon: 'pan', damage: 35, thrown: true, pos: { x: 0, y: 1, z: 0 } }));
    await hold(page, RIDE, 10);
  }
  ev = await events(page);
  const hurt = ev.filter((x) => x.n === 'police:hurt').map((x) => x.e.hp);
  expect(hurt.length === 2 && hurt[0] === Math.max(0, hp0 - 35) && hurt[1] === 0, `the corgi takes 35 + 35 of its ${hp0} HP (${JSON.stringify(hurt)})`);
  expect(ev.some((x) => x.n === 'police:down' && x.e.obstacleId === 900 && x.e.attacker === 0), 'police:down when its HP is gone');
  await noErrors(h, 'police');
}, { size: '1280x720' });

finish('w2-police');
