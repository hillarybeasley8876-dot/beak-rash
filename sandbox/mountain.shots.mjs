#!/usr/bin/env node
// Sunset Pass screenshots.
//   node sandbox/mountain.shots.mjs --plan --out shots/env-mountain/plan.png      2D plan bench (+ stats)
//   node sandbox/mountain.shots.mjs --q "s=600&x=2" --out shots/env-mountain/a.png 3D track sandbox view
//   node sandbox/mountain.shots.mjs --views "600:2:chase,1200:0:high" --out shots/env-mountain/v
//     (several views in one page load: <out>_<s>_<mode>.png; modes chase|high|side|aerial|from)
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const out = a.out ?? 'shots/env-mountain/shot.png';
await withPage(async (page, h) => {
  const info = [];
  page.on('console', (m) => { if (m.text().startsWith('[track]') || m.text().startsWith('[mountain]')) info.push(m.text()); });
  if (a.plan) {
    await page.goto(`${BASE}/sandbox/mountain.html?${a.q ?? ''}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__mtn?.ready === true, null, { timeout: 60000 });
    await h.shot(out);
    console.log(JSON.stringify({ out, stats: await page.evaluate(() => window.__mtn.stats), console: h.logs.slice(0, 20) }, null, 1));
    return;
  }
  const t0 = Date.now();
  await page.goto(`${BASE}/sandbox/track.html?track=mountain&${a.q ?? ''}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 90000 });
  const built = Date.now() - t0;
  if (a.eval) await page.evaluate(a.eval);
  const shots = [];
  if (a.views) {
    for (const v of String(a.views).split(',')) {
      const [s, x, mode] = v.split(':');
      await page.evaluate(([sv, xv, m]) => window.__trk.view(Number(sv), Number(xv), m), [s, x ?? '2', mode ?? 'chase']);
      const file = `${out.replace(/\.png$/, '')}_${s}_${mode ?? 'chase'}.png`;
      await h.shot(file);
      shots.push({ file, stats: await page.evaluate(() => window.__trk.stats()) });
    }
  } else {
    if (a.wait) await h.sleep(Number(a.wait));
    await h.shot(out);
    shots.push({ file: out, stats: await page.evaluate(() => window.__trk.stats()) });
  }
  console.log(JSON.stringify({ built, shots, track: info, console: h.logs.slice(0, 30) }, null, 1));
}, { size: a.size ?? '1280x720' });
