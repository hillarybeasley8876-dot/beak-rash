#!/usr/bin/env node
// Input regression checks (ui-screens fix rounds 1-2): confirm modal with Space / pad A / pad B, results
// ignore finish-line mashing (Space 180 / 450 ms, fake pad B 220 ms), back keys never leave the title,
// double-click on pause > 设置 keeps the race, settings pills / ticks pick what you click, reduced motion
// parks the shards, a parked pointer does not steal focus, locked items explain themselves to mouse
// users. Other units run as core stubs. Exits 1 on any failure.
//   node tools/ui-input.mjs
import { parseArgs, withPage } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const STUB = args.real ? '' : '&stub=world,sim,camera,actors,combat,race,fx,audio';
const problems = [];
const expect = (ok, what) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};
const screen = (page) => page.evaluate(() => window.__br.app.ui.screen);
const idle = (page) => page.waitForFunction(() => !window.__br.app.ui.busy, null, { timeout: 10000 });
/** Fire actions in one task, exactly like core Input does for one key / pad button. */
const pad = (page, ...actions) => page.evaluate((list) => {
  const input = window.__br.app.input;
  input.lastDevice = 'gamepad';
  for (const a of list) input.press(a);
}, actions);
const modalOpen = (page) => page.evaluate(() => document.querySelector('.br-modal') !== null);

async function go(page, id) {
  await page.evaluate((s) => window.__br.show(s), id);
  await idle(page);
  await page.waitForTimeout(150);
}

async function modalChecks(page) {
  console.log('[ui-input] confirm modal');
  await page.evaluate(() => window.__br.app.save.update((d) => { d.coins = 9000; d.ownedBikes = ['roadbike']; d.bike = 'roadbike'; }));
  await go(page, 'garage');
  const owned = () => page.evaluate(() => window.__br.app.save.data.ownedBikes.length);
  const openBuy = async () => {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  };
  await openBuy();
  expect(await modalOpen(page), 'Enter on a shop bike opens the confirm modal');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  expect(!(await modalOpen(page)) && (await owned()) === 2, 'Space on 买了 buys the bike');
  await openBuy();
  await pad(page, 'left');
  await pad(page, 'hop', 'confirm');
  await page.waitForTimeout(250);
  expect(!(await modalOpen(page)) && (await owned()) === 3, 'pad A on 买了 buys the bike');
  await openBuy();
  await pad(page, 'attackR', 'back');
  await page.waitForTimeout(250);
  expect(!(await modalOpen(page)) && (await owned()) === 3 && (await screen(page)) === 'garage', 'pad B closes the modal (no purchase, stays in garage)');
  await page.evaluate(() => { window.__br.app.input.lastDevice = 'keyboard'; });
}

async function settingsChecks(page) {
  console.log('[ui-input] settings mouse picks');
  await go(page, 'settings');
  const settings = () => page.evaluate(() => window.__br.app.save.data.settings);
  await page.evaluate(() => window.__br.app.save.update((d) => { d.settings.quality = 'high'; d.settings.master = 1; }));
  await go(page, 'settings');
  const rows = page.locator('.br-set-row');
  await rows.nth(4).locator('.br-pill').nth(1).click();
  expect((await settings()).quality === 'medium', 'clicking 中 sets quality medium (was high)');
  await rows.nth(4).locator('.br-pill').nth(0).click();
  expect((await settings()).quality === 'low', 'clicking 低 sets quality low');
  await rows.nth(0).locator('.br-meter i').nth(2).click();
  expect(Math.abs((await settings()).master - 0.3) < 1e-6, 'clicking the 3rd master tick sets 30 %');
  await page.keyboard.press('ArrowDown');
  await go(page, 'menu');
  await go(page, 'settings');
  const focus = await page.evaluate(() => [...document.querySelectorAll('.br-set-row')].findIndex((r) => r.classList.contains('is-focus')));
  expect(focus === 1, `settings reopens on the last row used (got ${focus})`);
}

async function startRace(page) {
  await page.evaluate(() => window.__br.start({ trackId: 'coast' }));
  await page.waitForFunction(() => window.__br.app.ui.screen === 'race' && !window.__br.app.ui.busy, null, { timeout: 30000 });
}

async function pauseChecks(page) {
  console.log('[ui-input] pause: double-click 设置, settings → pause focus');
  await startRace(page);
  await page.keyboard.press('Escape');
  await idle(page);
  expect((await screen(page)) === 'pause', 'Esc pauses');
  await page.locator('.br-pz-list .br-btn').nth(2).dblclick();
  await page.waitForTimeout(700);
  await idle(page);
  expect((await screen(page)) === 'settings', `double-click 设置 opens settings once (got ${await screen(page)})`);
  await page.keyboard.press('Escape');
  await idle(page);
  const st = await page.evaluate(() => ({ s: window.__br.app.ui.screen, live: window.__br.session() !== null,
    focus: [...document.querySelectorAll('.br-pz-list .br-btn')].findIndex((b) => b.classList.contains('is-focus')) }));
  expect(st.s === 'pause' && st.live, `Esc from settings returns to pause with the race alive (${JSON.stringify(st)})`);
  expect(st.focus === 2, 'pause focus lands back on 设置');
}

/** A fake standard gamepad polled by core Input (pollPad), so pad B carries attackR + back like a real pad. */
const installPad = (page) => page.evaluate(() => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const fake = { id: 'ui-input pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
  navigator.getGamepads = () => [fake];
  window.__uiPad = fake;
});
const padTap = (page, i, ms = 70) => page.evaluate(async ([btn, hold]) => {
  const b = window.__uiPad.buttons[btn];
  b.pressed = true; b.value = 1;
  await new Promise((r) => setTimeout(r, hold));
  b.pressed = false; b.value = 0;
}, [i, ms]).catch(() => undefined);
const armed = (page) => page.evaluate(() => document.querySelector('.br-res-actions.is-armed') !== null);

/** Run `tap` every `ms` for `dur` ms; report screen + armed row at the end (still mashing). */
async function cadence(page, label, ms, dur, tap) {
  const timer = setInterval(() => void tap(), ms);
  await page.waitForTimeout(dur);
  const st = { s: await screen(page), armed: await armed(page) };
  clearInterval(timer);
  expect(st.s === 'results' && !st.armed, `${label}: results stay up, row not armed (${JSON.stringify(st)})`);
}

async function mashChecks(page) {
  console.log('[ui-input] results: finish-line mashing (Space 180 / 450 ms, pad B 220 ms)');
  await page.keyboard.press('Escape');
  await idle(page);
  await installPad(page);
  const space = () => page.keyboard.press('Space').catch(() => undefined);
  const first = setInterval(() => void space(), 180);
  await page.evaluate(() => {
    const s = window.__br.session();
    window.__br.app.bus.emit('race:end', { results: s.logic.results() });
  });
  await page.waitForFunction(() => window.__br.app.ui.screen === 'results', null, { timeout: 10000 });
  clearInterval(first);
  await cadence(page, 'Space every 180 ms', 180, 3200, space);
  await cadence(page, 'Space every 450 ms (hop rhythm)', 450, 3600, space);
  await cadence(page, 'pad B every 220 ms (swing right)', 220, 3000, () => padTap(page, 1));
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelector('.br-res-actions.is-armed') !== null, null, { timeout: 3000 });
  const wait = Date.now() - t0;
  expect(wait >= 450 && wait < 1600, `the row arms after a quiet beat (${wait} ms)`);
  const focus = await page.evaluate(() => document.querySelector('.br-res-actions .is-focus')?.textContent ?? '');
  expect(focus.includes('再来一局'), `default focus is 再来一局 (${focus})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect((await screen(page)) !== 'results', 'a deliberate Enter after mashing acts');
  await page.waitForFunction(() => window.__br.app.ui.screen === 'race' && !window.__br.app.ui.busy, null, { timeout: 30000 });
}

async function titleBackChecks(page) {
  console.log('[ui-input] title: back keys are not "any key" (no menu <-> title ping-pong)');
  await go(page, 'menu');
  for (let i = 0; i < 8; i++) {
    await padTap(page, 1);
    await page.waitForTimeout(150);
  }
  await idle(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
  expect((await screen(page)) === 'title', `pad B mash + Esc from the menu ends on the title (${await screen(page)})`);
  await padTap(page, 0);
  await page.waitForTimeout(600);
  await idle(page);
  expect((await screen(page)) === 'menu', 'pad A on the title still opens the menu');
}

async function reducedChecks(page) {
  console.log('[ui-input] reduced motion: shards stay parked');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const samples = await page.evaluate(async () => {
    const shards = [...document.querySelectorAll('.br-wipe-shard')];
    const out = [];
    void window.__br.show('credits');
    const t0 = performance.now();
    while (performance.now() - t0 < 600) {
      await new Promise((r) => requestAnimationFrame(r));
      out.push(Math.max(...shards.map((s) => s.getBoundingClientRect().right)));
    }
    return out;
  });
  expect(samples.every((r) => r <= 0), `no shard enters the viewport (right-most shard edge ${Math.max(...samples).toFixed(0)} px)`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await idle(page);
}

async function pointerChecks(page) {
  console.log('[ui-input] parked pointer, locked click');
  await go(page, 'menu');
  const card = await page.evaluate(async () => {
    await window.__br.show('trackSelect');
    const r = document.querySelectorAll('.br-screen [data-nav]')[1].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await go(page, 'menu');
  await page.mouse.move(card.x, card.y);
  await page.waitForTimeout(100);
  await go(page, 'trackSelect');
  await page.waitForTimeout(200);
  const idx = () => page.evaluate(() => [...document.querySelectorAll('.br-screen [data-nav]')].findIndex((e) => e.classList.contains('is-focus')));
  expect((await idx()) !== 1, `a parked pointer does not steal focus on mount (focus ${await idx()})`);
  await page.mouse.move(card.x + 12, card.y + 6, { steps: 3 });
  expect((await idx()) === 1, 'moving the pointer does focus the card under it');
  await page.evaluate(() => window.__br.app.save.reset());
  await go(page, 'career');
  await page.locator('.br-car-ev.is-locked').first().click();
  await page.waitForTimeout(150);
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.br-toast')].map((t) => t.textContent));
  expect(toasts.some((t) => t.includes('前三名')), `clicking a locked event explains why (${toasts.join(' | ')})`);
}

await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await modalChecks(page);
  await settingsChecks(page);
  await pauseChecks(page);
  await mashChecks(page);
  await titleBackChecks(page);
  await reducedChecks(page);
  await pointerChecks(page);
  const errors = await h.errors();
  expect(errors.length === 0, `no console errors (${errors.slice(-3).join(' | ').slice(0, 300)})`);
}, { size: '1280x720' });
console.log(problems.length ? `[ui-input] ${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '[ui-input] all checks passed');
process.exitCode = problems.length ? 1 : 0;
