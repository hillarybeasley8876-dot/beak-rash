#!/usr/bin/env node
// Triangle budget breakdown per bike (run with the dev server up):
//   node sandbox/bikes.tris.mjs [--bikes roadbike,mtb] [--quality high] [--top 12] [--far]
// Builds each bike template in the sandbox page with PartSet.add instrumented and groups the triangles by
// the calling function (wheel, crankset, saddle …), so tri-budget work knows where the triangles go.
// --far: the distance-LOD build (what a rival beyond ~40 m draws; detail parts never reach PartSet.add).
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const bikes = String(a.bikes ?? 'roadbike,erba,shared,fixie,mtb,tandem,kidbike,llm').split(',');
await withPage(async (page, h) => {
  await page.goto(`${BASE}/sandbox/bikes.html?manual=1&spin=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bikes?.ready === true, null, { timeout: 60000 });
  const out = await page.evaluate(async ({ bikes, quality, top, far }) => {
    const { PartSet } = await import('/src/actors/bikes/build/partset.ts');
    const { buildTemplate } = await import('/src/actors/bikes/cache.ts');
    const add = PartSet.prototype.add;
    let rec = new Map();
    PartSet.prototype.add = function (geo, o) {
      const lines = (new Error().stack ?? '').split('\n').slice(2);
      const frame = lines.find((l) => !l.includes('partset.ts')) ?? '?';
      const m = frame.match(/at (\S+) .*\/([\w.-]+\.ts)/) ?? frame.match(/\/([\w.-]+\.ts)/);
      const key = m ? (m.length > 2 ? `${m[1]}@${m[2]}` : m[1]) : frame.trim();
      const tris = (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3;
      rec.set(key, (rec.get(key) ?? 0) + tris);
      return add.call(this, geo, o);
    };
    const res = {};
    for (const id of bikes) {
      rec = new Map();
      const tpl = buildTemplate(id, quality, far);
      res[id] = { total: tpl.tris, parts: [...rec].sort((x, y) => y[1] - x[1]).slice(0, top).map(([k, n]) => `${k}:${n}`) };
    }
    PartSet.prototype.add = add;
    return res;
  }, { bikes, quality: a.quality ?? 'high', top: Number(a.top ?? 12), far: a.far === true || a.far === 'true' });
  for (const [id, r] of Object.entries(out)) console.log(`${id} ${r.total}\n  ${r.parts.join('  ')}`);
  if (h.logs.length) console.log('console:', h.logs.slice(0, 10).join('\n'));
});
