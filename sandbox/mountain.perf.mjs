#!/usr/bin/env node
// Sunset Pass perf sweep: draw calls / triangles per chase view (both lanes) along the whole track in the
// track sandbox (shadows on). The sandbox camera is narrower than the game's speed FOV (it under-reports by
// ~15 %), so it gates at 85 % of the unit budget (250 calls / 800k tris); mountain.perfgame.mjs measures the game.
//   node sandbox/mountain.perf.mjs [--step 50] [--quality high]
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const BUDGET = { calls: Math.round(250 * 0.85), tris: Math.round(800_000 * 0.85) };
const rows = await withPage(async (page) => {
  await page.goto(`${BASE}/sandbox/track.html?track=mountain&s=60&quality=${a.quality ?? 'high'}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 90000 });
  return page.evaluate((step) => {
    const out = [];
    const t = window.__trk.track;
    for (let s = 0; s <= t.length; s += step) {
      for (const x of [-2, 2]) {
        window.__trk.view(s, x, 'chase');
        const st = window.__trk.stats();
        out.push({ s, x, calls: st.calls, tris: st.triangles });
      }
    }
    return out;
  }, Number(a.step ?? 50));
});
const max = (k) => rows.reduce((m, r) => (r[k] > m[k] ? r : m));
const over = rows.filter((r) => r.calls > BUDGET.calls || r.tris > BUDGET.tris);
const avg = (k) => Math.round(rows.reduce((t, r) => t + r[k], 0) / rows.length);
console.log(`views ${rows.length} · avg calls ${avg('calls')} · avg tris ${Math.round(avg('tris') / 1000)}k`);
console.log('max calls', JSON.stringify(max('calls')), '· max tris', JSON.stringify(max('tris')));
for (const r of over) console.log(`OVER s=${r.s} x=${r.x} calls=${r.calls} tris=${Math.round(r.tris / 1000)}k`);
process.exit(over.length ? 1 : 0);
