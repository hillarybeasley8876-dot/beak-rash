#!/usr/bin/env node
// Track API self-test in the sandbox page: project/toWorld round trips (with and without hint),
// frame continuity, NaN scan, bounds/surface sanity, feature ranges. Exit code 1 on failure.
//   node sandbox/track.test.mjs [--track coast]
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const result = await withPage(async (page) => {
  await page.goto(`${BASE}/sandbox/track.html?track=${a.track ?? 'coast'}&s=60`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 60000 });
  return page.evaluate(() => {
    const t = window.__trk.track;
    const fails = [];
    const V = (x = 0, y = 0, z = 0) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } });
    let maxErrS = 0, maxErrX = 0, maxErrY = 0, maxErrHint = 0, nan = 0;
    let rng = 12345;
    const rnd = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
    const t0 = performance.now();
    for (let k = 0; k < 4000; k++) {
      const s = rnd() * t.length, x = (rnd() * 2 - 1) * 9, y = rnd() * 3;
      const p = t.toWorld(s, x, y, V());
      const q = t.project(p);
      const qh = t.project(p, s + (rnd() * 2 - 1) * 10);
      if (![q.s, q.x, q.y, qh.s].every(Number.isFinite)) nan++;
      maxErrS = Math.max(maxErrS, Math.abs(q.s - s));
      maxErrX = Math.max(maxErrX, Math.abs(q.x - x));
      maxErrY = Math.max(maxErrY, Math.abs(q.y - y));
      maxErrHint = Math.max(maxErrHint, Math.abs(qh.s - s));
    }
    const projMs = (performance.now() - t0) / 8000;
    let maxStep = 0, minStep = Infinity, maxDk = 0, maxDtan = 0, prevK = null, prev = null, prevT = null;
    for (let s = 0; s <= t.length; s += 0.5) {
      const f = t.frameAt(s);
      const vals = [f.pos.x, f.pos.y, f.pos.z, f.tangent.x, f.up.y, f.right.x, f.curvature, f.slope, f.bank];
      if (!vals.every(Number.isFinite)) nan++;
      if (prev) {
        const d = Math.hypot(f.pos.x - prev.x, f.pos.z - prev.z);
        maxStep = Math.max(maxStep, d); minStep = Math.min(minStep, d);
        maxDk = Math.max(maxDk, Math.abs(f.curvature - prevK));
        maxDtan = Math.max(maxDtan, Math.acos(Math.min(1, f.tangent.x * prevT.x + f.tangent.y * prevT.y + f.tangent.z * prevT.z)));
      }
      prev = { x: f.pos.x, z: f.pos.z }; prevK = f.curvature; prevT = { x: f.tangent.x, y: f.tangent.y, z: f.tangent.z };
      const b = t.bounds(s);
      if (!(b.left > b.halfWidth && b.right > b.halfWidth)) fails.push(`bounds at ${s}`);
      if (t.surfaceAt(s, 0) !== 'road') fails.push(`centre not road at ${s}`);
      const beyondL = t.surfaceAt(s, -b.left - 0.05), beyondR = t.surfaceAt(s, b.right + 0.05);
      if (beyondL !== b.leftKind || beyondR !== b.rightKind) fails.push(`edge kind mismatch at ${s}`);
    }
    // Run-off past the finish: drivable (bounds, surface) and round-trips like the race road.
    const runoff = t.runoff ?? 0;
    if (runoff < 200) fails.push(`runoff ${runoff} < 200`);
    for (let s = t.length; s <= t.length + runoff; s += 10) {
      const p = t.toWorld(s, 3, 0.5, V());
      const q = t.project(p, s - 4);
      if (Math.abs(q.s - s) > 0.05 || Math.abs(q.x - 3) > 0.05) fails.push(`runoff round trip at ${s}: ${q.s.toFixed(2)}`);
      if (t.surfaceAt(s, 0) !== 'road' || !(t.bounds(s).right > 7)) fails.push(`runoff not drivable at ${s}`);
    }
    if (t.frameAt(t.length + runoff + 50).s !== t.length + runoff) fails.push('frameAt not clamped at length + runoff');
    const reuse = t.frameAt(10); const same = t.frameAt(20, reuse) === reuse && reuse.s === 20;
    if (!same) fails.push('frameAt out not reused');
    if (maxErrS > 0.05 || maxErrX > 0.05 || maxErrY > 0.05 || maxErrHint > 0.05) fails.push('round trip error too large');
    if (nan) fails.push(`${nan} NaN values`);
    if (maxStep > 0.52 || minStep < 0.48) fails.push(`centre-line step ${minStep}..${maxStep}`);
    const feats = t.features.map((f) => `${f.kind}@${f.s0.toFixed(0)}-${f.s1.toFixed(0)} x${f.x0}..${f.x1}`);
    const kinds = {};
    for (let s = 0; s <= t.length; s += 1) { const b = t.bounds(s); kinds[`${b.leftKind}/${b.rightKind}`] = (kinds[`${b.leftKind}/${b.rightKind}`] ?? 0) + 1; }
    return { length: t.length, runoff, maxErrS, maxErrX, maxErrY, maxErrHint, projMs: +projMs.toFixed(4), maxStep, minStep, maxDk, maxDtanDeg: maxDtan * 57.3, kinds, feats, fails: fails.slice(0, 20), failCount: fails.length };
  });
});
// Leak test: build → render → dispose; rebuild and check memory returns to the same level.
const leak = await withPage(async (page) => {
  await page.goto(`${BASE}/sandbox/track.html?track=${a.track ?? 'coast'}&s=60`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 60000 });
  return page.evaluate(async () => {
    const t = window.__trk;
    const built = t.stats();
    await t.rebuild();
    t.view(60, 2, 'chase');
    const rebuilt = t.stats();
    t.dispose();
    const after = t.stats();
    const scene = t.track.group.parent;
    return { built: [built.geometries, built.textures], rebuilt: [rebuilt.geometries, rebuilt.textures], disposed: [after.geometries, after.textures], groupDetached: scene === null };
  });
});
result.leak = leak;
if (leak.rebuilt[0] > leak.built[0] + 2 || leak.disposed[0] > 4 || leak.disposed[1] > 2 || !leak.groupDetached) {
  result.fails.push('dispose leaves resources behind');
  result.failCount++;
}
console.log(JSON.stringify(result, null, 1));
process.exit(result.failCount ? 1 : 0);
