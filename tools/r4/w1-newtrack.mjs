#!/usr/bin/env node
// r4 acceptance: a NEW track (w1-track-watertown / w1-track-gobi, SPEC §20). Lead-owned, read-only for workers.
//   node tools/r4/w1-newtrack.mjs --track watertown [--min ramp:2,bridge:2] [--shots shots/r4-x]
// Checks: builds and races with 0 errors; its own layout (not the coast stand-in) within the geometry limits; its own
// dressing under a group named `dress:<id>`; a full autopilot race finishes; draw calls / triangles within budget at
// six spots; saves six chase stills for the lead's visual review.
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const id = String(a.track ?? '');
if (!id) { console.error('usage: --track <id>'); process.exit(2); }
const mins = String(a.min ?? '').split(',').filter(Boolean).map((x) => x.split(':')).map(([k, n]) => [k, Number(n)]);
const shots = String(a.shots ?? `shots/r4-newtrack-${id}`);
fs.mkdirSync(shots, { recursive: true });

await withPage(async (page, h) => {
  // The coast's own layout signature: a new track must not still be the coast stand-in.
  await h.goto('/?race=coast&seed=3&manual=1&traffic=0&police=0', { timeout: 120000 });
  const coastSig = await page.evaluate(() => {
    const b = window.__br;
    b.manual(true);
    for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
    const t = b.session().track;
    return JSON.stringify([Math.round(t.length), t.features.map((f) => [f.kind, Math.round(f.s0), Math.round(f.s1)])]);
  });
  await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0&autopilot=1`, { timeout: 120000 });
  const geo = await page.evaluate(async () => {
    const b = window.__br;
    b.manual(true);
    for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
    const s = b.session(), t = s.track;
    let maxK = 0;
    for (let d = 0; d <= t.length; d += 2) maxK = Math.max(maxK, Math.abs(t.frameAt(d).curvature));
    const kinds = {};
    for (const f of t.features) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
    const dress = t.group.getObjectByName(`dress:${t.id}`);
    let tris = 0, meshes = 0;
    dress?.traverse((o) => { if (o.isMesh && o.geometry) { meshes++; const g = o.geometry; const n = g.index ? g.index.count : g.getAttribute('position').count; tris += (n / 3) * (o.isInstancedMesh ? o.count : 1); } });
    const sig = JSON.stringify([Math.round(t.length), t.features.map((f) => [f.kind, Math.round(f.s0), Math.round(f.s1)])]);
    return { phase: s.phase, length: t.length, maxK, kinds, dress: !!dress, tris: Math.round(tris), meshes, look: t.look.name, sig };
  });
  expect(geo.phase === 'racing', `${id}: the race starts (${geo.phase})`);
  expect(geo.length >= 2800 && geo.length <= 4400, `${id}: length ${Math.round(geo.length)} m within 2800–4400`);
  expect(geo.sig !== coastSig, `${id}: its own layout, not the coast stand-in`);
  expect(geo.maxK <= 1 / 22, `${id}: tightest curve R ${geo.maxK ? (1 / geo.maxK).toFixed(1) : '∞'} m ≥ 22 m`);
  for (const [k, n] of mins) expect((geo.kinds[k] ?? 0) >= n, `${id}: at least ${n} '${k}' features (${geo.kinds[k] ?? 0})`);
  expect(geo.dress && geo.tris >= 100000 && geo.meshes >= 10, `${id}: own dressing under dress:${id} (${geo.meshes} meshes, ${geo.tris} tris)`);

  // budget + stills at six spots (UI hidden)
  await page.addStyleTag({ content: '.br-ui, #ui { display: none !important; }' });
  const spots = [0.08, 0.24, 0.4, 0.56, 0.72, 0.9].map((f) => Math.round(geo.length * f));
  let worst = { calls: 0, tris: 0 };
  for (const s of spots) {
    const perf = await page.evaluate((at) => {
      const b = window.__br, ss = b.session();
      for (const r of ss.riders) { if (r.isPlayer) b.teleport(r.id, at, 1.2); else b.teleport(r.id, at + 25 + r.id * 5, ((r.id % 3) - 1) * 2.5); }
      b.step(45);
      const { renderer, scene, camera } = b.app;
      renderer.info.reset();
      renderer.render(scene, camera);
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    }, s);
    worst = { calls: Math.max(worst.calls, perf.calls), tris: Math.max(worst.tris, perf.tris) };
    await h.shot(`${shots}/${id}-${s}.png`);
  }
  expect(worst.calls <= 420 && worst.tris <= 1400000, `${id}: budget at six spots (worst ${worst.calls} calls, ${worst.tris} tris)`);

  // a full autopilot race from the start: everyone drives it to the end
  await h.goto(`/?race=${id}&seed=4&manual=1&traffic=1&police=0&autopilot=1`, { timeout: 120000 });
  const run = await page.evaluate(async () => {
    const b = window.__br;
    b.manual(true);
    let ended = null;
    b.app.bus.on('race:end', (p) => { ended = p.results; });
    const crashes = { player: 0 };
    b.app.bus.on('rider:crash', (e) => { if (e.riderId === 0 && (e.cause === 'water' || e.cause === 'wall')) crashes.player++; });
    for (let i = 0; i < 400 && !ended; i++) { b.step(60); await new Promise((r) => setTimeout(r, 0)); }
    return { ended: !!ended, finished: ended ? ended.filter((r) => r.time !== null).length : 0, time: b.session()?.time ?? 0, crashes: crashes.player };
  });
  expect(run.ended && run.finished >= 6, `${id}: an autopilot race reaches race:end with ≥ 6 finishers (${run.finished}, ${Math.round(run.time)} s)`);
  expect(run.crashes <= 4, `${id}: the autopilot player rarely leaves the road (wall/water crashes ${run.crashes})`);
  await noErrors(h, id);
}, { size: '1280x720' });

finish(`w1-newtrack ${id}`);
