#!/usr/bin/env node
// r4 acceptance: w3-routes (seeded routes, SPEC §20). Lead-owned, read-only for workers.
//   node tools/r4/w3-routes.mjs [--tracks coast,city] [--race mountain,watertown] [--shots shots/r4-w3-routes]
// Per track: route 0 = the authored layout; a seeded route keeps the length within ±10 %, differs from the authored
// one and from another seed, is the same for the same seed, has no curve under R 25 m, never comes back within 40 m
// of itself (unless one passes ≥ 8 m above the other), keeps features and dressing; reverse + route builds too.
// Then a full autopilot race on a route for the twisty tracks.
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TRACKS = String(a.tracks ?? 'coast,city,mountain,watertown,gobi').split(',');
const RACE = String(a.race ?? 'mountain,watertown').split(',').filter(Boolean);
const SHOTS = String(a.shots ?? 'shots/r4-w3-routes');
fs.mkdirSync(SHOTS, { recursive: true });
const SEEDS = [4821, 77];

async function build(page, h, id, extra) {
  await h.goto(`/?race=${id}&seed=3&manual=1&traffic=0&police=0${extra}`, { timeout: 120000 });
  return page.evaluate(() => {
    const b = window.__br;
    b.manual(true);
    for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
    const s = b.session(), t = s.track;
    const V = b.app.camera.position.constructor;
    const pts = [];
    for (let d = 0; d <= t.length; d += 4) { const p = t.toWorld(d, 0, 0, new V()); pts.push([d, p.x, p.y, p.z]); }
    let maxK = 0;
    for (let d = 0; d <= t.length; d += 2) maxK = Math.max(maxK, Math.abs(t.frameAt(d).curvature));
    // the centre line never comes back near itself: non-adjacent points (|Δs| > 150 m) at least 40 m apart in plan,
    // unless one passes at least 8 m above the other (a bridge)
    let closest = Infinity, at = null;
    for (let i = 0; i < pts.length; i += 2) for (let j = i + 1; j < pts.length; j += 2) {
      const [si, xi, yi, zi] = pts[i], [sj, xj, yj, zj] = pts[j];
      if (sj - si <= 150 || Math.abs(yi - yj) >= 8) continue;
      const dd = Math.hypot(xi - xj, zi - zj);
      if (dd < closest) { closest = dd; at = [Math.round(si), Math.round(sj)]; }
    }
    const dress = t.group.getObjectByName(`dress:${t.id}`);
    let tris = 0;
    dress?.traverse((o) => { if (o.isMesh && o.geometry) { const g = o.geometry; const n = g.index ? g.index.count : g.getAttribute('position').count; tris += (n / 3) * (o.isInstancedMesh ? o.count : 1); } });
    const sample = pts.filter((_, i) => i % 25 === 0).map(([, x, , z]) => [Math.round(x), Math.round(z)]);
    return { phase: s.phase, route: t.route ?? null, reverse: !!t.reverse, length: t.length, maxK, closest, at, features: t.features.length, tris: Math.round(tris), sig: JSON.stringify(sample) };
  });
}

for (const id of TRACKS) {
  await withPage(async (page, h) => {
    const base = await build(page, h, id, '');
    const r1 = await build(page, h, id, `&route=${SEEDS[0]}`);
    await h.shot(`${SHOTS}/${id}-${SEEDS[0]}.png`);
    const r1b = await build(page, h, id, `&route=${SEEDS[0]}`);
    const r2 = await build(page, h, id, `&route=${SEEDS[1]}`);
    const rr = await build(page, h, id, `&route=${SEEDS[0]}&reverse=1`);
    expect(base.phase === 'racing' && base.route === 0, `${id}: route 0 is the authored layout (route ${base.route})`);
    for (const [r, seed] of [[r1, SEEDS[0]], [r2, SEEDS[1]]]) {
      expect(r.phase === 'racing' && r.route === seed, `${id} #${seed}: builds and races, track.route ${r.route}`);
      expect(Math.abs(r.length - base.length) <= base.length * 0.1, `${id} #${seed}: length ${Math.round(r.length)} m within ±10 % of ${Math.round(base.length)} m`);
      expect(r.sig !== base.sig, `${id} #${seed}: a different centre line than the authored layout`);
      expect(r.maxK <= 1 / 25 + 1e-4, `${id} #${seed}: tightest curve R ${r.maxK ? (1 / r.maxK).toFixed(1) : '∞'} m ≥ 25 m`);
      expect(r.closest >= 40, `${id} #${seed}: never within 40 m of itself (closest ${r.closest === Infinity ? '∞' : r.closest.toFixed(1)} m at s ${JSON.stringify(r.at)})`);
      expect(r.features >= base.features * 0.5, `${id} #${seed}: keeps features (${r.features} vs ${base.features})`);
      expect(r.tris >= base.tris * 0.6, `${id} #${seed}: dressed (${r.tris} tris vs ${base.tris})`);
    }
    expect(r1.sig === r1b.sig, `${id}: the same seed builds the same route`);
    expect(r1.sig !== r2.sig, `${id}: another seed builds another route`);
    expect(rr.phase === 'racing' && rr.reverse && rr.route === SEEDS[0] && Math.abs(rr.length - r1.length) < 1, `${id}: reverse + route builds (reverse ${rr.reverse}, route ${rr.route}, ${Math.round(rr.length)} m)`);
    await noErrors(h, `${id} routes`);
  }, { size: '1280x720' });
}

for (const id of RACE) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=4&manual=1&traffic=1&police=0&autopilot=1&route=${SEEDS[0]}`, { timeout: 120000 });
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
    expect(run.ended && run.finished >= 6, `${id} #${SEEDS[0]}: an autopilot race reaches race:end with ≥ 6 finishers (${run.finished}, ${Math.round(run.time)} s)`);
    expect(run.crashes <= 4, `${id} #${SEEDS[0]}: the autopilot player rarely leaves the road (wall/water crashes ${run.crashes})`);
    await noErrors(h, `${id} route race`);
  }, { size: '1280x720' });
}

finish('w3-routes');
