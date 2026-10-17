#!/usr/bin/env node
// Triangle / draw-call budget of the track: totals per batch kind and what one chase view renders.
//   node sandbox/track.stats.mjs [--s 1200]
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
await withPage(async (page) => {
  await page.goto(`${BASE}/sandbox/track.html?s=${a.s ?? 60}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 60000 });
  const res = await page.evaluate(() => {
    const kinds = {};
    let meshes = 0;
    window.__trk.track.group.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const key = o.name.split(':')[0] + (o.userData.isOutline ? ':hull' : '');
      kinds[key] = kinds[key] ?? { meshes: 0, tris: 0 };
      kinds[key].meshes++;
      kinds[key].tris += tris;
    });
    const sorted = Object.entries(kinds).sort((x, y) => y[1].tris - x[1].tris);
    const total = sorted.reduce((n, [, v]) => n + v.tris, 0);
    return { meshes, totalTris: Math.round(total), kinds: Object.fromEntries(sorted.map(([k, v]) => [k, `${v.meshes} meshes, ${Math.round(v.tris / 1000)}k tris`])) };
  });
  console.log(JSON.stringify(res, null, 1));
});
