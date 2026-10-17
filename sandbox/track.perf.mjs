#!/usr/bin/env node
// Draw calls / triangles per chase view along the whole track (sandbox renderer, shadows on).
//   node sandbox/track.perf.mjs [--step 150] [--quality high]
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
await withPage(async (page) => {
  await page.goto(`${BASE}/sandbox/track.html?s=60&quality=${a.quality ?? 'high'}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 60000 });
  const rows = await page.evaluate((step) => {
    const out = [];
    const t = window.__trk.track;
    for (let s = 0; s <= t.length; s += step) {
      window.__trk.view(s, 2, 'chase');
      const st = window.__trk.stats();
      out.push({ s, calls: st.calls, tris: st.triangles });
    }
    return out;
  }, Number(a.step ?? 150));
  const max = (k) => rows.reduce((m, r) => (r[k] > m[k] ? r : m));
  console.log(rows.map((r) => `s=${r.s} calls=${r.calls} tris=${Math.round(r.tris / 1000)}k`).join('\n'));
  console.log('max calls', JSON.stringify(max('calls')), 'max tris', JSON.stringify(max('tris')));
});
