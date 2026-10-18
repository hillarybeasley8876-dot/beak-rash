#!/usr/bin/env node
// Close-up views of the city bench (sandbox/city.html), tiled into one PNG.
//   node sandbox/city.views.mjs --views "s,x,h,ls,lx,ly;…" --out shots/env-city/v.png [--size 1600x900]
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const views = String(a.views ?? '60,0,2,80,0,1').split(';').map((v) => v.split(',').map(Number));
await withPage(async (page, h) => {
  const info = [];
  page.on('console', (m) => { if (/^\[(track|env-city)\]/.test(m.text())) info.push(m.text()); });
  await page.goto(`${BASE}/sandbox/city.html?${a.q ?? ''}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__city?.ready === true, null, { timeout: 90000 });
  if (a.eval) console.log(JSON.stringify(await page.evaluate(a.eval)));
  const stats = await page.evaluate((v) => window.__city.sheet(v), views);
  await h.shot(a.out ?? 'shots/env-city/views.png');
  console.log(JSON.stringify({ out: a.out, stats, track: info, console: h.logs.slice(0, 20) }));
}, { size: a.size ?? '1600x900' });
