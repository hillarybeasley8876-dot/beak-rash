#!/usr/bin/env node
// r5 acceptance: records (every achievement's full description can be read, with the keyboard / pad as well as the
// mouse; the pause sheet names the r4 actions). Lead-owned, read-only for workers.
// Before r5: 71 achievements in one-line cells, most descriptions cut with "…" and only readable in a mouse tooltip.
//   node tools/r5/records.mjs
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const STUB = '&stub=world,sim,camera,actors,combat,race,fx,audio';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const size of ['1280x720', '1920x1080']) {
  await withPage(async (page, h) => {
    await h.goto(`/?screen=menu${STUB}`);
    await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'menu', null, { timeout: 30000 });
    const cat = await page.evaluate(async () => (await import('/src/data/achievements.ts')).ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc })));
    await page.evaluate(() => window.__br.app.save.update((d) => { d.achievements = ['first_win', 'podium', 'backflip', 'bribe']; }));
    await page.evaluate(() => window.__br.app.ui.show('career'));
    await page.waitForFunction(() => window.__br.app.ui.screen === 'career', null, { timeout: 30000 });
    await sleep(1200);
    await page.keyboard.press('Tab');
    await sleep(900);
    const cells = await page.evaluate(() => [...document.querySelectorAll('[data-ach]')].map((e) => e.getAttribute('data-ach')));
    expect(cells.length === cat.length && cells.every((id, i) => id === cat[i].id), `every achievement has a cell with data-ach in catalogue order (${cells.length}/${cat.length})`);
    const detail = () => page.evaluate(() => {
      const d = document.querySelector('[data-ach-detail]');
      const f = document.querySelector('[data-ach].is-focus');
      return { text: d?.textContent ?? null, focus: f?.getAttribute('data-ach') ?? null, visible: !!d && d.getBoundingClientRect().width > 0 };
    });
    let d = await detail();
    expect(d.visible && d.focus === cat[0].id && d.text.includes(cat[0].desc), `the sheet opens with the first achievement focused and its full description in [data-ach-detail] (${d.focus}: ${d.text?.slice(0, 40)})`);
    // walk with the arrow keys: right, then down
    await page.keyboard.press('ArrowRight'); await sleep(150);
    d = await detail();
    expect(d.focus === cat[1].id && d.text.includes(cat[1].desc) && d.text.includes(cat[1].name), `→ moves the focus to the next achievement and shows its name + full description (${d.focus})`);
    await page.keyboard.press('ArrowDown'); await sleep(150);
    d = await detail();
    const idx = cat.findIndex((a) => a.id === d.focus);
    expect(idx > 1 && d.text.includes(cat[idx].desc), `↓ moves down a row (${d.focus}, index ${idx})`);
    // every description reachable: walk the whole sheet with → and collect the details
    const seen = new Set();
    for (let i = 0; i < cat.length + 2; i++) {
      d = await detail();
      const a = cat.find((x) => x.id === d.focus);
      if (a && d.text.includes(a.desc)) seen.add(a.id);
      await page.keyboard.press('ArrowRight');
      await sleep(40);
    }
    expect(seen.size === cat.length, `walking with → reaches every achievement with its full description (${seen.size}/${cat.length})`);
    // locked vs earned in the detail
    await page.evaluate(() => document.querySelector('[data-ach="backflip"]')?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
    await page.evaluate(() => document.querySelector('[data-ach="backflip"]')?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })));
    await sleep(200);
    d = await detail();
    expect(d.focus === 'backflip' && /已解锁|达成|EARNED|✓/.test(d.text), `hovering a cell focuses it; an earned one says so (${d.text?.slice(0, 50)})`);
    // the sheet still closes with Tab / Esc and the career screen keeps working
    await page.keyboard.press('Escape'); await sleep(500);
    const open = await page.evaluate(() => !!document.querySelector('[data-ach-detail]') && document.querySelector('[data-ach-detail]').getBoundingClientRect().width > 0);
    const screen = await page.evaluate(() => window.__br.app.ui.screen);
    expect(!open && screen === 'career', `Esc closes the sheet and stays on the career screen (${screen})`);
    // everything on screen
    await page.keyboard.press('Tab'); await sleep(900);
    const off = await page.evaluate(() => [...document.querySelectorAll('[data-ach], [data-ach-detail], [data-egg]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1); }).length);
    expect(off === 0, `${size}: every cell, the detail and the egg column are on screen (${off} off)`);
    await noErrors(h, `records ${size}`);
  }, { size });
}

// the pause sheet names the r4 actions
await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=3&traffic=0&police=0');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__br.session()?.phase === 'racing', null, { timeout: 60000 });
  await sleep(1500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__br.app.ui.screen === 'pause', null, { timeout: 15000 });
  await sleep(600);
  const keys = await page.evaluate(() => document.querySelector('.br-pz-keys')?.textContent ?? '');
  expect(/投掷/.test(keys), `the pause controls name the throw (hold K) (${keys.slice(0, 60)})`);
  expect(/特技/.test(keys), 'the pause controls name the air tricks (Shift in the air)');
  expect(/V我50|贿/.test(keys), 'the pause controls name the bell bribe');
  const fits = await page.evaluate(() => { const r = document.querySelector('.br-pz-keys')?.getBoundingClientRect(); return !!r && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; });
  expect(fits, 'the pause controls sheet fits the screen');
  await noErrors(h, 'pause sheet');
}, { size: '1280x720' });

finish('r5-records');
