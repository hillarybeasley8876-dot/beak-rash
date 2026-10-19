#!/usr/bin/env node
// Input regression checks (ui-screens fix rounds 1-2, acceptance 1-2): confirm modal with Space / pad A / pad B,
// results ignore finish-line mashing (Space 180 / 450 ms, fake pad B 220 ms; the first Space after arming only
// nudges) yet Space / pad A every 0.8 s leave within 2 presses, the records sheet closes with pad B / A / Space,
// click mashing (clicks skip the show and delay arming), back keys never leave the title,
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
  await rows.nth(0).locator('.br-meter i').nth(0).click();
  expect(Math.abs((await settings()).master - 0.1) < 1e-6, 'clicking the 1st master tick sets 10 %');
  await rows.nth(0).locator('.br-meter i').nth(0).click();
  expect((await settings()).master === 0, 'clicking the lit 1st tick again mutes (0 %)');
  await rows.nth(4).locator('.br-pill').nth(2).click();
  await page.keyboard.press('ArrowRight');
  expect((await settings()).quality === 'high', `→ on 画质 高 stays 高 (ordered rows do not wrap) (${(await settings()).quality})`);
  await rows.nth(7).locator('.br-pill').nth(2).click();
  await page.keyboard.press('ArrowRight');
  expect((await settings()).slowmo === 'off', `→ on 慢镜头 关闭 stays 关闭 (${(await settings()).slowmo})`);
  await page.keyboard.press('ArrowLeft');
  expect((await settings()).slowmo === 'short', '← on 慢镜头 关闭 steps to 简短');
  await rows.nth(6).locator('.br-pill').nth(1).click();
  await page.keyboard.press('ArrowRight');
  expect((await settings()).autoPedal === false, '→ on 自动踩踏 开 wraps to 关 (2-option toggle)');
  await rows.nth(8).locator('.br-pill').nth(1).click();
  expect(await page.evaluate(() => document.querySelector('.br-ui').classList.contains('is-reduced')), '动态效果 减弱 puts .is-reduced on the UI root');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.querySelector('.br-ui').classList.contains('is-full-motion')), '→ 完整 puts .is-full-motion on the UI root');
  await rows.nth(8).locator('.br-pill').nth(0).click();
  expect(await page.evaluate(() => document.querySelector('.br-ui').className === 'br-ui'), '跟随系统 clears both');
  await page.evaluate(() => window.__br.app.save.update((d) => Object.assign(d.settings, { master: 1, slowmo: 'full', autoPedal: false })));
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
  expect(focus.includes('主菜单'), `default focus after a quick race is 主菜单, not RETRY (${focus})`);
  await space();
  const nudged = await page.evaluate(() => (document.querySelector('.br-res-actions .is-focus')?.getAnimations() ?? [])
    .some((an) => an instanceof Animation && an.effect?.getKeyframes().some((k) => 'scale' in k)));
  await page.waitForTimeout(150);
  expect((await screen(page)) === 'results', 'Space right after the row arms (< 1 s since the last hop) does nothing');
  expect(nudged, 'that ignored Space nudges the focused button (the row is live)');
  await page.waitForTimeout(500);
  await space();
  await page.waitForTimeout(400);
  expect((await screen(page)) !== 'results', 'the next Space 0.8 s later acts');
  await page.waitForFunction(() => window.__br.app.ui.screen === 'menu' && !window.__br.app.ui.busy, null, { timeout: 30000 });
}

/** Acceptance r2 int#0: Space / pad A every 0.8 s from the moment results appear leave within 2 presses after arming. */
async function steadyChecks(page) {
  console.log('[ui-input] results: Space / pad A every 0.8 s');
  await installPad(page);
  const taps = [['Space', () => page.keyboard.press('Space')], ['pad A', () => padTap(page, 0)]];
  for (const [label, tap] of taps) {
    await endRace(page);
    let after = 0;
    let left = false;
    for (let i = 0; i < 16 && !left; i++) {
      const t0 = Date.now();
      if (await armed(page)) after++;
      await tap();
      await page.waitForTimeout(Math.max(0, 790 - (Date.now() - t0)));
      left = (await screen(page)) !== 'results';
    }
    expect(left && after >= 1 && after <= 2, `${label} every 0.8 s leaves results within 2 presses after arming (left ${left}, ${after})`);
    await page.waitForFunction(() => window.__br.app.ui.screen === 'menu' && !window.__br.app.ui.busy, null, { timeout: 30000 });
  }
}

/** Acceptance r2 int#1: the records sheet closes with pad B / pad A / Space (their attackR / hop twins fall through). */
async function recordsChecks(page) {
  console.log('[ui-input] career records sheet: pad LB / B / A, TAB / Space, then the d-pad');
  await go(page, 'career');
  await installPad(page);
  const open = () => page.evaluate(() => document.querySelector('.br-rec.is-open') !== null);
  const focus = () => page.evaluate(() => [...document.querySelectorAll('.br-car-ev')].findIndex((e) => e.classList.contains('is-focus')));
  const tapWait = async (btn) => {
    await padTap(page, btn);
    await page.waitForTimeout(160);
  };
  await tapWait(4);
  expect(await open(), 'pad LB opens the records sheet');
  await tapWait(1);
  expect(!(await open()) && (await screen(page)) === 'career', 'pad B closes it (career stays)');
  await tapWait(4);
  await tapWait(0);
  expect(!(await open()) && (await screen(page)) === 'career', 'pad A closes it (no race starts)');
  const before = await focus();
  await tapWait(15);
  expect((await focus()) !== before, `the d-pad then moves the ladder focus (${before} -> ${await focus()})`);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(160);
  expect(await open(), 'TAB opens the sheet');
  await page.keyboard.press('Space');
  await page.waitForTimeout(160);
  expect(!(await open()) && (await screen(page)) === 'career', 'Space closes it (no race starts)');
}

/** Start a stub race and end it at once; resolves on the results screen. */
async function endRace(page) {
  await page.evaluate(() => window.__br.start({ trackId: 'coast' }));
  await page.waitForFunction(() => window.__br.app.ui.screen === 'race' && !window.__br.app.ui.busy, null, { timeout: 30000 });
  await page.evaluate(() => window.__br.app.bus.emit('race:end', { results: window.__br.session().logic.results() }));
  await page.waitForFunction(() => window.__br.app.ui.screen === 'results', null, { timeout: 10000 });
}

async function clickChecks(page) {
  console.log('[ui-input] results: clicks skip the show, delay arming, and wait for the slide-in');
  await endRace(page);
  await page.waitForTimeout(500);
  await page.mouse.click(900, 300);
  await page.waitForTimeout(120);
  const done = await page.evaluate(() => document.querySelector('.br-cc')?.classList.contains('is-done') ?? false);
  expect(done, 'a click on bare stage skips the show (count-up finished)');
  // Where 再来一局 lands once armed (the hidden row waits 160 stage px to the left).
  const spot = await page.evaluate(() => {
    const r = document.querySelector('.br-res-actions .br-btn').getBoundingClientRect();
    const k = Number(getComputedStyle(document.querySelector('.br-ui')).getPropertyValue('--s')) || 1;
    return { x: r.left + r.width / 2 + 160 * k, y: r.top + r.height / 2 };
  });
  const clicker = setInterval(() => void page.mouse.click(spot.x, spot.y).catch(() => undefined), 230);
  await page.waitForTimeout(2600);
  const st = { s: await screen(page), armed: await armed(page) };
  clearInterval(clicker);
  expect(st.s === 'results' && !st.armed, `clicking every 230 ms keeps the row unarmed (${JSON.stringify(st)})`);
  await page.waitForFunction(() => document.querySelector('.br-res-actions.is-armed') !== null, null, { timeout: 3000 });
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(150);
  expect((await screen(page)) === 'results', 'a click within 350 ms of arming does not fire a button');
  await page.waitForTimeout(900);
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(400);
  expect((await screen(page)) !== 'results', 'a later click fires the button under the cursor (再来一局)');
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
  await go(page, 'title');
  await page.waitForTimeout(300);
  await padTap(page, 9);
  await page.waitForTimeout(600);
  await idle(page);
  expect((await screen(page)) === 'menu', 'pad START on the title opens the menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await idle(page);
  expect((await screen(page)) === 'title', 'keyboard Esc on the menu still backs out to the title');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  expect((await screen(page)) === 'title', 'keyboard Esc on the title stays on the title');
  await go(page, 'menu');
  await padTap(page, 9);
  await page.waitForTimeout(600);
  await idle(page);
  expect((await screen(page)) !== 'menu', `pad START on the menu picks the focused entry (${await screen(page)})`);
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
  await steadyChecks(page);
  await recordsChecks(page);
  await clickChecks(page);
  await titleBackChecks(page);
  await reducedChecks(page);
  await pointerChecks(page);
  const errors = await h.errors();
  expect(errors.length === 0, `no console errors (${errors.slice(-3).join(' | ').slice(0, 300)})`);
}, { size: '1280x720' });
console.log(problems.length ? `[ui-input] ${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '[ui-input] all checks passed');
process.exitCode = problems.length ? 1 : 0;
