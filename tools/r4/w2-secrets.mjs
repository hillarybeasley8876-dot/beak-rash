#!/usr/bin/env node
// r4 acceptance: w2-secrets (SPEC §21 easter eggs). Lead-owned, read-only for workers. Uses the secrets module's debug
// hook `window.__br.secrets = { list(), forceGod(), godPlanned() }` (required by the brief).   node tools/r4/w2-secrets.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, withPage } from './accept-lib.mjs';

const C = { throttle: 0.8 };
const DUCKS = ['duck_coast', 'duck_city', 'duck_mountain', 'duck_watertown', 'duck_gobi'];

async function start(page, h, { save = null, rivals = 'goose,cat,shiba,pigeon,penguin,seagull,sloth', seed = 3, track = 'coast' } = {}) {
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('beak-rash.save.v1', JSON.stringify(s)); }, save);
  await h.goto(`/?race=${track}&seed=${seed}&manual=1&traffic=0&police=0&rivals=${rivals}`);
  await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30); });
}
const save = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__br.app.save.data)));

await withPage(async (page, h) => {
  await h.goto('/?screen=title');
  await start(page, h);
  if (!expect(await page.evaluate(() => typeof window.__br.secrets?.list === 'function'), 'the secrets module exposes window.__br.secrets.list()')) return;
  await capture(page, ['secret:found', 'taunt']);

  // 1. the coast duck: ride into it → found once, saved, a toast
  const list = await page.evaluate(() => window.__br.secrets.list());
  const duck = list.find((x) => x.id === 'duck_coast');
  expect(!!duck && Number.isFinite(duck.s) && Number.isFinite(duck.x), `the coast has its rubber duck (${JSON.stringify(duck)})`);
  if (duck) {
    const ok = await page.evaluate((d) => { const b = window.__br, s = b.session(), bd = s.track.bounds(d.s); return Math.abs(d.x) <= Math.max(bd.left, bd.right) + 0.5; }, duck);
    expect(ok, 'the duck sits where a rider can reach it (inside the drivable bounds)');
    await page.evaluate((d) => { const b = window.__br; b.teleport(0, d.s - 1.5, d.x); b.session().player.speed = 8; }, duck);
    await hold(page, C, 30);
    await page.evaluate((d) => { const b = window.__br; b.teleport(0, d.s - 1.5, d.x); b.session().player.speed = 8; }, duck);
    await hold(page, C, 30);
    const found = (await events(page, 'secret:found')).filter((x) => x.e.id === 'duck_coast');
    const sv = await save(page);
    expect(found.length === 1 && found[0].e.first === true && found[0].e.riderId === 0, `riding into it: one secret:found duck_coast (first) (${found.length})`);
    expect(sv.secrets.includes('duck_coast'), 'saved in SaveData.secrets');
    expect(await page.evaluate(() => document.body.innerText.includes('找到小黄鸭')), 'a 找到小黄鸭 toast');
  }

  // 2. the SVG easel: a THROWN hit finds it (+50 小鱼干); a melee hit does nothing
  const easel = list.find((x) => x.id === 'svg_coast');
  expect(!!easel && typeof easel.obstacleId === 'number', `the coast has its SVG easel as a hittable obstacle (${JSON.stringify(easel)})`);
  if (easel) {
    await clearEvents(page);
    const c0 = await page.evaluate(() => window.__br.session().player.coins);
    await page.evaluate((id) => window.__br.app.bus.emit('combat:obstacleHit', { obstacleId: id, attacker: 0, weapon: 'pan', damage: 18, thrown: false, pos: { x: 0, y: 1, z: 0 } }), easel.obstacleId);
    await hold(page, C, 5);
    expect(!(await events(page, 'secret:found')).length, 'a melee hit on the easel does nothing');
    await page.evaluate((id) => window.__br.app.bus.emit('combat:obstacleHit', { obstacleId: id, attacker: 0, weapon: 'pan', damage: 18, thrown: true, pos: { x: 0, y: 1, z: 0 } }), easel.obstacleId);
    await hold(page, C, 5);
    const c1 = await page.evaluate(() => window.__br.session().player.coins);
    expect((await events(page, 'secret:found')).some((x) => x.e.id === 'svg_coast') && c1 - c0 === 50, `a thrown hit: svg_coast found, +50 小鱼干 (${c0} → ${c1})`);
  }

  // 3. 鹅鹅鹅: three bell presses within 5 s with the goose within 8 m → it goes berserk and recites
  await clearEvents(page);
  const goose = await page.evaluate(() => { const b = window.__br, s = b.session(), g = s.riders.find((r) => r.character === 'goose'); b.teleport(g.id, s.player.s + 3, s.player.x + 2); return g.id; });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__br.press('bell')); await hold(page, C, 30); }
  await hold(page, C, 10);
  const g = await page.evaluate((id) => { const r = window.__br.session().rider(id); return { angry: r.statuses.some((s) => s.id === 'angry'), boost: r.boostTime }; }, goose);
  expect((await events(page, 'secret:found')).some((x) => x.e.id === 'goose_poem'), 'three bells at the goose: goose_poem found');
  expect(g.angry && g.boost > 0, `the goose goes berserk (angry ${g.angry}, boost ${g.boost.toFixed(2)})`);
  expect((await events(page, 'taunt')).some((x) => x.e.riderId === goose && x.e.text.includes('鹅鹅鹅')), 'the goose recites 鹅鹅鹅，曲项向天歌——');

  // 4. the pelican god: forced in this race; a bell while it is on screen → found, +50
  await clearEvents(page);
  await page.evaluate(() => window.__br.secrets.forceGod());
  await hold(page, C, 60);
  const god = await page.evaluate(() => { const o = window.__br.app.scene.getObjectByName('pelican-god'); return !!o && o.visible; });
  expect(god, 'forceGod(): a visible "pelican-god" object in the sky');
  const c2 = await page.evaluate(() => window.__br.session().player.coins);
  await page.evaluate(() => window.__br.press('bell'));
  await hold(page, C, 10);
  const c3 = await page.evaluate(() => window.__br.session().player.coins);
  expect((await events(page, 'secret:found')).some((x) => x.e.id === 'pelican_god') && c3 - c2 >= 50, `a bell under the pelican god: found, +50 (${c2} → ${c3})`);

  // 5. an accepted bribe is recorded as an egg
  await page.evaluate(() => window.__br.app.bus.emit('police:bribe', { riderId: 0, obstacleId: 900, amount: 50, accepted: true }));
  await hold(page, C, 5);
  expect((await save(page)).secrets.includes('bribe'), 'an accepted 「V我50」 bribe is saved as an egg');
  await noErrors(h, 'eggs race 1');

  // 6. the sloth: no pedalling for 8 s after GO → it stops too and says 你也不急？
  await start(page, h, { rivals: 'sloth,cat,shiba,pigeon,penguin,seagull,goose' });
  await capture(page, ['secret:found', 'taunt']);
  await hold(page, { throttle: 0 }, 540);
  expect((await events(page, 'secret:found')).some((x) => x.e.id === 'sloth'), '8 s without pedalling: sloth found');
  expect((await events(page, 'taunt')).some((x) => x.e.character === 'sloth' && x.e.text.includes('你也不急')), 'the sloth: 你也不急？');

  // 7. the fifth duck unlocks the duck rider
  await start(page, h, { save: { secrets: DUCKS.filter((d) => d !== 'duck_coast') } });
  await capture(page, ['secret:found']);
  const d2 = (await page.evaluate(() => window.__br.secrets.list())).find((x) => x.id === 'duck_coast');
  if (d2) {
    await page.evaluate((d) => { const b = window.__br; b.teleport(0, d.s - 1.5, d.x); b.session().player.speed = 8; }, d2);
    await hold(page, C, 40);
  }
  const s5 = await save(page);
  expect(DUCKS.every((d) => s5.secrets.includes(d)) && s5.unlocks.includes('duck'), `all five ducks → unlocks 'duck' (${JSON.stringify(s5.unlocks)})`);

  // 8. the pelican god shows up in roughly 1 race of 15 on coast (seeds 1–30)
  let planned = 0;
  for (let seed = 1; seed <= 30; seed++) {
    await h.goto(`/?race=coast&seed=${seed}&manual=1&traffic=0&police=0`);
    planned += (await page.evaluate(() => window.__br.secrets.godPlanned())) ? 1 : 0;
  }
  expect(planned >= 1 && planned <= 5, `pelican god planned in ${planned} of 30 coast races (~2 expected)`);
  await noErrors(h, 'eggs');
}, { size: '1280x720' });

finish('w2-secrets');
