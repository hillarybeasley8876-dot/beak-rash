#!/usr/bin/env node
// r4 acceptance: w2-rivals (SPEC §18 rivalry / nemesis / alliances; §15 AI throws; §16 AI tricks). Lead-owned,
// read-only for workers.   node tools/r4/w2-rivals.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, withPage } from './accept-lib.mjs';

const C = { throttle: 1 };
const FIELD = 'goose,cat,shiba,pigeon,penguin,seagull,sloth';

/** Fresh page with a given save, a manual race on coast with the given field, stepped to GO. */
async function start(page, h, save, extra = '', names = null) {
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('beak-rash.save.v1', JSON.stringify(s)); }, save);
  await h.goto(`/?race=coast&seed=5&manual=1&traffic=0&police=0&rivals=${FIELD}${extra}`);
  await page.evaluate(() => window.__br.manual(true));
  if (names) await capture(page, names); // listen from the intro on (announcements come before or at GO)
  await page.evaluate(() => { const b = window.__br; for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30); });
}
const idOf = (page, c) => page.evaluate((ch) => window.__br.session().riders.find((r) => r.character === ch)?.id ?? -1, c);
/** Drive the player over the line; returns once race:end fired (max ~90 s of sim). */
async function finishRace(page) {
  await page.evaluate(() => { const b = window.__br, s = b.session(); b.teleport(0, s.track.length - 30, 0); s.player.speed = 18; });
  for (let i = 0; i < 90; i++) {
    const done = await page.evaluate(() => { window.__br.setControls({ throttle: 1 }); window.__br.step(60); return (window.__ev ?? []).some((x) => x.n === 'race:end'); });
    if (done) return true;
  }
  return false;
}

await withPage(async (page, h) => {
  await h.goto('/?screen=title');

  // 1. grudges are kept in the save: a KO raises it, others in the race cool off, absent species cool more
  await start(page, h, { rivalry: { cat: 40, capybara: 30 } });
  await capture(page, ['race:end', 'race:nemesis', 'race:nemesisDown', 'race:alliance', 'combat:throw', 'rider:trick']);
  const shiba = await idOf(page, 'shiba');
  await page.evaluate((id) => window.__br.ko(id, 0), shiba);
  await hold(page, C, 30);
  const ended = await finishRace(page);
  let rv = await page.evaluate(() => window.__br.app.save.data.rivalry);
  expect(ended, 'the race ends after the player crosses the line');
  expect(rv.shiba === 22, `a KO by the player: shiba 0 + 25 − 3 = 22 (${rv.shiba})`);
  expect(rv.cat === 37, `in the race, untouched: cat 40 − 3 = 37 (${rv.cat})`);
  expect(rv.capybara === 22, `not in the race: capybara 30 − 8 = 22 (${rv.capybara})`);

  // 2. the nemesis: biggest grudge ≥ 50 in the field; intro event; KO pays 150 and resets the grudge to 20
  await start(page, h, { rivalry: { goose: 80, cat: 55 } }, '', ['race:end', 'race:nemesis', 'race:nemesisDown', 'race:alliance', 'combat:throw', 'rider:trick']);
  const cfg = await page.evaluate(() => window.__br.session().config.nemesis);
  const goose = await idOf(page, 'goose');
  let ev = await events(page, 'race:nemesis');
  expect(cfg === 'goose', `RaceConfig.nemesis = goose (${cfg})`);
  expect(ev.length === 1 && ev[0].e.riderId === goose && ev[0].e.character === 'goose' && ev[0].e.grudge === 80, `race:nemesis at the intro (${JSON.stringify(ev.map((x) => x.e))})`);
  const coins0 = await page.evaluate(() => window.__br.session().player.coins);
  await page.evaluate((id) => window.__br.ko(id, 0), goose);
  await hold(page, C, 30);
  ev = await events(page, 'race:nemesisDown');
  const coins1 = await page.evaluate(() => window.__br.session().player.coins);
  expect(ev.length === 1 && ev[0].e.riderId === goose && ev[0].e.attacker === 0 && ev[0].e.bonus === 150, `race:nemesisDown on the KO (${JSON.stringify(ev.map((x) => x.e))})`);
  expect(coins1 - coins0 >= 150, `the nemesis bounty: +150 小鱼干 (${coins0} → ${coins1})`);
  await finishRace(page);
  rv = await page.evaluate(() => window.__br.app.save.data.rivalry);
  expect(rv.goose === 20, `the nemesis grudge resets to 20 after the KO (${rv.goose})`);

  // 3. an alliance against a runaway leader (3 rivals 112–118 m behind at 20 m/s: lead ≈ 5.6 s); friendly fire breaks it
  await start(page, h, null);
  await capture(page, ['race:alliance', 'combat:throw', 'rider:trick']);
  await page.evaluate(() => { const b = window.__br, s = b.session(), base = s.player.s; b.teleport(0, base + 260, 0); const rs = s.riders.filter((r) => !r.isPlayer); rs.forEach((r, i) => b.teleport(r.id, base + (i < 3 ? 260 - 112 - i * 3 : 0), (i % 3) - 1)); s.player.speed = 20; });
  for (let i = 0; i < 30 && !(await events(page, 'race:alliance')).length; i++) await hold(page, C, 30);
  ev = await events(page, 'race:alliance');
  const form = ev.find((x) => x.e.phase === 'form');
  expect(!!form && form.e.target === 0 && form.e.members.length >= 2 && form.e.members.length <= 3 && form.e.reason === 'leader', `a big lead → race:alliance form against the player (${JSON.stringify(form?.e)})`);
  if (form) {
    const [a, b] = form.e.members;
    await page.evaluate(([x, y]) => window.__br.app.bus.emit('combat:hit', { attacker: x, victim: y, damage: 5, side: 1, weapon: 'none', heavy: false, crit: false, blocked: false, pos: { x: 0, y: 1, z: 0 }, skillId: null }), [a, b]);
    await hold(page, C, 10);
    ev = await events(page, 'race:alliance');
    expect(ev.some((x) => x.e.phase === 'break' && x.e.reason === 'betrayal'), `friendly fire breaks it: 塑料友谊 (${JSON.stringify(ev.map((x) => [x.e.phase, x.e.reason]))})`);
  }

  // 4. rivals throw: armed rivals 10–20 m behind the player
  await start(page, h, null);
  await capture(page, ['combat:throw', 'rider:trick']);
  const rivals = await page.evaluate(() => window.__br.session().riders.filter((r) => !r.isPlayer).map((r) => r.id));
  await page.evaluate((list) => { const b = window.__br, s = b.session(), p = s.player; list.forEach((id, i) => { b.teleport(id, p.s + (i < 4 ? -10 - i * 3 : 300), (i % 2) * 2 - 1); b.combat.give(id, 'pan', 6); }); }, rivals);
  for (let i = 0; i < 40 && !(await events(page, 'combat:throw')).some((x) => x.e.riderId !== 0); i++) await hold(page, { throttle: 0.7 }, 30);
  const throws = (await events(page, 'combat:throw')).filter((x) => x.e.riderId !== 0);
  expect(throws.length >= 1, `armed rivals throw at the player within 20 s (${throws.length} throws)`);

  // 5. show-off species trick on big airs, the goose never does
  await clearEvents(page);
  const air = async (ch, n) => {
    const id = await idOf(page, ch);
    let tricks = 0;
    for (let i = 0; i < n; i++) {
      await page.evaluate((x) => { const r = window.__br.session().rider(x); r.y = 0.1; r.vy = 8; }, id);
      await hold(page, { throttle: 0.7 }, 75);
      tricks = (await events(page, 'rider:trick')).filter((x) => x.e.riderId === id && x.e.phase === 'start').length;
    }
    return tricks;
  };
  const catTricks = await air('cat', 15);
  const gooseTricks = await air('goose', 10);
  expect(catTricks >= 2, `the cat (show-off) tricks on big airs (${catTricks} of 15)`);
  expect(gooseTricks === 0, `the goose never tricks (${gooseTricks} of 10)`);
  await noErrors(h, 'rivals');
}, { size: '1280x720' });

finish('w2-rivals');
