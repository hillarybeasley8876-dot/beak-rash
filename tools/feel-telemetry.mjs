#!/usr/bin/env node
// Feel telemetry for the sim unit (SPEC §6). Scripted inputs in manual stepping → metrics vs spec,
// JSON + CSV per scenario + PNG frame strips. Keep it: the feel critic reruns it.
//   node tools/feel-telemetry.mjs [--only accel,steer,...] [--strips] [--out shots/sim/telemetry]
//        [--stub world,actors,combat,race,fx,ui,audio] [--seed 1] [--browser webkit]
// Scenarios: accel coastBrake steer keyboard slalom curveHold drift air wall bump press slipstream crash
//            driftWall knock snake wallEvents slope jitter camera handoff
import path from 'node:path';
import { parseArgs, withPage } from './lib.mjs';
import { installFeel, installPatches, saveDataUrl, writeCsv, writeJson } from './feel-lib.mjs';
import { HANDLING } from './feel-scenarios.mjs';
import { WORLD } from './feel-scenarios-world.mjs';
import { CAMERA } from './feel-scenarios-camera.mjs';
import { HANDOFF } from './feel-scenarios-blend.mjs';
import { ABUSE } from './feel-scenarios-abuse.mjs';

const SCENARIOS = [...HANDLING, ...WORLD, ...ABUSE, ...CAMERA, ...HANDOFF];

const a = parseArgs(process.argv.slice(2));
const OUT = a.out ?? 'shots/sim/telemetry';
const STUB = a.stub ?? 'world,actors,combat,race,fx,ui,audio';
const only = a.only ? new Set(String(a.only).split(',')) : null;
const strips = a.strips === true || a.strips === 'true';

// [scenario, metric, lo, hi] — SPEC §6 targets (and a few sanity bounds).
const CHECKS = [
  ['accel', 't0to60', 4.0, 4.8], ['accel', 'top', 19.5, 20.5],
  ['coastBrake', 'coastDecel', 0.45, 0.8], ['coastBrake', 'brakeDecel', 10.5, 13.5],
  ['steer', 'tau63', 0.04, 0.1], ['steer', 'framesToVisible', 1, 2], ['steer', 'leanMaxDeg', 15, 38.5],
  ['steer', 'releaseOvershoot', 0, 0.02], ['steer', 'releaseCounterLeanDeg', 0, 1.5],
  ['keyboard', 'framesToYaw05', 1, 2],
  ['curveHold', 'R60', 0.6, 0.85], ['curveHold', 'R100', 0.3, 0.6],
  ['drift', 'boostPower', 0.34, 0.36], ['drift', 'slipMaxDeg', 25, 45], ['drift', 'bleedPerSec', 0.02, 0.06],
  ['air', 'hopAir', 0.34, 0.42], ['air', 'rampAir', 0.4, 2], ['jitter', 'slowmoMaxStepPx', 0, 6],
  ['camera', 'fovAtTop', 70, 80], ['camera', 'minClearance', 1.15, 9], ['camera', 'blendOutSec', 0.2, 0.37],
  ['press', 'sideMaxStepX', 0, 0.12], ['press', 'sideJitterX', 0, 0.01], ['press', 'rearMaxSJump', 0, 0.06],
  ['camera', 'popRatio', 0, 1.6], ['slipstream', 'riderNearMiss', 1, 1], ['air', 'kickCrestAir', 0.35, 1.5], ['wall', 'scrapeCrashed', false, false],
  // review r1: drifts never reach a wall within 2.5 s from the centre; knocks carry; no snake farming;
  // one wall event per approach with a visible bounce; descents settle above top speed
  ['driftWall', 'k0_hold_clearSec', 2.5, 9], ['driftWall', 'k0_neutral_clearSec', 2.5, 9],
  ['driftWall', 'k0_counter_clearSec', 2.5, 9], ['driftWall', 'k150_hold_clearSec', 2.5, 9],
  ['driftWall', 'k150_neutral_clearSec', 2.5, 9], ['driftWall', 'k150_counter_clearSec', 2.5, 9],
  ['driftWall', 'k150_hold_level', 3, 3],
  ['knock', 'lightDisp', 0.45, 0.8], ['knock', 'heavyDisp', 1.2, 1.8],
  ['snake', 'gainInto', -1, 0.03], ['snake', 'gainCounter', -1, 0.03],
  ['wallEvents', 'minGap_30', 0.25, 9], ['wallEvents', 'minGap_60', 0.25, 9], ['wallEvents', 'minGap_144', 0.25, 9],
  ['wallEvents', 'carry_60', 0.4, 1], ['slope', 'v13', 22.5, 24], ['slope', 'v055', 21, 22],
  // camera hand-offs: ≤ 8°/frame and no frame > 3× its neighbours (cuts are counted, not hidden)
  ['handoff', 'back_cuts', 1, 1], ['handoff', 'back_maxRotDeg', 0, 8],
  ['handoff', 'side_cuts', 0, 0], ['handoff', 'side_maxRotDeg', 0, 8], ['handoff', 'side_rotPopRatio', 0, 3],
  ['handoff', 'side_minBlendDist', 1, 99], ['handoff', 'side_blendFrames', 12, 24],
  ['handoff', 'ko_maxRotDeg', 0, 8], ['handoff', 'ko_rotPopRatio', 0, 3], ['handoff', 'wrecked_maxRotDeg', 0, 8],
  ['handoff', 'wrecked_rotPopRatio', 0, 3], ['handoff', 'respawn_maxRotDeg', 0, 8], ['handoff', 'respawn_rotPopRatio', 0, 3],
  ['handoff', 'intro_maxRotDeg', 0, 8], ['handoff', 'intro_rotPopRatio', 0, 3],
];

function report(results) {
  const lines = [];
  let fails = 0;
  for (const [sc, key, lo, hi] of CHECKS) {
    const res = results[sc];
    if (!res) continue;
    const v = res.metrics[key];
    const ok = typeof lo === 'boolean' ? v === lo : typeof v === 'number' && v >= lo && v <= hi;
    if (!ok) fails++;
    lines.push(`${ok ? 'PASS' : 'FAIL'}  ${sc}.${key} = ${JSON.stringify(v)}  (want ${lo}…${hi})`);
  }
  return { lines, fails };
}

const results = {};
await withPage(async (page, h) => {
  for (const sc of SCENARIOS) {
    if (only && !only.has(sc.name)) continue;
    const t0 = Date.now();
    const stub = sc.stub ?? STUB; // a scenario may need every unit live ('' = no stubs)
    await h.goto(`/?race=coast&seed=${a.seed ?? 1}&rivals=pigeon&traffic=0&police=0&manual=1${stub ? `&stub=${stub}` : ''}`);
    await installFeel(page);
    await installPatches(page);
    const phase = await page.evaluate(() => window.__feel.waitRacing());
    if (phase !== 'racing') throw new Error(`[feel] race never started (phase ${phase})`);
    const res = await sc.run({ page, h, strips });
    results[sc.name] = res;
    if (res.rows) writeCsv(path.join(OUT, `${sc.name}.csv`), res.rows);
    if (res.strip) saveDataUrl(path.join(OUT, `${sc.name}-strip.png`), res.strip);
    const errs = await h.errors();
    if (errs.length) res.metrics.pageErrors = errs.slice(0, 5);
    console.log(`[feel] ${sc.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`, JSON.stringify(res.metrics));
  }
}, { browser: a.browser ?? 'chromium' });

const { lines, fails } = report(results);
const metrics = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.metrics]));
writeJson(path.join(OUT, 'metrics.json'), { when: new Date().toISOString(), checks: lines, metrics });
console.log(`\n${lines.join('\n')}\n[feel] ${lines.length - fails}/${lines.length} checks pass → ${OUT}/metrics.json`);
process.exitCode = fails ? 1 : 0;
