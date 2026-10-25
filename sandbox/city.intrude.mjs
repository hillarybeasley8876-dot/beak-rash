#!/usr/bin/env node
// Props / faces that reach into the drivable road below head height (riders and the chase camera
// would ghost through them). Projects the vertices of the city's dressing batches to track space.
//   node sandbox/city.intrude.mjs [--ymax 3.5] [--margin 0.05] [--fail 2.5] [--track mountain]
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
await withPage(async (page) => {
  await page.goto(`${BASE}/sandbox/track.html?track=${a.track ?? 'city'}&s=60&quality=high`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 90000 });
  const hits = await page.evaluate(([ymax, margin]) => {
    const t = window.__trk.track;
    const CELL = 12, grid = new Map();
    const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    for (let s = 0; s <= t.length + 200; s += 3) {
      const f = t.frameAt(s);
      const k = key(f.pos.x, f.pos.z);
      if (!grid.has(k)) grid.set(k, s);
    }
    const near = (x, z) => {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const s = grid.get(`${cx + dx},${cz + dz}`);
        if (s !== undefined) return s;
      }
      return null;
    };
    const skip = /^(near|city:wet|city:rain|city:walls|city:tiles|paint|pools|road|terrain|far|sea|sky|pickup|feature|kerb|curb)/i;
    const out = new Map();
    t.group.updateMatrixWorld(true);
    t.group.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline || skip.test(o.name)) return;
      const pos = o.geometry.getAttribute('position');
      if (!pos) return;
      const e = o.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const p = { x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14] };
        const hint = near(p.x, p.z);
        if (hint === null) continue;
        const r = t.project(p, hint);
        if (r.s < 0 || r.s > t.length || r.y < 0.05 || r.y > ymax) continue;
        const b = t.bounds(r.s);
        const inside = Math.max(r.x - (b.right - margin), -b.left + margin - r.x);
        if (inside >= 0) continue;
        const k2 = `${o.name.split(':').slice(0, 2).join(':')}@${Math.round(r.s / 5) * 5}`;
        const prev = out.get(k2);
        const depth = -inside;
        if (!prev || depth > prev.depth) out.set(k2, { depth: +depth.toFixed(2), x: +r.x.toFixed(2), y: +r.y.toFixed(2) });
      }
    });
    return [...out.entries()].sort((p, q) => q[1].depth - p[1].depth).slice(0, 40);
  }, [Number(a.ymax ?? 3.5), Number(a.margin ?? 0.05)]);
  console.log(hits.length ? hits.map(([k, v]) => `${k} depth=${v.depth} x=${v.x} y=${v.y}`).join('\n') : 'no intrusions');
  // Anything inside the drivable road below --fail m (default 2.5: rider + chase camera height) fails.
  const low = hits.filter(([, v]) => v.y < Number(a.fail ?? 2.5));
  console.log(low.length ? `FAIL: ${low.length} intrusions below ${a.fail ?? 2.5} m` : `ok: nothing below ${a.fail ?? 2.5} m`);
  process.exitCode = low.length ? 1 : 0;
});
