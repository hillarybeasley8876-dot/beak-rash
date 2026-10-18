#!/usr/bin/env node
// Track regression audit on the sandbox page (no other units involved); exit 1 when a check fails.
//   node sandbox/track.audit.mjs [--track coast] [--step 4] [--skip intrude,stall]
// Checks: project/frameAt with non-finite input · rendered road height under toWorld(s, x, 0) ·
// visual edges vs bounds() (wall within reach, nothing inside, water edges open) · drawn curb blocks
// vs surfaceAt 'curb' · prop vertices inside the drivable box below rider height · long tasks while
// the track rebuilds.
import { BASE, parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const track = a.track ?? 'coast', step = Number(a.step ?? 4), skip = new Set(String(a.skip ?? '').split(','));
const LIMITS = { roadOff: 0.04, wallGapMin: -0.08, wallGapMax: 0.35, waterOpen: 1.0, intrude: 0.08, longTask: 150 };

/** Page side: API, road, edge and curb checks. */
function geometryChecks([stepM, L]) {
  const t = window.__trk.track, { Raycaster, Vector3 } = window.__trk.three;
  const out = { api: [], road: { n: 0, misses: 0, maxOff: 0 }, edges: { wallOk: 0, wallMissing: 0, wallInside: 0, wallFar: 0, waterOk: 0, waterBlocked: 0 },
    curbs: { n: 0, mismatch: 0 }, samples: [] };
  const note = (m) => { if (out.samples.length < 20) out.samples.push(m); };
  // API: non-finite input stays finite.
  const p = t.project({ x: NaN, y: 0, z: 0 }, 120);
  if (!(p.s === 120 && p.x === 0 && p.y === 0)) out.api.push(`project(NaN, 120) → ${JSON.stringify(p)}`);
  const q = t.project({ x: Infinity, y: 0, z: 0 });
  if (![q.s, q.x, q.y].every(Number.isFinite)) out.api.push(`project(Infinity) → ${JSON.stringify(q)}`);
  for (const s of [NaN, -Infinity, Infinity, -50, t.length + 1e6]) {
    const f = t.frameAt(s);
    if (![f.s, f.pos.x, f.pos.y, f.pos.z, f.right.x, f.up.y].every(Number.isFinite)) out.api.push(`frameAt(${s}) not finite`);
    const b = t.bounds(s);
    if (![b.left, b.right].every(Number.isFinite)) out.api.push(`bounds(${s}) not finite`);
  }
  const rc = new Raycaster(), org = new Vector3(), dir = new Vector3();
  const roadSet = new Set(['road', 'shoulderL', 'shoulderR', 'curbs']);
  const roads = [], walls = [];
  t.group.children.forEach((o) => {
    if (!o.isMesh) return;
    const n = o.name.split(':')[0];
    if (roadSet.has(n)) roads.push(o);
    else if (!['sky', 'clouds', 'sea', 'gulls', 'far', 'tunnelShade', 'tunnelPools', ''].includes(n)) walls.push(o);
  });
  const curbs = t.group.getObjectByName('curbs');
  const end = t.length + (t.runoff ?? 0);
  for (let s = 2.37; s < end; s += stepM) {   // off the 1.5 m curb-block grid
    const fr = t.frameAt(s), b = t.bounds(s);
    // Road height under the drivable cross-section.
    for (const x of [-b.left + 0.1, -b.halfWidth + 0.5, 0, b.halfWidth - 0.5, b.right - 0.1]) {
      t.toWorld(s, x, 1.2, org);
      rc.set(org, dir.set(-fr.up.x, -fr.up.y, -fr.up.z)); rc.far = 3;
      const hit = rc.intersectObjects(roads, false)[0];
      if (!hit) { out.road.misses++; note(`road miss s${s} x${x.toFixed(1)}`); continue; }
      out.road.n++;
      const off = 1.2 - hit.distance;
      if (Math.abs(off) > Math.abs(out.road.maxOff)) out.road.maxOff = +off.toFixed(3);
    }
    for (const side of [-1, 1]) {
      const lim = side < 0 ? b.left : b.right, kind = side < 0 ? b.leftKind : b.rightKind;
      let best = Infinity, who = '';
      for (const y of [0.1, 0.3, 0.55, 0.8, 1.1]) {
        t.toWorld(s, side * (lim - 0.5), y, org);
        rc.set(org, dir.set(fr.right.x * side, fr.right.y * side, fr.right.z * side)); rc.far = 2.5;
        const hit = rc.intersectObjects(walls, true).find((h) => !h.object.userData.isOutline);
        if (hit && hit.distance < best) { best = hit.distance; who = hit.object.name; }
      }
      const gap = best - 0.5, tag = `s${s.toFixed(1)}${side < 0 ? "L" : "R"}`;
      if (kind === 'wall') {
        if (best === Infinity) { out.edges.wallMissing++; note(`${tag} no wall`); }
        else if (gap < L.wallGapMin) { out.edges.wallInside++; note(`${tag} wall ${gap.toFixed(2)} inside (${who})`); }
        else if (gap > L.wallGapMax) out.edges.wallFar++;
        else out.edges.wallOk++;
      } else if (best < L.waterOpen) { out.edges.waterBlocked++; note(`${tag} water edge blocked at ${gap.toFixed(2)} (${who})`); }
      else out.edges.waterOk++;
      // Curbs: the drawn block under the curb strip matches surfaceAt.
      if (curbs && lim >= b.halfWidth + 0.95) {
        const x = side * (b.halfWidth + 0.45);
        t.toWorld(s, x, 1, org);
        rc.set(org, dir.set(-fr.up.x, -fr.up.y, -fr.up.z)); rc.far = 2;
        const drawn = rc.intersectObject(curbs, false).length > 0, want = t.surfaceAt(s, x) === 'curb';
        out.curbs.n++;
        if (drawn !== want) { out.curbs.mismatch++; note(`${tag} curb drawn=${drawn} surfaceAt=${want}`); }
      }
    }
  }
  return out;
}

/** Page side: prop vertices inside the drivable box (|x| < bound, 0.12 < y < 2.6) outside ramps. */
function intrusionScan() {
  const t = window.__trk.track;
  const skipNames = new Set(['sky', 'clouds', 'sea', 'road', 'shoulderL', 'shoulderR', 'curbs', 'far', 'nearL', 'nearR', 'gulls', '']);
  const ramps = t.features.filter((f) => f.kind === 'ramp');
  const v = { x: 0, y: 0, z: 0 };
  let checked = 0, worst = 0, where = '';
  t.group.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || skipNames.has(o.name.split(':')[0])) return;
    o.updateMatrixWorld();
    const pos = o.geometry.getAttribute('position'), e = o.matrixWorld.elements;
    let hint;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      v.x = e[0] * x + e[4] * y + e[8] * z + e[12];
      v.y = e[1] * x + e[5] * y + e[9] * z + e[13];
      v.z = e[2] * x + e[6] * y + e[10] * z + e[14];
      const q = t.project(v, hint);
      hint = q.s;
      checked++;
      if (q.s <= 0.5 || q.s >= t.length + (t.runoff ?? 0) - 0.5 || q.y < 0.12 || q.y > 2.6) continue;
      if (ramps.some((f) => q.s >= f.s0 - 0.5 && q.s <= f.s1 + 0.5)) continue;
      const b = t.bounds(q.s);
      const into = Math.min(q.x + b.left, b.right - q.x);
      if (into > worst) { worst = into; where = `${o.name} s${q.s.toFixed(1)} x${q.x.toFixed(2)} y${q.y.toFixed(2)}`; }
    }
  });
  return { checked, worst: +worst.toFixed(3), where };
}

/** Page side: rebuild the track twice and record long tasks (ms). */
async function rebuildStall() {
  const longs = [];
  const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) longs.push(Math.round(e.duration)); });
  obs.observe({ type: 'longtask', buffered: false });
  const t0 = performance.now();
  for (let k = 0; k < 2; k++) await window.__trk.rebuild();
  await new Promise((r) => setTimeout(r, 200));
  obs.disconnect();
  return { ms: Math.round((performance.now() - t0) / 2), worst: Math.max(0, ...longs), longs: longs.sort((x, y) => y - x).slice(0, 6) };
}

const res = await withPage(async (page, h) => {
  await page.goto(`${BASE}/sandbox/track.html?track=${track}&s=60`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__trk?.ready === true, null, { timeout: 60000 });
  const geo = await page.evaluate(geometryChecks, [step, LIMITS]);
  const intrude = skip.has('intrude') ? null : await page.evaluate(intrusionScan);
  const stall = skip.has('stall') ? null : await page.evaluate(rebuildStall);
  return { geo, intrude, stall, console: h.logs.filter((l) => !l.includes('404')).slice(0, 10) };
}, { size: '960x540' });

const { geo, intrude, stall } = res;
const fails = [
  ...geo.api,
  geo.road.misses > 0 && `road: ${geo.road.misses} raycast misses`,
  Math.abs(geo.road.maxOff) > LIMITS.roadOff && `road: rendered surface ${geo.road.maxOff} m off toWorld`,
  geo.edges.wallMissing > 0 && `edges: ${geo.edges.wallMissing} wall bounds with no visual wall`,
  geo.edges.wallInside > 0 && `edges: ${geo.edges.wallInside} walls inside the bound`,
  geo.edges.waterBlocked > 0 && `edges: ${geo.edges.waterBlocked} water edges blocked`,
  geo.curbs.mismatch > 0 && `curbs: ${geo.curbs.mismatch} of ${geo.curbs.n} samples drawn ≠ surfaceAt`,
  intrude && intrude.worst > LIMITS.intrude && `intrusion: ${intrude.worst} m (${intrude.where})`,
  stall && stall.worst > LIMITS.longTask && `rebuild: long task ${stall.worst} ms > ${LIMITS.longTask}`,
  ...res.console.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]')),
].filter(Boolean);
console.log(JSON.stringify({ track, road: geo.road, edges: geo.edges, curbs: geo.curbs, intrude, stall, samples: geo.samples }, null, 1));
console.log(fails.length ? `AUDIT FAIL (${fails.length})\n- ${fails.join('\n- ')}` : 'AUDIT OK');
process.exit(fails.length ? 1 : 0);
