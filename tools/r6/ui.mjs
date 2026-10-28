#!/usr/bin/env node
// r6 acceptance: ui (SPEC §26 — readable screens, achievements you can find, no stand-in art, no boot font flood).
// Lead-owned, read-only for workers. Before r6 (1280×720): career = 15 cards of 137 px with 15 px names and 16 px cup
// names, 47 text elements under 14 px; quick race = 5 cards of 183 px, 20 px names, 13 px blurbs; no 「成就」 on the
// main menu; the drawn stand-in pelican showed 2.6 s on an 8 Mbps first visit; boot fetched 5.1 MB of race fonts.
//   node tools/r6/ui.mjs [--skip net]
import { createRequire } from 'node:module';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const skip = new Set(String(a.skip ?? '').split(',').filter(Boolean));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Rendered font size (CSS px × the stage scale) of every visible leaf text node under #ui. */
const TEXT_METRICS = () => {
  const leaves = [...document.querySelectorAll('#ui *')].filter((e) => {
    if (e.children.length) return false;
    const t = (e.textContent ?? '').trim();
    if (!t) return false;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight;
  });
  const size = (e) => { const r = e.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(e).fontSize); return fs * (e.offsetHeight ? r.height / e.offsetHeight : 1); };
  const sizes = leaves.map(size).sort((x, y) => x - y);
  return { n: sizes.length, under14: sizes.filter((x) => x < 14).length, median: sizes[Math.floor(sizes.length / 2)] ?? 0 };
};

// 1. The main menu has 「成就」 and 「角色」 entries; 成就 opens the records screen (every achievement, keyboard-walkable).
await withPage(async (page, h) => {
  await h.goto('/?screen=menu');
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'menu', null, { timeout: 30000 });
  await sleep(800);
  const items = await page.evaluate(() => [...document.querySelectorAll('.br-menu-item')].map((e) => e.textContent ?? ''));
  const ach = items.findIndex((t) => /成就/.test(t));
  const ros = items.findIndex((t) => /角色/.test(t));
  expect(ach >= 0, `the main menu has a 「成就」 entry (${items.join(' | ')})`);
  expect(ros >= 0, `the main menu has a 「角色」 entry (${items.join(' | ')})`);
  const fits = await page.evaluate(() => [...document.querySelectorAll('.br-menu-item')].every((e) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight - 40 && r.top >= 0; }));
  expect(fits, 'every menu entry is on screen above the hint bar at 1280×720');
  if (ach >= 0) {
    for (let i = 0; i < 12; i++) {
      const cur = await page.evaluate(() => [...document.querySelectorAll('.br-menu-item')].findIndex((e) => e.classList.contains('is-focus') || e.classList.contains('is-on') || e.getAttribute('aria-current') === 'true'));
      if (cur === ach) break;
      await page.keyboard.press(cur < ach ? 'ArrowDown' : 'ArrowUp');
      await sleep(120);
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__br.app.ui.screen === 'records', null, { timeout: 15000 }).catch(() => null);
    await sleep(900);
    const rec = await page.evaluate(async () => {
      const cat = (await import('/src/data/achievements.ts')).ACHIEVEMENTS;
      const cells = [...document.querySelectorAll('[data-ach]')];
      const detail = document.querySelector('[data-ach-detail]');
      const off = [...document.querySelectorAll('[data-ach], [data-ach-detail]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1); }).length;
      return { screen: window.__br.app.ui.screen, cells: cells.length, want: cat.length, detail: detail?.textContent ?? '', off };
    });
    expect(rec.screen === 'records' && rec.cells === rec.want && rec.detail.length > 4 && rec.off === 0,
      `成就 opens the records screen with every achievement and the detail strip, all on screen (${JSON.stringify(rec)})`);
    await page.keyboard.press('ArrowRight'); await sleep(150);
    const moved = await page.evaluate(() => document.querySelector('[data-ach].is-focus')?.getAttribute('data-ach'));
    expect(!!moved, `the arrow keys walk the achievements on the records screen (${moved})`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__br.app.ui.screen === 'menu', null, { timeout: 15000 }).catch(() => null);
    expect(await page.evaluate(() => window.__br.app.ui.screen) === 'menu', 'Esc on the records screen goes back to the menu');
  }
  await noErrors(h, 'menu');
}, { size: '1280x720' });

// 2. Readability: career and quick race back to big cards (pre-r4 sizes), few tiny texts.
await withPage(async (page, h) => {
  const screens = {};
  for (const s of ['career', 'trackSelect', 'menu', 'garage']) {
    await h.goto(`/?screen=${s}`);
    await page.waitForFunction((x) => window.__br?.app?.ui?.screen === x, s, { timeout: 30000 });
    await sleep(1800);
    screens[s] = await page.evaluate(TEXT_METRICS);
    if (s === 'career') {
      screens[s].cards = await page.evaluate(() => {
        const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; });
        const px = (e) => { const r = e.getBoundingClientRect(); return parseFloat(getComputedStyle(e).fontSize) * (e.offsetHeight ? r.height / e.offsetHeight : 1); };
        const names = vis('.br-car-name'), cups = vis('.br-car-cup > b, .br-car-cup b');
        return { shown: names.length, name: Math.round(Math.min(...names.map(px))), cup: Math.round(Math.min(...cups.map(px))) };
      });
    }
    if (s === 'trackSelect') {
      screens[s].cards = await page.evaluate(() => {
        const vis = [...document.querySelectorAll('.br-tc')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < innerWidth; });
        const px = (sel) => Math.round(Math.min(...[...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return parseFloat(getComputedStyle(e).fontSize) * (e.offsetHeight ? r.height / e.offsetHeight : 1); })));
        return { shown: vis.length, width: Math.round(Math.min(...vis.map((e) => e.getBoundingClientRect().width))), name: px('.br-tc-name'), blurb: px('.br-tc-blurb') };
      });
    }
  }
  const c = screens.career, t = screens.trackSelect;
  expect(c.cards.shown <= 9 && c.cards.name >= 22 && c.cards.cup >= 26, `career: at most 9 cards in view at once, card names ≥ 22 px, cup names ≥ 26 px (${JSON.stringify(c.cards)}; pre-r4: 21 / 24, r5: 15 / 16 with 15 cards)`);
  expect(c.under14 <= 12, `career: ≤ 12 texts under 14 px (${c.under14} of ${c.n}; r5: 47)`);
  expect(t.cards.shown <= 3 && t.cards.width >= 300 && t.cards.name >= 32 && t.cards.blurb >= 17, `quick race: 3 track cards in view, each ≥ 300 px wide, names ≥ 32 px, blurbs ≥ 17 px (${JSON.stringify(t.cards)}; pre-r4: 3 cards 378 px, 39 / 20 px)`);
  expect(t.under14 <= 4, `quick race: ≤ 4 texts under 14 px (${t.under14})`);
  // every track and option is still reachable from the keyboard (→ scrolls the row)
  await h.goto('/?screen=trackSelect');
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'trackSelect', null, { timeout: 30000 });
  await sleep(1200);
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const cur = await page.evaluate(() => { const f = document.querySelector('.br-tc.is-focus, .br-tc.is-on, .br-tc[aria-current="true"]'); const r = f?.getBoundingClientRect(); return f ? { id: f.getAttribute('data-track') ?? f.textContent?.slice(0, 6), vis: !!r && r.left >= -1 && r.right <= innerWidth + 1 } : null; });
    if (cur?.vis) seen.add(cur.id);
    await page.keyboard.press('ArrowRight'); await sleep(250);
  }
  expect(seen.size >= 5, `quick race: → walks all five tracks and the focused card is always fully on screen (${seen.size})`);
  await noErrors(h, 'screens');
}, { size: '1280x720' });

// 3. Race HUD: the core widgets are there; the slipstream is announced once (r5 shows a SLIPSTREAM callout AND a
//    speedo tag at the same time); the AIR TRICK key card leaves when the player lands (r5: it lingered 4 s on the road).
await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=7&manual=1&traffic=0&police=0');
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/hint/i.test(k)) localStorage.removeItem(k); });
  await page.evaluate(() => { const b = window.__br; b.manual(true); for (let i = 0; i < 60 && b.session()?.phase !== 'racing'; i++) b.step(30); b.step(240); });
  const hud = await page.evaluate(async () => {
    const b = window.__br, s = b.session(), p = s.player, t = s.track;
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const core = ['.spd', '.sk', '.brh-corner.tl'].filter((sel) => [...document.querySelectorAll(sel)].some(vis)).length;
    // slipstream: ride 2 s right behind a rival
    let slip = 0;
    const lead = s.riders.find((r) => !r.isPlayer);
    for (let i = 0; i < 120; i++) {
      b.teleport(lead.id, p.s + 4.5, p.x); lead.speed = p.speed;
      b.setControls({ throttle: 1 }); b.step(1);
      if (i % 6 === 0) {
        await frame();
        slip = Math.max(slip, [...document.querySelectorAll('.brh *')].filter((e) => vis(e) && e.children.length === 0 && /SLIPSTREAM/.test(e.textContent ?? '')).length);
      }
    }
    for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, Math.min(t.length - 5, p.s + 900), 0);
    // the biggest jump: the trick card shows in the air and is gone 0.6 s after the landing
    const f = t.features.filter((x) => (x.kind === 'ramp' || x.kind === 'jumpCrest') && x.s0 > p.s + 80).sort((x, y) => x.s0 - y.s0)[0];
    b.teleport(p.id, f.s0 - 60, (f.x0 + f.x1) / 2); p.speed = 22;
    let shownAir = false, landedAt = -1, afterLand = 0;
    for (let k = 0; k < 400; k++) {
      b.setControls({ throttle: 1 }); b.step(1);
      const card = () => [...document.querySelectorAll('.ht-card')].some((e) => vis(e) && /AIR TRICK/.test(e.textContent ?? ''));
      if (p.airborne && k % 4 === 0) { await frame(); if (card()) shownAir = true; }
      if (!p.airborne && shownAir && landedAt < 0) landedAt = k;
      if (landedAt >= 0 && k - landedAt === 36) { await frame(); afterLand = card() ? 1 : 0; break; }
    }
    return { core, slip, shownAir, afterLand, landed: landedAt >= 0 };
  });
  expect(hud.core === 3, `the race HUD shows its core widgets: speedometer, skills, place / progress (${hud.core}/3)`);
  expect(hud.slip <= 1, `the slipstream is announced once (not a callout and a speedo tag at the same time) (${hud.slip} visible)`);
  expect(hud.shownAir && hud.landed && hud.afterLand === 0, `the AIR TRICK key card shows in the air and is gone 0.6 s after landing (${JSON.stringify(hud)})`);
  await noErrors(h, 'hud');
}, { size: '1280x720' });

// 4. First visit on 8 Mbps (production build on :5301): the menu never shows the drawn stand-in; boot fetches no race fonts.
if (!skip.has('net')) {
  const { chromium } = createRequire(new URL('../../package.json', import.meta.url))('playwright');
  const base = process.env.BR_PREVIEW ?? 'http://127.0.0.1:5301';
  const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 30, downloadThroughput: 8 * 125000, uploadThroughput: 2e6 });
    const fonts = new Map();
    cdp.on('Network.responseReceived', (e) => { if (/\.woff2?(\?|$)/.test(e.response.url)) fonts.set(e.requestId, 0); });
    cdp.on('Network.loadingFinished', (e) => { if (fonts.has(e.requestId)) fonts.set(e.requestId, e.encodedDataLength); });
    await page.goto(base + '/', { waitUntil: 'load', timeout: 300000 });
    // the title takes the key once its wipe is done (ui.busy false)
    await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'title' && !window.__br.app.ui.busy, null, { timeout: 300000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__br.app.ui.screen === 'menu', null, { timeout: 300000 });
    // sample the menu for 3 s: the drawn stand-in (.br-portrait.is-fallback inside the hero) must never be visible
    let standIn = 0;
    for (let i = 0; i < 30; i++) {
      standIn += await page.evaluate(() => {
        const s = document.querySelector('.br-menu-hero .br-portrait');
        if (!s) return 0;
        const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
        const drawn = s.classList.contains('is-fallback') || !!s.querySelector('.br-portrait-svg');
        return drawn && r.width > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.1 && !document.querySelector('.br-menu-portrait.is-backing') ? 1 : 0;
      });
      await sleep(100);
    }
    const art = await page.evaluate(() => { const a = document.querySelector('.br-menu-art'); return !!a && !a.classList.contains('br-art-pending'); });
    const fontMB = [...fonts.values()].reduce((x, y) => x + y, 0) / 1048576;
    expect(standIn === 0 && art, `8 Mbps first visit: the menu shows its art, never the drawn stand-in (${standIn} samples with the stand-in, art ${art})`);
    expect(fontMB <= 1.6, `title + menu fetch ≤ 1.6 MB of fonts (race fonts load with the race) (${fontMB.toFixed(2)} MB; r5: 5.1 MB)`);
  } finally {
    await b.close();
  }
}

finish('r6-ui');
