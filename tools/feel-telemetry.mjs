#!/usr/bin/env node
// Feel telemetry for the sim unit (SPEC §6). Scripted inputs in manual stepping → metrics vs spec,
// JSON + CSV per scenario + PNG frame strips. Keep it: the feel critic reruns it.
//   node tools/feel-telemetry.mjs [--only accel,steer,...] [--strips] [--out shots/sim/telemetry]
//        [--stub world,actors,combat,race,fx,ui,audio] [--seed 1] [--browser webkit]
// Scenarios: accel coastBrake steer keyboard slalom curveHold drift air wall bump press slipstream crash
//            driftWall knock snake wallEvents slope wallPin driftTiming jitter camera handoff trafficCam
//            respawnCam ultHandback pauseCam driftRelease pressYaw lineHold draftBrake poses tightCam occlusion
import path from 'node:path';
import { parseArgs, withPage } from './lib.mjs';
import { installFeel, installPatches, saveDataUrl, writeCsv, writeJson } from './feel-lib.mjs';
import { HANDLING } from './feel-scenarios.mjs';
import { WORLD } from './feel-scenarios-world.mjs';
import { CAMERA } from './feel-scenarios-camera.mjs';
import { HANDOFF } from './feel-scenarios-blend.mjs';
import { ABUSE } from './feel-scenarios-abuse.mjs';
import { REVIEW2 } from './feel-scenarios-r2.mjs';
import { CAMERA2 } from './feel-scenarios-cam2.mjs';
import { REVIEW3 } from './feel-scenarios-r3.mjs';

const SCENARIOS = [...HANDLING, ...WORLD, ...ABUSE, ...REVIEW2, ...REVIEW3, ...CAMERA, ...HANDOFF, ...CAMERA2];

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
  // review r2: PERFECT is earned at touchdown (calm hands or a timed Space), steering through the flight misses it
  ['air', 'rampPerfect', true, true], ['air', 'rampSteerPerfect', false, false], ['air', 'rampStickPerfect', true, true],
  ['camera', 'fovAtTop', 69, 72], ['camera', 'minClearance', 1.15, 9], ['camera', 'blendOutSec', 0.2, 0.37],
  ['press', 'sideMaxStepX', 0, 0.12], ['press', 'sideJitterX', 0, 0.01], ['press', 'rearMaxSJump', 0, 0.06],
  ['camera', 'popRatio', 0, 1.6], ['slipstream', 'riderNearMiss', 1, 1], ['air', 'kickCrestAir', 0.35, 1.5], ['wall', 'scrapeCrashed', false, false],
  // review r1: drifts never reach a wall within 2.5 s from the centre; knocks carry; no snake farming;
  // one wall event per approach with a visible bounce; descents settle above top speed
  // (review r2: a full-into drift crosses the road like grip steering, ~4.5 m/s, so held from the centre it meets
  // the wall after ~2 s: it must bounce, never crash, and still reach L3 first on the bend)
  ['driftWall', 'k0_hold_clearSec', 1.8, 9], ['driftWall', 'k0_neutral_clearSec', 2.5, 9],
  ['driftWall', 'k0_counter_clearSec', 2.5, 9], ['driftWall', 'k150_hold_clearSec', 1.8, 9],
  ['driftWall', 'k0_hold_crashed', false, false], ['driftWall', 'k150_hold_crashed', false, false],
  ['driftWall', 'k150_neutral_clearSec', 2.5, 9], ['driftWall', 'k150_counter_clearSec', 2.5, 9],
  ['driftWall', 'k150_hold_level', 3, 3],
  ['knock', 'lightDisp', 0.45, 0.8], ['knock', 'heavyDisp', 1.2, 1.8], ['knock', 'lightSteerDisp', 0.45, 0.8],
  // game review r2: a combat knock (no body contact) eases the heading like a bump (<= 300 deg/s = 5 deg/frame at
  // 60 fps, 2.1 at 144) and still reads as a hit (the nose swings well past 10 deg)
  ['knock', 'heavyYawStepDeg', 0, 5.5], ['knock', 'lightYawStepDeg', 0, 5.5], ['knock', 'heavy144YawStepDeg', 0, 2.3],
  ['knock', 'heavyPeakYawDeg', 15, 50], ['knock', 'lightPeakYawDeg', 6, 20],
  ['snake', 'gainInto', -1, 0.03], ['snake', 'gainCounter', -1, 0.03],
  ['wallEvents', 'minGap_30', 0.25, 9], ['wallEvents', 'minGap_60', 0.25, 9], ['wallEvents', 'minGap_144', 0.25, 9],
  ['wallEvents', 'carry_60', 0.4, 1], ['slope', 'v13', 22.5, 24], ['slope', 'v055', 21, 22],
  // review r2: pressing into a wall = one impact then a scrape (no pinball), steering away shows within 3
  // frames, the bounce eases the heading; drift charge on real bend radii matches SPEC §6 with full commitment
  ['wallPin', 'hits_3', 1, 1], ['wallPin', 'hits_6', 1, 1], ['wallPin', 'hits_10', 1, 1],
  ['wallPin', 'yawRevPerSec_3', 0, 0.5], ['wallPin', 'yawRevPerSec_6', 0, 0.5], ['wallPin', 'yawRevPerSec_10', 0, 0.5],
  ['wallPin', 'impactYawStepDeg_6', 0, 5.5], ['wallPin', 'impactYawStepDeg_10', 0, 5.5], ['wallPin', 'steerAwayFrames', 0, 3],
  ['driftTiming', 'R300_L1', 0.45, 0.7], ['driftTiming', 'R300_L2', 1.0, 1.45], ['driftTiming', 'R300_L3', 1.7, 2.4],
  ['driftTiming', 'R150_L1', 0.45, 0.7], ['driftTiming', 'R150_L2', 1.0, 1.45], ['driftTiming', 'R150_L3', 1.7, 2.4],
  // camera hand-offs: ≤ 8°/frame and no frame > 3× its neighbours (cuts are counted, not hidden)
  ['handoff', 'back_cuts', 1, 1], ['handoff', 'back_maxRotDeg', 0, 8],
  ['handoff', 'side_cuts', 0, 0], ['handoff', 'side_maxRotDeg', 0, 8], ['handoff', 'side_rotPopRatio', 0, 3],
  ['handoff', 'side_minBlendDist', 1, 99], ['handoff', 'side_blendFrames', 12, 24],
  ['handoff', 'side70_cuts', 1, 1], // camera review r3: blends never whip > 300 deg/s (5 deg/frame at 60 fps)
  ['handoff', 'ko_maxRotDeg', 0, 5.2], ['handoff', 'ko_rotPopRatio', 0, 3], ['handoff', 'wrecked_maxRotDeg', 0, 8],
  ['handoff', 'wrecked_rotPopRatio', 0, 3], ['handoff', 'respawn_maxRotDeg', 0, 8], ['handoff', 'respawn_rotPopRatio', 0, 3],
  ['handoff', 'intro_maxRotDeg', 0, 8], ['handoff', 'intro_rotPopRatio', 0, 3],
  // camera review r2: a traffic crash never puts the eye inside the vehicle, the body is never hidden by it
  // for more than 6 frames (car, stopped van, oncoming bus)
  ['trafficCam', 'car_crashed', true, true], ['trafficCam', 'car_eyeInBox', 0, 0], ['trafficCam', 'car_hiddenRun', 0, 6],
  ['trafficCam', 'van_crashed', true, true], ['trafficCam', 'van_eyeInBox', 0, 0], ['trafficCam', 'van_hiddenRun', 0, 6],
  ['trafficCam', 'bus_crashed', true, true], ['trafficCam', 'bus_eyeInBox', 0, 0], ['trafficCam', 'bus_hiddenRun', 0, 6],
  // respawn keeps the rider on screen (a glide that would lose it cuts instead); SHOWTIME hands back settled;
  // pause freezes shake / kick / buzz; chasePose() is the live chase pose
  ['respawnCam', 'traffic_respawned', true, true], ['respawnCam', 'water_respawned', true, true],
  ['respawnCam', 'traffic_onScreen', 0.9, 1], ['respawnCam', 'water_onScreen', 0.9, 1], ['respawnCam', 'slow_onScreen', 0.9, 1],
  ['respawnCam', 'traffic_maxRotDeg', 0, 8], ['respawnCam', 'water_maxRotDeg', 0, 8], ['respawnCam', 'slow_maxRotDeg', 0, 8],
  ['ultHandback', 'cinematic', true, true], ['ultHandback', 'chaseDy', 0, 0.3], ['ultHandback', 'blendEndDy', 0, 0.1],
  ['ultHandback', 'blendMaxRotDeg', 0, 2],
  ['pauseCam', 'buzz_rotDeg', 0, 0.01], ['pauseCam', 'shake_rotDeg', 0, 0.01], ['pauseCam', 'shake_move', 0, 0.001],
  ['pauseCam', 'kick_fov', 0, 0.01], ['pauseCam', 'kick_move', 0, 0.001], ['pauseCam', 'chasePoseErr', 0, 0.02],
  // feel review r3: an L3 release mid-corner never wrecks; full lock holds the line (<= 2 m wide), full / half never
  // point > 10 deg out of the bend; pressing into a rival = one bump per approach, headings ease (<= 300 deg/s)
  ...[46, 60, 90].flatMap((R) => [
    ['driftRelease', `R${R}_full_crashed`, false, false], ['driftRelease', `R${R}_half_crashed`, false, false],
    ['driftRelease', `R${R}_neutral_crashed`, false, false], ['driftRelease', `R${R}_full_runWide`, 0, 2],
    ['driftRelease', `R${R}_full_yawOutDeg`, 0, 10], ['driftRelease', `R${R}_half_yawOutDeg`, 0, 10],
  ]),
  // acceptance r1: an L3 release halfway round a hairpin keeps the drift's bite for the rest of the bend (exit carve):
  // full lock holds the line, half lock and neutral hands run wide below the wall-crash angle and never wreck
  ...[26, 28, 30].flatMap((R) => [
    ['driftRelease', `R${R}_full_crashed`, false, false], ['driftRelease', `R${R}_half_crashed`, false, false],
    ['driftRelease', `R${R}_neutral_crashed`, false, false], ['driftRelease', `R${R}_full_runWide`, 0, 2],
    ['driftRelease', `R${R}_full_yawOutDeg`, 0, 10], ['driftRelease', `R${R}_half_yawOutDeg`, 0, 10],
    ['driftRelease', `R${R}_half_runWide`, 0, 6], ['driftRelease', `R${R}_neutral_yawOutDeg`, 0, 20],
  ]),
  ['press', 'sideBumps', 1, 1], ['pressYaw', 'bumps_60', 1, 1], ['pressYaw', 'bumps_144', 1, 1],
  ['pressYaw', 'playerYawStepDeg_60', 0, 5.2], ['pressYaw', 'rivalYawStepDeg_60', 0, 5.2],
  // (144 fps: <= 2.6 deg = 375 deg/s, the heading rate of a full-lock steering onset; the stub race AI steers the rival
  // back to its lane in one frame after the bounce)
  ['pressYaw', 'playerYawStepDeg_144', 0, 2.2], ['pressYaw', 'rivalYawStepDeg_144', 0, 2.6], ['pressYaw', 'hpLost_60', 0, 12],
  ['draftBrake', 'draftBeforeBrake', 0.5, 1], ['draftBrake', 'draftWhileBraking', 0, 0],
  ['draftBrake', 'slingshotWhileBraking', 0, 0], ['draftBrake', 'draftSlow', 0, 0],
  ['poses', 'brakePitchDeg', -4, -2.5], ['poses', 'scrapeYawDeg', 3, 7], ['poses', 'scrapeLeanDeg', 6, 12],
  ['poses', 'respawnMaxDv', 0, 0.5],
  // camera review r3: chase distance is world metres (tight bends never zoom the hero), boosts never shrink it > 5 %
  ['occlusion', 'gap18_fullHiddenRun', 0, 6], ['occlusion', 'gap18_minVisible', 2, 9], ['occlusion', 'gap25_minVisible', 5, 9],
  ['occlusion', 'gap35_minVisible', 7, 9], ['occlusion', 'gap25_fullHiddenRun', 0, 0], ['occlusion', 'gap35_fullHiddenRun', 0, 0],
  ['tightCam', 'L46in_distRatio', 0.92, 1.08], ['tightCam', 'L46out_distRatio', 0.92, 1.08], ['tightCam', 'releaseShrink', -1, 0.05],
  // r4 (SPEC §16/§15/§20): a spin lands clean and pays 120, an unfinished one wrecks the rider (cause 'trick'),
  // the umbrella glide floats far longer than plain air (and tricks nothing), the weather grip slows the grip
  ['trick', 'spinPoints', 120, 120], ['trick', 'spinCount', 1, 1], ['trick', 'spinCrashed', false, false],
  ['trick', 'shortSafe', true, true], ['trick', 'glideRatio', 1.4, 3], ['trick', 'glideTricks', 0, 0],
  ['trick', 'gripRatio', 0, 0.8],
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
