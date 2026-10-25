#!/usr/bin/env node
// Comfort / safety checks (ui-screens fix round 2): auto-pause on window blur, hidden tab and pad
// disconnect; keyboard hold-to-repeat in menus; 重置存档 locked mid-race and never recalled; quality
// change offers a restart (menu side only); credits honour reduced motion and the mouse wheel; toasts
// go quiet during a KO cinematic; a career unlock shows as a results tag (no toast). Stubs other units.
//   node tools/ui-comfort.mjs [--out shots/ui-screens]   (exits 1 on any failure)
import { parseArgs, withPage } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const STUB = args.real ? '' : '&stub=world,sim,camera,actors,combat,race,fx,audio';
const OUT = args.out ?? 'shots/ui-screens';
const problems = [];
const expect = (ok, what) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};
const screen = (page) => page.evaluate(() => window.__br.app.ui.screen);
const idle = (page) => page.waitForFunction(() => !window.__br.app.ui.busy, null, { timeout: 15000 });
const focusIndex = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].findIndex((e) => e.classList.contains('is-focus')), sel);
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.br-toast')].map((t) => t.textContent ?? ''));

async function go(page, id) {
  await page.evaluate((s) => window.__br.show(s), id);
  await idle(page);
  await page.waitForTimeout(150);
}

async function startRace(page, config = { trackId: 'coast' }) {
  await page.evaluate((c) => window.__br.start(c), config);
  await page.waitForFunction(() => window.__br.app.ui.screen === 'race' && !window.__br.app.ui.busy, null, { timeout: 30000 });
}

async function resume(page) {
  await page.keyboard.press('Escape');
  await idle(page);
}

async function autoPauseChecks(page) {
  console.log('[ui-comfort] auto-pause: blur / hidden tab / pad disconnect');
  await startRace(page);
  const triggers = {
    'window blur': () => window.dispatchEvent(new Event('blur')),
    'tab hidden': () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    },
    'pad disconnect': () => window.dispatchEvent(new Event('gamepaddisconnected')),
  };
  for (const [name, fire] of Object.entries(triggers)) {
    await page.evaluate(fire);
    await idle(page);
    expect((await screen(page)) === 'pause', `${name} pauses the race (${await screen(page)})`);
    await resume(page);
  }
  expect((await toasts(page)).some((t) => t.includes('手柄断开')), 'pad disconnect explains itself');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(60);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await idle(page);
  expect((await screen(page)) === 'pause', 'a second blur on the pause screen keeps it paused');
}

async function resetLockChecks(page) {
  console.log('[ui-comfort] settings: reset locked mid-race, never recalled');
  await page.locator('.br-pz-list .br-btn').nth(2).click();
  await idle(page);
  expect((await screen(page)) === 'settings', 'pause > 设置 opens settings');
  const resetAt = await page.evaluate(() => [...document.querySelectorAll('.br-set-row')].findIndex((r) => r.classList.contains('is-action')));
  for (let i = 0; i < resetAt; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  const locked = await page.evaluate(() => document.querySelector('.br-set-row.is-action')?.classList.contains('is-disabled'));
  expect(locked === true, 'the reset row is marked disabled mid-race');
  const coins = await page.evaluate(() => window.__br.app.save.data.coins);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const modal = await page.evaluate(() => document.querySelector('.br-modal') !== null);
  expect(!modal && (await toasts(page)).some((t) => t.includes('不能重置')), 'Enter on reset mid-race: no modal, a toast explains');
  expect((await page.evaluate(() => window.__br.app.save.data.coins)) === coins, 'the save is untouched');
  await page.keyboard.press('Escape');
  await idle(page);
  await page.locator('.br-pz-list .br-btn').nth(2).click();
  await idle(page);
  expect((await focusIndex(page, '.br-set-row')) !== resetAt, `settings do not reopen on the reset row (${await focusIndex(page, '.br-set-row')})`);
  await page.keyboard.press('Escape');
  await idle(page);
  await resume(page);
}

async function quietChecks(page) {
  console.log('[ui-comfort] toasts go quiet during a KO cinematic');
  await page.evaluate(() => {
    window.__br.app.ui.toast('测试 toast', 'warn');
    window.__br.app.bus.emit('cine:ko', { phase: 'start', attacker: 'pelican', victim: 'goose', chain: 1 });
  });
  await page.waitForTimeout(120);
  const quiet = await page.evaluate(() => document.querySelector('.br-toast-lane')?.classList.contains('is-quiet'));
  await page.evaluate(() => window.__br.app.bus.emit('cine:ko', { phase: 'end', attacker: 'pelican', victim: 'goose', chain: 1 }));
  // The fx KO timeline can re-quiet the lane (its own 'peak' lands after our 'end'), so wait for it.
  const back = await page.waitForFunction(
    () => !document.querySelector('.br-toast-lane')?.classList.contains('is-quiet'), null, { timeout: 4000 },
  ).then(() => false).catch(() => true);
  expect(quiet === true && back === false, `lane quiet during cine:ko, back after (${quiet} → ${back})`);
}

async function unlockChecks(page, h) {
  console.log('[ui-comfort] results: career unlock is a tag, not a toast');
  await page.evaluate(() => window.__br.app.save.update((d) => { d.career.unlocked = 1; d.career.best = {}; }));
  await startRace(page, { trackId: 'coast', mode: 'career', level: 1 });
  await page.evaluate(() => {
    const results = window.__br.session().logic.results().map((r) => ({ ...r }));
    const me = results.find((r) => r.isPlayer);
    for (const r of results) if (r !== me && r.place < me.place) r.place += 1;
    Object.assign(me, { place: 1, time: 151.2 });
    window.__br.app.bus.emit('race:end', { results });
  });
  await page.waitForFunction(() => window.__br.app.ui.screen === 'results' && !window.__br.app.ui.busy, null, { timeout: 15000 });
  await page.waitForTimeout(2000);
  const tag = await page.evaluate(() => document.querySelector('.br-res-unlock')?.textContent ?? '');
  expect(tag.includes('TIER'), `unlock tag in the results title (${tag})`);
  expect(!(await toasts(page)).some((t) => t.includes('解锁')), 'no unlock toast over the podium');
  const shifted = await page.evaluate(() => [...document.querySelectorAll('.br-ui, .br-ui *')].filter((e) => e.scrollTop || e.scrollLeft).length);
  expect(shifted === 0, `no UI box got scrolled by the automated clicks (${shifted})`);
  await h.shot(`${OUT}/comfort-unlock.png`);
  await page.waitForFunction(() => document.querySelector('.br-res-actions.is-armed') !== null, null, { timeout: 5000 });
  const hint = await page.evaluate(() => document.querySelector('.br-hint[data-action="back"]')?.textContent ?? '');
  expect(hint.includes('巡回赛'), `results hint bar names the back target (${hint})`);
  await page.keyboard.press('Escape');
  await idle(page);
  const st = await page.evaluate(() => ({ s: window.__br.app.ui.screen, live: window.__br.session() !== null }));
  expect(st.s === 'career' && !st.live, `Esc on results returns to the career ladder, race closed (${JSON.stringify(st)})`);
}

async function keyRepeatChecks(page) {
  console.log('[ui-comfort] keyboard hold-to-repeat in menus');
  await go(page, 'menu');
  await page.evaluate(() => {
    window.__moves = 0;
    new MutationObserver((list) => {
      for (const m of list) if (m.target.classList.contains('is-focus') && !(m.oldValue ?? '').includes('is-focus')) window.__moves += 1;
    }).observe(document.querySelector('.br-screens'), { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
  const t0 = Date.now();
  await page.keyboard.down('ArrowDown');
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(40);
    await page.keyboard.down('ArrowDown'); // Playwright sends repeat: true for a held key
  }
  await page.keyboard.up('ArrowDown');
  const held = Date.now() - t0; // ~0.6 s, longer on a loaded machine: judge the rate, not a fixed count
  const moves = await page.evaluate(() => window.__moves);
  const most = 2 + Math.ceil(held / 110);
  expect(moves >= 4 && moves <= most, `holding ↓ ${held} ms moves the menu focus every ~110 ms (${moves}, max ${most})`);
}

async function qualityChecks(page) {
  console.log('[ui-comfort] quality change offers a restart (menu side)');
  await go(page, 'settings');
  const rows = page.locator('.br-set-row');
  await rows.nth(4).locator('.br-pill:not(.is-on)').first().click();
  const want = await page.evaluate(() => window.__br.app.save.data.settings.quality);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const offered = await page.evaluate(() => document.querySelector('.br-modal-title')?.textContent ?? '');
  expect(offered.length > 0, `leaving settings with a new quality offers a restart (${offered})`);
  await page.keyboard.press('ArrowLeft');
  await Promise.all([page.waitForEvent('load', { timeout: 15000 }), page.keyboard.press('Enter')]);
  await page.waitForFunction(() => window.__br?.app?.ui !== undefined, null, { timeout: 15000 });
  const after = await page.evaluate(() => ({ q: window.__br.app.save.data.settings.quality, aq: window.__br.app.quality }));
  expect(after.q === want, `restart keeps the new quality (${JSON.stringify(after)} vs ${want})`);
}

async function creditsChecks(page) {
  console.log('[ui-comfort] credits: reduced motion + wheel');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go(page, 'credits');
  const ty = () => page.evaluate(() => Number(/-?[\d.]+/.exec(document.querySelector('.br-cr-roll')?.style.transform ?? '')?.[0] ?? 0));
  const a = await ty();
  await page.waitForTimeout(1200);
  const b = await ty();
  expect(Math.abs(b - a) < 1, `reduced motion: no auto-scroll (${a.toFixed(1)} → ${b.toFixed(1)})`);
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  const c = await ty();
  expect(c < b - 50, `the mouse wheel scrolls the roll (translateY ${b.toFixed(1)} → ${c.toFixed(1)} px)`);
  await page.emulateMedia({ reducedMotion: null });
}

await withPage(async (page, h) => {
  await h.goto(`/?screen=menu${STUB}`);
  await autoPauseChecks(page);
  await resetLockChecks(page);
  await quietChecks(page);
  await unlockChecks(page, h);
  await keyRepeatChecks(page);
  await creditsChecks(page);
  await qualityChecks(page);
  const errors = await h.errors();
  expect(errors.length === 0, `no console errors (${errors.slice(-3).join(' | ').slice(0, 300)})`);
}, { size: '1280x720' });
console.log(problems.length ? `[ui-comfort] ${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '[ui-comfort] all checks passed');
process.exitCode = problems.length ? 1 : 0;
