#!/usr/bin/env node
// actors unit: load a page without waiting for __br.ready and dump console errors (debugging aid).
//   node tools/actors-probe.mjs "/sandbox/actors.html?..." [waitMs]
import { BASE, withPage } from './lib.mjs';

const url = process.argv[2] ?? '/sandbox/actors.html';
const wait = Number(process.argv[3] ?? 2500);
await withPage(async (page, h) => {
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  await h.sleep(wait);
  const ready = await page.evaluate(() => window.__br?.ready ?? false);
  console.log(JSON.stringify({ ready, logs: h.logs.slice(0, 30) }, null, 1));
});
