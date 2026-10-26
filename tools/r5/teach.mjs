#!/usr/bin/env node
// r5 acceptance: teach (the r4 mechanics are explained: a HOW TO tab, loading tips, first-time in-race hints).
// Lead-owned, read-only for workers.
//   node tools/r5/teach.mjs
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = [
  ['tricks', /空翻|转体|特技/], ['throw', /投掷|扔/], ['parry', /弹反|格挡|当！/], ['police', /警棍|通缉/],
  ['bribe', /V我50/], ['style', /STYLE/], ['nemesis', /宿敌/], ['alliance', /围剿/],
];

// 1. HOW TO: a tab for the new mechanics, every one of them explained (keyboard keys and pad buttons named)
await withPage(async (page, h) => {
  await h.goto('/?screen=howto');
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'howto', null, { timeout: 30000 });
  await sleep(800);
  const info = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.br-ht-tab')].map((t) => t.textContent ?? ''),
    pages: [...document.querySelectorAll('.br-ht-body > *')].map((p) => p.textContent ?? ''),
  }));
  const tab = info.tabs.findIndex((t) => /新玩法|NEW/.test(t));
  expect(tab >= 0 && info.tabs.length >= 4, `a HOW TO tab for the new mechanics (${info.tabs.join(' | ')})`);
  const text = tab >= 0 ? (info.pages[tab] ?? '') : '';
  for (const [name, re] of KEYS) expect(re.test(text), `the new-mechanics tab explains ${name} (${re})`);
  expect(/SHIFT|Shift/.test(text) && /RB/.test(text), 'it names the keyboard key (Shift) and the pad button (RB) for tricks');
  // the tab is reachable with → and fits the screen
  for (let i = 0; i < tab; i++) { await page.keyboard.press('ArrowRight'); await sleep(200); }
  const fits = await page.evaluate((i) => {
    const p = document.querySelectorAll('.br-ht-body > *')[i];
    if (!p || !p.classList.contains('is-on')) return 'not shown';
    const r = p.getBoundingClientRect();
    const out = [...p.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && (q.right > innerWidth + 1 || q.bottom > innerHeight + 1 || q.left < -1); });
    return r.width > 0 ? (out.length ? `${out.length} elements off screen` : 'ok') : 'empty';
  }, tab);
  expect(fits === 'ok', `→ shows the tab and everything on it is on screen at 1280×720 (${fits})`);
  await noErrors(h, 'howto');
}, { size: '1280x720' });

// 2. Loading tips: the new mechanics are in the rotation (keyboard and pad wording)
await withPage(async (page, h) => {
  await h.goto('/?screen=menu');
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'menu', null, { timeout: 30000 });
  const tips = await page.evaluate(async () => {
    const m = await import('/src/data/tips.ts');
    return { tips: m.TIPS, pad: Object.values(m.PAD_TIPS) };
  });
  const r4 = /空翻|转体|特技|投掷|弹反|格挡|STYLE|V我50|宿敌|围剿|通缉|警棍|路障|鹅群|鱼车|彩蛋|反向|随机路线|天气|小黄鸭/;
  const n = tips.tips.filter((t) => r4.test(t)).length;
  const np = tips.pad.filter((t) => r4.test(t)).length;
  expect(n >= 10, `at least 10 loading tips about the new mechanics (${n})`);
  expect(np >= 4, `the pad wording covers the new tips that name keys (${np})`);
  await noErrors(h, 'tips');
}, { size: '1280x720' });

// 3. First-time hints in a race: a big air → the trick prompt; the baton wind-up → dodge / parry; wanted with coins → bribe
await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=3&manual=1&traffic=0&police=0');
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/hint/i.test(k)) localStorage.removeItem(k); });
  await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30); });
  const hintOn = (id) => page.evaluate((x) => { const e = document.querySelector(`[data-hint="${x}"]`); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0'; }, id);
  // the biggest jump of the coast, taken straight at 22 m/s: the prompt shows while the player is in the air
  const seen = await page.evaluate(async () => {
    const b = window.__br, s = b.session(), p = s.player, t = s.track;
    for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, Math.min(t.length - 5, p.s + 900), 0);
    const f = t.features.filter((x) => (x.kind === 'ramp' || x.kind === 'jumpCrest') && x.s0 > 100).sort((a, c) => a.s0 - c.s0)[0];
    b.teleport(p.id, f.s0 - 60, (f.x0 + f.x1) / 2);
    p.speed = 22;
    b.setControls({ throttle: 1 });
    let shown = false;
    for (let k = 0; k < 200 && p.s < f.s1 + 60; k++) {
      b.step(2);
      await new Promise((r) => requestAnimationFrame(() => r()));
      if (p.airborne) { const e = document.querySelector('[data-hint="trick"]'); if (e && e.getBoundingClientRect().width > 0) shown = true; }
    }
    return shown;
  });
  expect(seen, 'a big air shows the trick prompt (data-hint="trick") while the player is airborne');
  const remembered = await page.evaluate(() => Object.keys(localStorage).some((k) => /hint/i.test(k) && /trick/i.test(k + localStorage.getItem(k))));
  expect(remembered, 'the trick prompt is remembered in localStorage (shown a limited number of times per profile)');
  // the corgi winds up at the player
  await page.evaluate(() => { const b = window.__br; b.app.bus.emit('police:windup', { riderId: 0, obstacleId: 900, side: 1, pos: { x: 0, y: 1, z: 0 }, time: 0.45 }); b.step(6); });
  await sleep(300);
  expect(await hintOn('baton'), 'the first baton wind-up shows the dodge / parry prompt (data-hint="baton")');
  const batonText = await page.evaluate(() => document.querySelector('[data-hint="baton"]')?.textContent ?? '');
  expect(/刹|躲|闪/.test(batonText) && /弹反|格挡|锅/.test(batonText), `it says how: brake / dodge, or parry with the pan (${batonText})`);
  // wanted ★1 with 120 coins: the bribe prompt
  await page.evaluate(() => { const b = window.__br, p = b.session().player; p.coins = 120; b.app.bus.emit('police:wanted', { riderId: 0, level: 1, prev: 0 }); b.step(6); });
  await sleep(300);
  for (let i = 0; i < 8 && !(await hintOn('bribe')); i++) { await page.evaluate(() => window.__br.step(30)); await sleep(150); }
  expect(await hintOn('bribe'), 'wanted with ≥ 50 coins shows the 「V我50」 prompt (data-hint="bribe")');
  const bribeText = await page.evaluate(() => document.querySelector('[data-hint="bribe"]')?.textContent ?? '');
  expect(/V我50/.test(bribeText) && /铃/.test(bribeText), `it says: ring the bell next to the corgi (${bribeText})`);
  await noErrors(h, 'hints');
}, { size: '1280x720' });

finish('r5-teach');
