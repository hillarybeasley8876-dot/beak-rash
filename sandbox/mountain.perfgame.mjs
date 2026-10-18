#!/usr/bin/env node
// Sunset Pass in-game perf gate: a stepped autopilot race at 1920x1080 in the real chase camera (speed FOV,
// shadow frustum on the real camera). Every N frames the scene is rendered with and without the track group;
// the difference is the track's own share (incl. shadow passes). Exit 1 if a sample exceeds the unit budget.
//   node sandbox/mountain.perfgame.mjs [--seed 3] [--every 90] [--quality high]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const BUDGET = { calls: 250, tris: 800_000 };
const every = Number(a.every ?? 90);
const res = await withPage(async (page, h) => {
  await h.goto(`/?race=mountain&seed=${a.seed ?? 3}&autopilot=1&manual=1&quality=${a.quality ?? 'high'}${a.q ?? ''}`, { timeout: 120000 });
  const rows = [];
  for (let f = 0; f < 15000; f += every) {
    await h.step(every);
    const r = await page.evaluate(() => {
      const br = window.__br, s = br.session(), { renderer, scene, camera } = br.app;
      const meas = () => { renderer.info.reset(); renderer.setRenderTarget(null); renderer.render(scene, camera); return { c: renderer.info.render.calls, t: renderer.info.render.triangles }; };
      const all = meas();
      s.track.group.visible = false;
      const no = meas();
      s.track.group.visible = true;
      return { s: Math.round(s.player.s), phase: s.phase, calls: all.c - no.c, tris: all.t - no.t };
    });
    rows.push(r);
    if (r.phase === 'finished' || r.phase === 'results') break;
  }
  return { rows, errors: (await h.errors()).slice(0, 10) };
}, { size: '1920x1080' });
const rows = res.rows.filter((r) => r.phase === 'racing');
const max = (k) => rows.reduce((m, r) => (r[k] > m[k] ? r : m));
const avg = (k) => Math.round(rows.reduce((t, r) => t + r[k], 0) / Math.max(1, rows.length));
const over = rows.filter((r) => r.calls > BUDGET.calls || r.tris > BUDGET.tris);
console.log(`samples ${rows.length} · avg calls ${avg('calls')} · avg tris ${Math.round(avg('tris') / 1000)}k`);
console.log('max calls', JSON.stringify(max('calls')), '· max tris', JSON.stringify(max('tris')));
for (const r of over) console.log(`OVER s=${r.s} calls=${r.calls} tris=${Math.round(r.tris / 1000)}k`);
console.log('errors', JSON.stringify(res.errors));
process.exit(over.length || res.errors.length ? 1 : 0);
