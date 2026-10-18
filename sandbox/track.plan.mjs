#!/usr/bin/env node
// Layout plan check without a browser: builds a layout with the game's own builder (layout/build.ts via
// the tools/content-ts.mjs import hook) and reports length, corners (R, turn), self-proximity,
// sea/land side conflicts and pickup rows off the asphalt; writes a top-down plan PNG. Exit 1 on failure.
//   node sandbox/track.plan.mjs [--file src/world/layouts/coast.ts] [--export COAST] [--out shots/track/plan.png]
//     [--gap 110] (min distance between road parts > 250 m apart along s) [--json]
import fs from 'node:fs';
import path from 'node:path';
import { importTs, ROOT } from '../tools/content-ts.mjs';
import { writePlanPng } from './track.plan-png.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null)).filter(Boolean));
const file = args.file ?? 'src/world/layouts/coast.ts';
const name = args.export ?? 'COAST';
const gap = Number(args.gap ?? 110);
const { buildLayout } = await importTs('src/world/layout/build.ts');
const def = (await importTs(file))[name];
if (!def) throw new Error(`[track.plan] ${file} has no export ${name}`);
const L = buildLayout(def);
const i0 = Math.round(-L.sMin), iEnd = i0 + Math.round(L.length);
const P = (s) => { const i = Math.min(L.n - 1, Math.max(0, Math.round(s - L.sMin))); return { x: L.px[i], y: L.py[i], z: L.pz[i], i }; };
const fails = [];

// Corners: runs with |κ| ≥ 1/200 (R ≤ 200 m); turn = ∫κ ds.
const corners = [];
let cur = null;
for (let i = i0; i <= iEnd; i++) {
  const k = L.curv[i], s = L.sMin + i;
  if (Math.abs(k) >= 1 / 200 && (!cur || Math.sign(k) === cur.sign)) {
    if (!cur) cur = { s0: s, s1: s, sign: Math.sign(k), kMax: 0, turn: 0 };
    cur.s1 = s; cur.kMax = Math.max(cur.kMax, Math.abs(k)); cur.turn += k;
  } else if (cur) { corners.push(cur); cur = Math.abs(k) >= 1 / 200 ? { s0: s, s1: s, sign: Math.sign(k), kMax: Math.abs(k), turn: k } : null; }
}
if (cur) corners.push(cur);
const zoneOf = (s) => L.zones.find((z) => s >= z.s0 && s < z.s1)?.name ?? '-';
const cornerRows = corners.map((c) => ({ s: `${c.s0}-${c.s1}`, zone: zoneOf((c.s0 + c.s1) / 2), dir: c.sign > 0 ? 'R' : 'L', minR: Math.round(1 / c.kMax), turnDeg: Math.round((c.turn * 180) / Math.PI) }));

// Self-proximity: centre-line points closer than `gap` while more than 250 m apart along s.
const CELL = 64, grid = new Map();
const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
for (let i = 0; i < L.n; i += 2) { const k = key(L.px[i], L.pz[i]); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
const near = (x, z, r, visit) => {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), n = Math.ceil(r / CELL);
  for (let a = cx - n; a <= cx + n; a++) for (let b = cz - n; b <= cz + n; b++) for (const j of grid.get(`${a},${b}`) ?? []) visit(j);
};
const close = [];
for (let i = 0; i < L.n; i += 4) {
  let best = null;
  near(L.px[i], L.pz[i], gap, (j) => {
    if (j - i < 250) return;
    const d = Math.hypot(L.px[j] - L.px[i], L.pz[j] - L.pz[i]);
    if (d < gap && (!best || d < best.d)) best = { a: L.sMin + i, b: L.sMin + j, d: Math.round(d) };
  });
  if (best) close.push(best);
}
if (close.length) fails.push(`${close.length} road points closer than ${gap} m to another part (first ${JSON.stringify(close[0])})`);

// Side conflicts: a point d m beside the road whose nearest road sample (another part) sees it on the other side.
const conflicts = [];
for (let i = i0; i <= iEnd; i += 5) {
  const rl = Math.hypot(L.rx[i], L.rz[i]) || 1;
  for (const side of [-1, 1]) for (const d of [40, 80, 140]) {
    const x = L.px[i] + (side * d * L.rx[i]) / rl, z = L.pz[i] + (side * d * L.rz[i]) / rl;
    let bj = -1, bd = d - 0.5;
    near(x, z, d, (j) => { const dd = Math.hypot(L.px[j] - x, L.pz[j] - z); if (dd < bd) { bd = dd; bj = j; } });
    if (bj < 0 || Math.abs(bj - i) < 2 * d) continue;
    const sj = Math.sign((x - L.px[bj]) * L.rx[bj] + (z - L.pz[bj]) * L.rz[bj]);
    if (sj !== side) conflicts.push(`${L.sMin + i}${side < 0 ? 'L' : 'R'}${d}~${L.sMin + bj}`);
  }
}
if (conflicts.length) fails.push(`${conflicts.length} sea/land side conflicts (${conflicts.slice(0, 6).join(' ')})`);

// Features on the asphalt (pickup rows keep 1 m inside the road edge), inside [0, length].
const hw = L.halfWidth;
for (const f of L.features) {
  if (f.s0 < 0 || f.s1 > L.length) fails.push(`${f.kind}@${f.s0} outside [0, length]`);
  const lim = f.kind === 'pickupRow' ? hw - 1 : f.kind === 'tunnel' || f.kind === 'bridge' || f.kind === 'jumpCrest' ? 9 : hw;
  if (Math.max(Math.abs(f.x0), Math.abs(f.x1)) > lim + 1e-6) fails.push(`${f.kind}@${f.s0} x ${f.x0}..${f.x1} beyond ±${lim}`);
}
// Landmark domes: clearance between the dome and the nearest road part (centre line − 12 m).
const bumps = (def.bumps ?? []).map((b) => {
  const p = P(b.s), rl = Math.hypot(L.rx[p.i], L.rz[p.i]) || 1;
  const x = p.x + (b.x * L.rx[p.i]) / rl, z = p.z + (b.x * L.rz[p.i]) / rl;
  let d = Infinity, at = 0;
  for (let i = i0; i <= iEnd; i += 2) { const dd = Math.hypot(L.px[i] - x, L.pz[i] - z); if (dd < d) { d = dd; at = L.sMin + i; } }
  if (d - b.r < 14) fails.push(`bump s${b.s} x${b.x} only ${Math.round(d - b.r)} m from the road at s${at}`);
  return { s: b.s, x: b.x, r: b.r, clear: Math.round(d - b.r), nearS: at, wx: x, wz: z };
});
let minY = Infinity, maxSlope = 0;
for (let i = i0; i <= iEnd; i++) { minY = Math.min(minY, L.py[i]); maxSlope = Math.max(maxSlope, Math.abs(L.slope[i])); }
const report = {
  length: L.length, zones: L.zones.map((z) => `${z.name} ${z.s0}-${z.s1}`).join(' · '),
  corners: cornerRows, minRoadY: +minY.toFixed(2), maxSlopePct: +(maxSlope * 100).toFixed(1),
  bumps: bumps.map(({ wx, wz, ...b }) => b), fails,
};
if (args.json) console.log(JSON.stringify(report, null, 1));
else {
  console.log(`length ${report.length} m · min road y ${report.minRoadY} m · max slope ${report.maxSlopePct} %`);
  console.log(report.zones);
  for (const c of cornerRows) console.log(`  corner ${c.s.padEnd(11)} ${c.zone.padEnd(10)} ${c.dir} R${String(c.minR).padEnd(4)} turn ${c.turnDeg}°`);
  for (const b of report.bumps) console.log(`  bump s${b.s} x${b.x} r${b.r}: ${b.clear} m clear of the road (s${b.nearS})`);
  for (const f of fails) console.log(`FAIL ${f}`);
}
const out = args.out ?? 'shots/track/plan.png';
fs.mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true });
writePlanPng(path.join(ROOT, out), L, bumps, i0, iEnd);
console.log(`plan → ${out}`);
process.exit(fails.length ? 1 : 0);
