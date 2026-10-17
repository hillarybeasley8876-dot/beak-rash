#!/usr/bin/env node
// Screenshots of the track sandbox (and optional in-game shots).
//   node sandbox/track.shots.mjs --q "s=1200&x=2" --out shots/track/s1200.png [--size 1280x720]
//   node sandbox/track.shots.mjs --q "view=aerial" --out shots/track/aerial.png
// Prints renderer stats and console errors as JSON.
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const out = a.out ?? 'shots/track/sandbox.png';
await withPage(async (page, h) => {
  const info = [];
  page.on('console', (m) => { if (m.text().startsWith('[track]')) info.push(m.text()); });
  await page.goto(`${BASE}/sandbox/track.html?${a.q ?? ''}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 60000 });
  if (a.eval) await page.evaluate(a.eval);
  if (a.wait) await h.sleep(Number(a.wait));
  await h.shot(out);
  const stats = await page.evaluate(() => window.__trk.stats());
  console.log(JSON.stringify({ out, stats, track: info, console: h.logs.slice(0, 30) }, null, 1));
}, { size: a.size ?? '1280x720' });
