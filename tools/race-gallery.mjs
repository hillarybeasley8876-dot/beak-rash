#!/usr/bin/env node
// Screenshots of the traffic gallery sandbox (sandbox/race.html).
//   node tools/race-gallery.mjs [--views row,front,back,side] [--type bus] [--night] [--out shots/race/gallery]
import { BASE, parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const views = String(a.views ?? 'row').split(',');
const out = a.out ?? 'shots/race/gallery';
await withPage(async (page, h) => {
  for (const view of views) {
    const q = new URLSearchParams({ view, ...(a.type ? { type: a.type } : {}), ...(a.angle ? { angle: a.angle } : {}), ...(a.night ? { night: '1' } : {}) });
    await page.goto(`${BASE}/sandbox/race.html?${q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.sandboxReady === true, null, { timeout: 30000 });
    await page.evaluate(() => window.sandboxRender?.(0.3));
    const file = `${out}-${view}${a.type ? `-${a.type}` : ''}${a.night ? '-night' : ''}.png`;
    await page.screenshot({ path: file });
    console.log(file);
  }
  console.log(JSON.stringify({ console: h.logs.slice(0, 10) }));
}, { size: a.size ?? '1280x720' });
