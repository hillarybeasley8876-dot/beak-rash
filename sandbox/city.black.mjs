#!/usr/bin/env node
// env-city regression check: no black voids beside the outer lanes. Rider at x = ±X every STEP m; the
// fraction of near-black pixels (luma < 10) in the outer third of the frame (y 8–70 %, HUD-free band)
// must stay below --max (default 0.25). Defaults scan the neon arcade; --s0 0 --s1 3378 scans it all.
//   node sandbox/city.black.mjs [--s0 840] [--s1 1080] [--step 20] [--x 6.5,3.5] [--max 0.25] [--dump shots/env-city/black]
import fs from 'node:fs';
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const s0 = Number(a.s0 ?? 840), s1 = Number(a.s1 ?? 1080), step = Number(a.step ?? 20), max = Number(a.max ?? 0.25);
const xs = String(a.x ?? '6.5,3.5').split(',').map(Number);
const dump = a.dump ? String(a.dump) : null; // directory for the frames over the limit
const rows = await withPage(async (page, h) => {
  await h.goto('/?race=city&seed=3&traffic=0&police=0&quality=high');
  await h.controls({ throttle: 1 });
  await h.step(480);
  // HUD hidden: the scan measures the world only.
  await h.eval(`(() => { const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; })()`);
  const out = [];
  for (let s = s0; s <= s1; s += step) {
    for (const x of xs) for (const side of [1, -1]) {
      await h.eval(`(() => { const b = window.__br, ss = b.session(); for (const r of ss.riders) { if (r.isPlayer) b.teleport(r.id, ${s}, ${side * x}); else b.teleport(r.id, ${s} + 400 + r.id * 3, 0); } })()`);
      await h.step(40);
      const b64 = (await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64');
      const frac = await page.evaluate(async ([data, sd]) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${data}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const w = Math.floor(img.width / 3), y0 = Math.floor(img.height * 0.08), hh = Math.floor(img.height * 0.62);
        const d = g.getImageData(sd > 0 ? img.width - w : 0, y0, w, hh).data;
        let n = 0;
        for (let k = 0; k < d.length; k += 4) if (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2] < 10) n++;
        return +(n / (d.length / 4)).toFixed(3);
      }, [b64, side]);
      out.push({ s, x: side * x, frac });
      if (dump && frac > max) { fs.mkdirSync(dump, { recursive: true }); fs.writeFileSync(`${dump}/bk_${s}_${side * x}.jpg`, Buffer.from(b64, 'base64')); }
    }
  }
  return { out, errors: await h.errors() };
}, { size: '1280x720' });
const bad = rows.out.filter((r) => r.frac > max);
console.log(JSON.stringify({ n: rows.out.length, max, bad, worst: [...rows.out].sort((p, q) => q.frac - p.frac).slice(0, 8), errors: rows.errors.slice(0, 5) }));
process.exit(bad.length || rows.errors.length ? 1 : 0);
