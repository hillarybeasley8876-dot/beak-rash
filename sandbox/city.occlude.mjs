#!/usr/bin/env node
// env-city regression check: nothing may cover the wet road overlay inside the drivable road.
// Chase camera at several s (grade changes + flat controls), rays through the lower screen; the first
// hit inside the drivable bound must be the overlay (city:wet). Terrain or the bare road first = fail.
//   node sandbox/city.occlude.mjs [--s 2160,2200] [--x 0]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const ranges = [[1500, 1650], [2150, 2240], [2520, 2600]];
const list = a.s ? String(a.s).split(',').map(Number) : [600, 1000, ...ranges.flatMap(([s0, s1]) => { const o = []; for (let s = s0; s <= s1; s += 10) o.push(s); return o; })];
const IGNORE = /^(body:|SkinnedMesh|sky|city:rain|pickup|fx|bike|rider|shadow)/;
const res = await withPage(async (page, h) => {
  await h.goto('/?race=city&seed=3&autopilot=1&traffic=0&police=0');
  await h.controls({ throttle: 1 });
  await h.step(200);
  await h.eval(`window.__occT = import('/node_modules/three/build/three.module.js')`);
  const fails = [];
  const others = [];
  let rays = 0;
  for (const s of list) {
    await h.eval(`(() => { const b = window.__br; const ss = b.session();
      for (const r of ss.riders) { if (r.isPlayer) { b.teleport(r.id, ${s}, ${Number(a.x ?? 0)}); r.speed = 19.5; } else b.teleport(r.id, ${s} + 300 + r.id * 8, 0); } })()`);
    await h.step(30);
    const out = await h.eval(`(async () => {
      const T = await window.__occT; const ss = window.__br.session(); const cam = ss.app.camera; const t = ss.track;
      const rc = new T.Raycaster(); const meshes = []; const bad = []; const other = []; let n = 0;
      ss.app.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible && o.geometry && !${IGNORE}.test(o.name || o.type)) meshes.push(o); });
      const hint = ss.riders.find((r) => r.isPlayer).s;
      for (const nx of [-0.6, -0.3, 0, 0.3, 0.6]) for (const ny of [-0.15, -0.3, -0.5, -0.7, -0.9]) {
        rc.setFromCamera(new T.Vector2(nx, ny), cam);
        const hits = rc.intersectObjects(meshes, false);
        const first = hits[0]; if (!first) continue;
        const p = t.project(first.point, hint); const bd = t.bounds(p.s);
        if (p.x < -bd.left + 0.25 || p.x > bd.right - 0.25 || Math.abs(p.y) > 1.5) continue;
        n++;
        const nm = first.object.name || first.object.type;
        // Decals (pools, paint, curbs) sit on top of the overlay; terrain or the bare road first = covered.
        if (/^(near|far|road|shoulder)/.test(nm)) bad.push([nm, +p.s.toFixed(1), +p.x.toFixed(2), +p.y.toFixed(2)]);
        else if (nm !== 'city:wet' && p.y > 0.08) other.push([nm, +p.s.toFixed(1), +p.x.toFixed(2), +p.y.toFixed(2)]);
      }
      return { n, bad, other }; })()`);
    rays += out.n;
    for (const b of out.bad) fails.push({ s, hit: b });
    for (const o of out.other) others.push({ s, hit: o });
  }
  return { rays, fails, others, errors: (await h.errors()).slice(0, 5) };
}, { size: '1280x720' });
console.log(JSON.stringify({ rays: res.rays, fails: res.fails.length, sample: res.fails.slice(0, 12), raised: res.others.slice(0, 8), errors: res.errors }));
process.exit(res.fails.length || res.errors.length ? 1 : 0);
