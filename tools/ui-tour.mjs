#!/usr/bin/env node
// UI tour (ui-screens): drives every screen with the KEYBOARD only and screenshots each one.
//   node tools/ui-tour.mjs [--sizes 1280x720,1920x1080] [--spot 2560x1440,1440x900|none] [--real] [--out shots/ui-tour]
// Default runs other units as core stubs (?stub=…) so a broken WIP unit elsewhere cannot block the tour;
// pass --real to tour with every real unit. Checks per step: console errors, a visible focus on menu
// screens, interactive elements inside the viewport. Exits 1 when any check fails.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, parseArgs, withPage } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const OUT = args.out ?? 'shots/ui-tour';
/** "WxH,WxH" → sizes; `--spot none` (or a bare flag) disables a list. */
const list = (v, fallback) => {
  if (v === true || v === 'none') return [];
  const sizes = String(v ?? fallback).split(',').filter(Boolean);
  for (const bad of sizes.filter((x) => !/^\d+x\d+$/.test(x))) console.warn(`[ui-tour] ignoring bad size "${bad}"`);
  return sizes.filter((x) => /^\d+x\d+$/.test(x));
};
const SIZES = list(args.sizes, '1280x720,1920x1080');
const SPOT = list(args.spot, '2560x1440,1440x900');
const STUBS = args.real ? '' : '&stub=world,sim,camera,actors,combat,race,fx,audio';
const SETTLE = 650;
const FOCUS_SCREENS = new Set(['menu', 'career', 'trackSelect', 'garage', 'pause', 'results', 'settings', 'howto']);

const problems = [];

/** Screen-state checks run after every step. */
async function check(page, h, label) {
  const info = await page.evaluate(() => {
    const ui = window.__br?.app?.ui.screen ?? 'boot'; // real units may still be loading on the boot shot
    const root = document.querySelector('.br-screen:last-of-type');
    const focus = root ? root.querySelectorAll('.is-focus').length : 0;
    const vw = innerWidth;
    const vh = innerHeight;
    const outside = [];
    for (const el of document.querySelectorAll('.br-screen [data-nav], .br-screen .br-hints')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2) outside.push(`${el.className} @${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    return { ui, focus, outside, errors: window.__br?.errors.slice() ?? [] };
  });
  if (info.errors.length) problems.push(`${label}: console errors: ${info.errors.slice(-3).join(' | ').slice(0, 400)}`);
  if (FOCUS_SCREENS.has(info.ui) && info.focus === 0) problems.push(`${label}: no visible focus on ${info.ui}`);
  if (info.outside.length) problems.push(`${label}: outside viewport: ${info.outside.slice(0, 3).join('; ')}`);
  await page.evaluate(() => { if (window.__br) window.__br.errors.length = 0; });
  return info.ui;
}

function shooter(page, h, dir) {
  let n = 0;
  fs.mkdirSync(dir, { recursive: true });
  return async (name, wait = SETTLE) => {
    await h.sleep(wait);
    const file = path.join(dir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    const ui = await check(page, h, `${path.basename(dir)}/${name}`);
    console.log(`  ${file}  [screen=${ui}]`);
    return ui;
  };
}

/** Press keys like a quick player, letting each screen transition finish before the next key. */
async function press(page, h, ...keys) {
  for (const k of keys) {
    await page.keyboard.press(k);
    await h.sleep(90);
    await page.waitForFunction(() => !window.__br.app.ui.busy, null, { timeout: 10000 });
  }
}

/** On the main menu: move the focus to the entry whose text has `cn` (arrows, like a player) and press Enter. The
 *  tour goes by name, so new menu entries (r6: 成就 / 角色 / 联机) do not shift it. */
async function menu(page, h, cn) {
  for (let i = 0; i < 16; i++) {
    const at = await page.evaluate((cn) => {
      const items = [...document.querySelectorAll('.br-menu-item')];
      return { cur: items.findIndex((e) => e.classList.contains('is-focus')), want: items.findIndex((e) => (e.textContent ?? '').includes(cn)) };
    }, cn);
    if (at.want < 0) { problems.push(`menu: no entry 「${cn}」`); return; }
    if (at.cur === at.want) break;
    await press(page, h, at.cur < at.want ? 'ArrowDown' : 'ArrowUp');
  }
  await press(page, h, 'Enter');
}

/** Assert the UI landed on `want`; record a problem otherwise. */
async function expectScreen(page, label, want) {
  const ui = await page.evaluate(() => window.__br.app.ui.screen);
  if (ui !== want) problems.push(`${label}: expected screen ${want}, got ${ui}`);
}

/** The full keyboard tour: boot → title → every menu screen → race → pause → results → menu. */
async function fullTour(size) {
  await withPage(async (page, h) => {
    const shot = shooter(page, h, path.join(OUT, size));
    const label = (s) => `${size}/${s}`;
    await page.goto(`${BASE}/?seed=4${STUBS}`, { waitUntil: 'load' });
    await shot('boot', 450);
    await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 60000 });
    await shot('title', 900);
    await press(page, h, 'KeyX');
    await shot('menu', 900);
    await menu(page, h, '巡回赛');
    await shot('career');
    await press(page, h, 'ArrowRight', 'Enter');
    await shot('career-locked', 500);
    await press(page, h, 'Escape');
    await expectScreen(page, label('career-back'), 'menu');
    await menu(page, h, '快速比赛');
    await shot('track-select');
    await press(page, h, 'ArrowRight');
    await shot('track-select-2', 350);
    await press(page, h, 'ArrowDown', 'ArrowRight');   // into the race options (weather)
    await shot('track-select-opts', 350);
    await press(page, h, 'Escape');                     // back to the cards
    await press(page, h, 'Escape');
    await menu(page, h, '车库');
    await shot('garage', 1200);
    await press(page, h, 'ArrowDown', 'ArrowDown', 'ArrowDown');
    await shot('garage-erba-too-pricey', 900);
    await press(page, h, 'ArrowUp', 'Enter');
    await shot('garage-buy-modal', 450);
    await press(page, h, 'Escape');
    await expectScreen(page, label('garage-modal-closed'), 'garage');
    await press(page, h, 'Escape');
    await menu(page, h, '成就');
    await shot('records', 900);
    await expectScreen(page, label('records'), 'records');
    await press(page, h, 'Escape');
    await menu(page, h, '角色');
    await shot('roster', 900);
    await expectScreen(page, label('roster'), 'roster');
    await press(page, h, 'Escape');
    await menu(page, h, '设置');
    await shot('settings');
    await expectScreen(page, label('settings'), 'settings');
    await press(page, h, 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowDown');
    await shot('settings-quality', 350);
    await press(page, h, 'Escape');
    await menu(page, h, '操作');
    await shot('howto-keyboard');
    await expectScreen(page, label('howto'), 'howto');
    await press(page, h, 'ArrowRight');
    await shot('howto-gamepad', 400);
    await press(page, h, 'ArrowRight');
    await shot('howto-skills', 400);
    await press(page, h, 'Escape');
    await menu(page, h, '致谢');
    await shot('credits', 1500);
    await expectScreen(page, label('credits'), 'credits');
    await press(page, h, 'Escape');
    await expectScreen(page, label('credits-back'), 'menu');
    // Quick race on track 1, through loading into the race, pause, settings-from-pause, results.
    await menu(page, h, '快速比赛');
    await expectScreen(page, label('quick'), 'trackSelect');
    await press(page, h, 'ArrowLeft', 'ArrowLeft');
    await page.keyboard.press('Enter'); // no idle wait: catch the loading card while it is up
    await shot('loading', 520);
    await page.waitForFunction(() => window.__br.app.ui.screen === 'race' && !window.__br.app.ui.busy, null, { timeout: 30000 });
    await shot('race', 1500);
    await press(page, h, 'Escape');
    await shot('pause', 500);
    await expectScreen(page, label('pause'), 'pause');
    await press(page, h, 'ArrowDown', 'ArrowDown', 'Enter');
    await shot('pause-settings');
    await expectScreen(page, label('pause-settings'), 'settings');
    await press(page, h, 'Escape');
    await expectScreen(page, label('pause-settings-back'), 'pause');
    await press(page, h, 'Escape');
    await expectScreen(page, label('resume'), 'race');
    await h.sleep(400);
    await page.evaluate(() => {
      const s = window.__br.session();
      window.__br.app.bus.emit('race:end', { results: s.logic.results() });
    });
    await shot('results', 3200);
    await press(page, h, 'ArrowRight', 'ArrowRight');
    await shot('results-focus', 300);
    await press(page, h, 'Escape');
    await h.sleep(900);
    await expectScreen(page, label('results-back'), 'menu');
  }, { size });
}

/** Spot check: a few screens straight from ?screen= at an extra resolution. */
async function spotCheck(size) {
  await withPage(async (page, h) => {
    const shot = shooter(page, h, path.join(OUT, size));
    await h.goto(`/?screen=title${STUBS}`);
    for (const s of ['title', 'menu', 'career', 'garage', 'settings', 'results', 'loading', 'howto']) {
      await page.evaluate((id) => window.__br.show(id), s);
      await shot(s, s === 'results' ? 3000 : 1100);
    }
  }, { size });
}

for (const size of SIZES) {
  console.log(`[ui-tour] full tour ${size}`);
  await fullTour(size);
}
for (const size of SPOT) {
  console.log(`[ui-tour] spot check ${size}`);
  await spotCheck(size);
}
console.log(problems.length ? `[ui-tour] ${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '[ui-tour] all checks passed');
process.exitCode = problems.length ? 1 : 0;
