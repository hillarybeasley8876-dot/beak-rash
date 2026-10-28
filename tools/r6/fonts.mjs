#!/usr/bin/env node
// r6 acceptance: one source for the CJK faces (SPEC §26). Lead-owned, read-only for workers. On the production build
// (:5301 — rebuild first), a first visit to the menu and then a race fetch their Chinese glyphs only from the
// subset (`/fonts/cjk/`), never from a bundled @fontsource CJK slice; and no code deletes style rules at runtime.
//   node tools/r6/fonts.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, finish } from '../r4/accept-lib.mjs';

const base = process.env.BR_PREVIEW ?? 'http://127.0.0.1:5301';
const CJK = /(zcool-kuaile|zcool-qingke-huangyou|ma-shan-zheng|zhi-mang-xing|noto-sans-sc)[^/]*\.woff2?(\?|$)/;
const { chromium } = createRequire(new URL('../../package.json', import.meta.url))('playwright');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const fonts = [];
  page.on('request', (r) => { if (/\.woff2?(\?|$)/.test(r.url())) fonts.push(r.url().replace(base, '')); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/?screen=menu', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'menu', null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  const menuFonts = fonts.length;
  await page.goto(base + '/?race=coast&seed=3&traffic=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => (window.__br?.session?.()?.time ?? 0) > 3, null, { timeout: 180000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  const bundled = fonts.filter((u) => CJK.test(u) && !u.includes('/fonts/cjk/'));
  const subset = fonts.filter((u) => u.includes('/fonts/cjk/'));
  expect(bundled.length === 0, `no bundled @fontsource CJK slice is fetched on the menu or in a race (${bundled.length}: ${bundled.slice(0, 4).join(' ')})`);
  expect(subset.length > 0, `the Chinese glyphs come from the subset /fonts/cjk/ (${subset.length} files; ${menuFonts} font requests on the menu, ${fonts.length} in all)`);
  expect(errors.length === 0, `no page errors (${errors.slice(0, 2).join(' | ')})`);
} finally {
  await b.close();
}
const src = ['src/ui/fonts.ts', 'src/ui/hud/fonts.ts', 'src/world/fonts.ts'].map((p) => fs.readFileSync(p, 'utf8')).join('\n');
expect(!/deleteRule|dropSuperseded/.test(src), 'no font module deletes style rules at runtime (dropSupersededFaces is gone)');
expect(!/@fontsource\/(zcool|ma-shan|zhi-mang|noto-sans-sc)/.test(src), 'no font module imports a bundled @fontsource CJK face');
finish('r6-fonts');
