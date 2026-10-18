#!/usr/bin/env node
// species/actors: turntable sheets — every species × views composed into one PNG.
//   node tools/actors-sheet.mjs <out.png> [ids=all] [views=front,34,side,back] [query extra] [js per rider]
// e.g. node tools/actors-sheet.mjs shots/species/sheet.png pelican,goose 34,chase "speed=6&dist=3"
import fs from 'node:fs';
import path from 'node:path';
import { withPage } from './lib.mjs';

const ALL = ['pelican', 'goose', 'capybara', 'cat', 'shiba', 'pigeon', 'penguin', 'seagull', 'sloth', 'corgi'];
const [out = 'shots/species/sheet.png', idsArg = 'all', viewsArg = 'front,34,side,back', extra = '', js = ''] = process.argv.slice(2);
const ids = idsArg === 'all' ? ALL : idsArg.split(',');
const views = viewsArg.split(',');
const TW = Number(process.env.TW ?? 300), TH = Number(process.env.TH ?? 360);

const tiles = [];
await withPage(async (page, h) => {
  await h.goto(`/sandbox/actors.html?panel=0&speed=0&c=${ids[0]}&${extra}`);
  // Warm-up: compile shaders and present a first frame so the first tile is never blank.
  await page.evaluate(() => window.__actors.step(30));
  await page.screenshot({ type: 'png' });
  for (const id of ids) {
    await page.evaluate((c) => window.__actors.set({ character: c }), id);
    if (js) await page.evaluate(js);
    for (const v of views) {
      await page.evaluate((view) => { window.__actors.set({ view }); window.__actors.step(Number(new URLSearchParams(location.search).get('frames') ?? 20)); }, v);
      const buf = await page.screenshot({ type: 'png' });
      tiles.push({ id, v, b64: buf.toString('base64') });
    }
  }
  const errs = await h.errors();
  if (errs.length) console.log('errors:', errs.slice(0, 5));
}, { size: `${TW}x${TH}` });

await withPage(async (page) => {
  const cols = views.length;
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${TW}px);gap:2px">${tiles
    .map((t) => `<div style="position:relative"><img src="data:image/png;base64,${t.b64}" width=${TW} height=${TH}><span style="position:absolute;left:4px;top:2px;font:12px sans-serif;color:#000">${t.id} ${t.v}</span></div>`)
    .join('')}</body>`;
  await page.setContent(html);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
}, { size: `${views.length * (TW + 2)}x${TH}` });
console.log(out);
