#!/usr/bin/env node
// r6 acceptance: deterministic math (SPEC §28 — online lockstep). Lead-owned, read-only for workers. Every client of an
// online race must compute bit-identical sim states, but browsers' Math.sin / exp / pow … may differ in the last bit
// (measured: Chromium and WebKit split ~29 s into a race). src/net/detmath.ts ports fdlibm (V8 12.4's ieee754.cc) and
// V8's hypot (math.tq) to pure JS (+ − × ÷ sqrt only, which IEEE 754 makes identical everywhere). Checks: within 1 ulp
// of Chromium's native Math everywhere (a wrong constant or a mis-ported branch is off by many ulps), hypot equal to
// V8's bit for bit (same algorithm), and WebKit returning exactly what Chromium returned for every input.
//   node tools/r6/detmath.mjs [--n 40000]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const N = Number(a.n ?? 40000);
const FN1 = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'sinh', 'cosh', 'tanh', 'cbrt'];
const FN2 = ['atan2', 'pow', 'hypot'];

/** In-page: deterministic inputs per function, the port's outputs, native's outputs, mismatch stats, a hash. */
async function probe({ n, fn1, fn2, native }) {
  let m = {};
  try { m = await import('/src/net/detmath.ts'); } catch (err) { console.warn(`[detmath] cannot import: ${err}`); }
  // xorshift128+ → doubles; seeded per function so every engine sees the same inputs
  const rng = (seed) => {
    let s0 = BigInt(seed) | 1n, s1 = 0x9e3779b97f4a7c15n;
    const M = (1n << 64n) - 1n;
    return () => {
      let x = s0; const y = s1; s0 = y; x ^= (x << 23n) & M; s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
      return Number(((s1 + y) & M) >> 11n) / 2 ** 53;
    };
  };
  const SPECIAL = [0, -0, Infinity, -Infinity, NaN, 1, -1, 0.5, -0.5, 2, -2, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE,
    2.2250738585072014e-308, Math.PI, -Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, 1e-10, -1e-10, 1e10, 709.782712893384, 710, -745.1332191019411, 1 - 2 ** -53, 1 + 2 ** -52];
  const logUniform = (r, lo, hi) => (r() < 0.5 ? -1 : 1) * 10 ** (lo + (hi - lo) * r());
  const uniform = (r, lo, hi) => lo + (hi - lo) * r();
  const gen1 = {
    sin: (r) => (r() < 0.6 ? uniform(r, -20, 20) : r() < 0.5 ? logUniform(r, -300, 300) : Math.round(uniform(r, -2000, 2000)) * (Math.PI / 2) * (1 + (r() - 0.5) * 1e-15)),
    asin: (r) => (r() < 0.8 ? uniform(r, -1, 1) : (r() < 0.5 ? 1 : -1) * (1 - 10 ** uniform(r, -16, -2))),
    atan: (r) => logUniform(r, -300, 300),
    exp: (r) => (r() < 0.7 ? uniform(r, -750, 712) : logUniform(r, -20, 0)),
    log: (r) => (r() < 0.6 ? 10 ** uniform(r, -320, 308) : 1 + (r() - 0.5) * 10 ** uniform(r, -16, -1)),
    log1p: (r) => (r() < 0.5 ? 10 ** uniform(r, -300, 300) : uniform(r, -0.999999, 3)),
    sinh: (r) => (r() < 0.7 ? uniform(r, -720, 720) : logUniform(r, -20, 0)),
    cbrt: (r) => logUniform(r, -320, 308),
  };
  const domain = { cos: 'sin', tan: 'sin', acos: 'asin', expm1: 'exp', log2: 'log', log10: 'log', cosh: 'sinh', tanh: 'sinh' };
  const gen2 = {
    atan2: (r) => [r() < 0.1 ? (r() < 0.5 ? 0 : -0) : logUniform(r, -300, 300), r() < 0.1 ? (r() < 0.5 ? 0 : -0) : logUniform(r, -300, 300)],
    pow: (r) => [r() < 0.8 ? 10 ** uniform(r, -30, 30) : -(10 ** uniform(r, -5, 5)), r() < 0.5 ? uniform(r, -40, 40) : Math.round(uniform(r, -60, 60)) / (r() < 0.5 ? 1 : 2)],
    hypot: (r) => [logUniform(r, -300, 300), logUniform(r, -300, 300)],
  };
  const bits = new Float64Array(1), u64 = new BigUint64Array(bits.buffer);
  const key = (v) => { bits[0] = v; return Number.isNaN(v) ? 'nan' : u64[0].toString(16); };
  const ulps = (x, y) => {
    if (Object.is(x, y) || (Number.isNaN(x) && Number.isNaN(y))) return 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.sign(x) !== Math.sign(y)) return Infinity;
    bits[0] = Math.abs(x); const ix = u64[0]; bits[0] = Math.abs(y); const iy = u64[0];
    return Number(ix > iy ? ix - iy : iy - ix);
  };
  let h = 2166136261 >>> 0;
  const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  const out = { missing: [], stats: {}, hash: '' };
  const nat = native ? Object.fromEntries([...fn1, ...fn2].map((f) => [f, Math[f]])) : null;
  for (const [i, f] of fn1.entries()) {
    if (typeof m[f] !== 'function') { out.missing.push(f); continue; }
    const r = rng(1000 + i), g = gen1[f] ?? gen1[domain[f]];
    let diff = 0, maxUlp = 0, example = null;
    for (let k = 0; k < n + SPECIAL.length; k++) {
      const x = k < SPECIAL.length ? SPECIAL[k] : g(r);
      const y = m[f](x);
      mix(key(y));
      if (nat) { const z = nat[f](x); const d = ulps(y, z); if (d > 0) { diff++; maxUlp = Math.max(maxUlp, d); example ??= [x, y, z]; } }
    }
    out.stats[f] = { diff, maxUlp, example };
  }
  for (const [i, f] of fn2.entries()) {
    if (typeof m[f] !== 'function') { out.missing.push(f); continue; }
    const r = rng(2000 + i), g = gen2[f];
    let diff = 0, maxUlp = 0, example = null;
    const specials = SPECIAL.flatMap((x) => SPECIAL.slice(0, 16).map((y) => [x, y]));
    for (let k = 0; k < n + specials.length; k++) {
      const [x, y] = k < specials.length ? specials[k] : g(r);
      const v = m[f](x, y);
      mix(key(v));
      if (nat) { const z = nat[f](x, y); const d = ulps(v, z); if (d > 0) { diff++; maxUlp = Math.max(maxUlp, d); example ??= [x, y, v, z]; } }
    }
    out.stats[f] = { diff, maxUlp, example };
  }
  // three-argument hypot (the sim uses Math.hypot(dx, dy, dz))
  if (typeof m.hypot === 'function') {
    const r = rng(3000);
    let diff = 0;
    for (let k = 0; k < n; k++) {
      const args = [uniform(r, -500, 500), uniform(r, -50, 50), uniform(r, -500, 500)];
      const v = m.hypot(...args);
      mix(key(v));
      if (nat && ulps(v, nat.hypot(...args)) > 0) diff++;
    }
    out.stats.hypot3 = { diff, maxUlp: 0, example: null };
  }
  out.hash = h.toString(16);
  // speed: the port against native, 1M calls each
  if (native) {
    out.speed = {};
    for (const f of ['sin', 'atan2', 'exp', 'pow', 'hypot']) {
      if (typeof m[f] !== 'function') continue;
      const xs = Float64Array.from({ length: 4096 }, (_, i) => 0.37 + i * 0.013);
      const time = (fn) => { let acc = 0; const t0 = performance.now(); for (let k = 0; k < 1e6; k++) { const x = xs[k & 4095]; acc += fn(x, 1.7); } return [performance.now() - t0, acc]; };
      time(m[f]); time(nat[f]);
      const [tp] = time(m[f]), [tn] = time(nat[f]);
      out.speed[f] = +(tp / tn).toFixed(2);
    }
  }
  // the installer replaces Math.* (and only once)
  if (typeof m.installDetMath === 'function') {
    const before = Math.sin;
    m.installDetMath(); m.installDetMath();
    out.installed = [...fn1, ...fn2].every((f) => Math[f] === m[f]);
    out.installChanged = before !== Math.sin;
  } else out.installed = false;
  return out;
}

const runIn = (browser) => withPage(async (page, h) => {
  await h.goto('/sandbox/actors.html?panel=0&manual=1');
  const r = await page.evaluate(probe, { n: N, fn1: FN1, fn2: FN2, native: browser === 'chromium' });
  if (r.missing.length < FN1.length + FN2.length) await noErrors(h, browser);
  return r;
}, { size: '800x600', browser });

const ch = await runIn('chromium');
expect(ch.missing.length === 0, `src/net/detmath.ts exports ${[...FN1, ...FN2].join(' ')} (missing: ${ch.missing.join(', ') || 'none'})`);
const ACCURATE = [...FN1, 'atan2', 'pow'];
const far = ACCURATE.filter((f) => ch.stats[f] && ch.stats[f].maxUlp > 1);
expect(far.length === 0, `in Chromium every port is within 1 ulp of native on ${N}+ inputs each (worse: ${far.map((f) => `${f} max ${ch.stats[f].maxUlp} ulp e.g. ${JSON.stringify(ch.stats[f].example)}`).join('; ') || 'none'})`);
console.log(`  equal to native: ${ACCURATE.map((f) => `${f} ${ch.stats[f] ? (100 - (100 * ch.stats[f].diff) / N).toFixed(2) : '-'} %`).join(' · ')}`);
const hy = ['hypot', 'hypot3'].filter((f) => !ch.stats[f] || ch.stats[f].diff > 0);
expect(hy.length === 0, `hypot (2 and 3 arguments) equals V8's native bit for bit (same algorithm as math.tq) (differs: ${hy.map((f) => `${f} ${ch.stats[f]?.diff}× e.g. ${JSON.stringify(ch.stats[f]?.example)}`).join('; ') || 'none'})`);
const slow = Object.entries(ch.speed ?? {}).filter(([, v]) => v > 2.5);
expect(Object.keys(ch.speed ?? {}).length === 5 && slow.length === 0, `the port costs at most 2.5× native per call (${JSON.stringify(ch.speed)})`);
expect(ch.installed && ch.installChanged, `installDetMath() puts the port in place of Math.* (idempotent) (installed ${ch.installed})`);
const wk = await runIn('webkit');
expect(wk.hash === ch.hash && wk.missing.length === 0, `WebKit computes exactly the same outputs as Chromium for every input (hash ${wk.hash} vs ${ch.hash})`);

finish('r6-detmath');
