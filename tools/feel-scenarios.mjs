// Scenario table for tools/feel-telemetry.mjs. Each scenario drives the page through window.__feel
// (tools/feel-lib.mjs) and returns { metrics, rows?, strip? }. Physics-only scenarios patch the track
// flat/straight (curvature 0, slope 0) so numbers are clean; camera scenarios keep real geometry.
import { crossTime, jitter, maxOf, minOf } from './feel-lib.mjs';
import { DEG, events, prep, r3, run, stripEnd, stripStart } from './feel-steps.mjs';

const accel = {
  name: 'accel',
  async run({ page }) {
    await prep(page, { v: 0 });
    const rows = await run(page, [{ time: 20, controls: { throttle: 1 } }]);
    const at = (t) => rows.find((r) => r.t >= t)?.v ?? null;
    return {
      metrics: { t0to60: crossTime(rows, 'v', 60 / 3.6), v5: r3(at(5)), v10: r3(at(10)), top: r3(maxOf(rows, 'v')) },
      rows,
    };
  },
};

const coastBrake = {
  name: 'coastBrake',
  async run({ page }) {
    await prep(page, { v: 20 });
    const coast = await run(page, [{ time: 2, controls: { throttle: 0 } }]);
    await prep(page, { v: 20 });
    const brake = await run(page, [{ time: 2, controls: { brake: 1 } }]);
    const stop = brake.find((r) => r.v <= 0.01);
    return {
      metrics: {
        coastDecel: r3((20 - coast[coast.length - 1].v) / 2),
        brakeDecel: r3(stop ? 20 / stop.t : null),
        brakeStopDist: r3(stop ? stop.s - 60 : null),
      },
    };
  },
};

const steer = {
  name: 'steer',
  async run({ page, strips }) {
    await prep(page, { v: 20, x: -5 });
    if (strips) await stripStart(page);
    const rows = await run(page, [
      { time: 0.3, controls: { throttle: 1 }, tag: 'pre', grabEvery: 9 },
      { time: 0.9, controls: { throttle: 1, steer: 1 }, tag: 'hold', grabEvery: 9 },
      { time: 1.0, controls: { throttle: 1 }, tag: 'release', grabEvery: 9 },
    ]);
    const strip = strips ? await stripEnd(page) : null;
    const hold = rows.filter((r) => r.tag === 'hold');
    const rel = rows.filter((r) => r.tag === 'release');
    const t0 = hold[0].t - 1 / 60;
    const vxEnd = hold[hold.length - 1].vx;
    const firstVisible = hold.findIndex((r) => Math.abs(r.yaw) * DEG > 0.5) + 1;
    return {
      metrics: {
        vxFinal: r3(vxEnd),
        tau63: crossTime(hold, 'vx', 0.632 * vxEnd, t0),
        framesToVisible: firstVisible,
        yawMaxDeg: r3(maxOf(hold, 'yaw') * DEG),
        leanMaxDeg: r3(maxOf(rows, 'lean') * DEG),
        releaseOvershoot: r3(Math.max(0, -minOf(rel, 'vx')) / Math.max(1e-6, vxEnd)),
        releaseCounterLeanDeg: r3(Math.max(0, -minOf(rel, 'lean')) * DEG),
        leanSettleAfterRelease: crossTime(rel, 'lean', 0.02, rel[0].t - 1 / 60),
      },
      rows, strip,
    };
  },
};

const keyboard = {
  name: 'keyboard',
  async run({ page }) {
    await prep(page, { v: 20, x: -5 });
    const rows = await run(page, [
      { time: 0.2, controls: { throttle: 1 }, tag: 'pre' },
      { time: 0.6, controls: { throttle: 1 }, steerRamp: { target: 1, rate: 6.5 }, tag: 'hold' },
    ]);
    const hold = rows.filter((r) => r.tag === 'hold');
    const x0 = hold[0].x - hold[0].vx / 60;
    return {
      metrics: {
        framesToYaw05: hold.findIndex((r) => Math.abs(r.yaw) * DEG > 0.5) + 1,
        framesToX2cm: hold.findIndex((r) => r.x - x0 > 0.02) + 1,
        framesToLean2: hold.findIndex((r) => r.lean * DEG > 2) + 1,
      },
    };
  },
};


const slalom = {
  name: 'slalom',
  async run({ page, strips }) {
    await prep(page, { v: 20, x: 0 });
    if (strips) await stripStart(page);
    const rows = await run(page, [{ time: 4, controls: { throttle: 1 }, steerSin: 0.6, grabEvery: 15 }]);
    const strip = strips ? await stripEnd(page) : null;
    const late = rows.filter((r) => r.t > 1);
    return {
      metrics: {
        leanAmpDeg: r3(maxOf(late, 'lean') * DEG), yawAmpDeg: r3(maxOf(late, 'yaw') * DEG),
        xAmp: r3(maxOf(late, 'x')), leanJitterDeg: r3(jitter(rows, 'lean') * DEG),
      },
      rows, strip,
    };
  },
};

/** Steer needed to hold the line at top speed on curves of radius R (bisection on constant steer). */
const curveHold = {
  name: 'curveHold',
  async run({ page }) {
    const out = {};
    for (const R of [45, 60, 100, 200]) {
      let lo = 0;
      let hi = 1.6;
      for (let i = 0; i < 9; i++) {
        const k = (lo + hi) / 2;
        await prep(page, { v: 20, kappa: 1 / R, wall: 40 });
        const rows = await run(page, [{ time: 2, controls: { throttle: 1, steer: k } }]);
        const a = rows.find((r) => r.t >= 1);
        const b = rows[rows.length - 1];
        if (b.x - a.x < 0) lo = k; else hi = k; // still drifting outward (left on a right-hander) → more steer
      }
      out[`R${R}`] = r3((lo + hi) / 2);
    }
    return { metrics: out };
  },
};

const drift = {
  name: 'drift',
  async run({ page, strips }) {
    await prep(page, { v: 20, x: 0, kappa: 1 / 45, wall: 30 });
    if (strips) await stripStart(page);
    const rows = await run(page, [
      { time: 0.3, controls: { throttle: 1, steer: 0.4 }, tag: 'pre', grabEvery: 12 },
      { time: 2.3, controls: { throttle: 1, drift: true, steer: 0.4 }, tag: 'drift', grabEvery: 12 },
      { time: 1.6, controls: { throttle: 1, steer: 0.6 }, tag: 'boost', grabEvery: 12 },
    ]);
    const strip = strips ? await stripEnd(page) : null;
    const ev = await events(page);
    const d = ev.filter((e) => e.type === 'rider:drift' && e.riderId === 0);
    const start = d.find((e) => e.phase === 'start');
    const levels = d.filter((e) => e.phase === 'level').map((e) => r3(e.t - (start?.t ?? 0)));
    const boost = ev.find((e) => e.type === 'rider:boost' && e.kind === 'drift');
    const dr = rows.filter((r) => r.tag === 'drift');
    const after = rows.filter((r) => r.tag === 'boost');
    return {
      metrics: {
        started: !!start, levelTimes: levels, endLevel: d.find((e) => e.phase === 'end')?.level ?? null,
        boostPower: boost?.power ?? null, boostTime: boost?.time ?? null,
        speedAtRelease: r3(dr[dr.length - 1]?.v), bleedPerSec: r3((20 - (dr[dr.length - 1]?.v ?? 20)) / 20 / 2.3),
        peakAfter: r3(maxOf(after, 'v')), slipMaxDeg: r3(maxOf(dr, 'yaw') * DEG), fovPeak: r3(maxOf(after, 'fov')),
      },
      rows, strip,
    };
  },
};

const air = {
  name: 'air',
  async run({ page, strips }) {
    await prep(page, { v: 18 });
    const hop = await run(page, [{ time: 0.1, controls: { throttle: 1 } }, { time: 0.9, controls: { throttle: 1 }, edge: 'hop' }]);
    const hopLand = (await events(page)).find((e) => e.type === 'rider:land');
    await prep(page, { v: 20 });
    await page.evaluate(() => window.__feel.addFeature({ kind: 'ramp', s0: 80, s1: 86, x0: -3, x1: 3, data: { height: 1.2 } }));
    if (strips) await stripStart(page);
    const ramp = await run(page, [{ time: 2.2, controls: { throttle: 1 }, grabEvery: 9 }]);
    const strip = strips ? await stripEnd(page) : null;
    const rampEv = await events(page);
    const rampLand = rampEv.find((e) => e.type === 'rider:land');
    // The same ramp steering full lock through the flight (not PERFECT), and again with Space pressed just
    // before touchdown ("stick the landing": PERFECT while the bike is still within 12°).
    const rampWith = async (segs) => {
      await prep(page, { v: 20 });
      await page.evaluate(() => window.__feel.addFeature({ kind: 'ramp', s0: 80, s1: 86, x0: -3, x1: 3, data: { height: 1.2 } }));
      await run(page, segs);
      return (await events(page)).find((e) => e.type === 'rider:land');
    };
    const steerLand = await rampWith([{ time: 1.25, controls: { throttle: 1 } }, { time: 1.2, controls: { throttle: 1, steer: 1 } }]);
    const stickLand = await rampWith([
      { time: 1.25, controls: { throttle: 1 } }, { time: 0.6, controls: { throttle: 1, steer: 1 } },
      { time: 0.6, controls: { throttle: 1, steer: 1 }, edge: 'hop' },
    ]);
    // Sharp natural crest (launches by itself) and a gentle one with a jumpCrest kick.
    await prep(page, { v: 20 });
    await page.evaluate(() => window.__feel.patch({ kappa: 0, crestAt: 100, crestSlope: 0.2, crestWidth: 2 }));
    const sharp = await run(page, [{ time: 3.6, controls: { throttle: 1 } }]);
    const sharpLand = (await events(page)).find((e) => e.type === 'rider:land');
    await prep(page, { v: 20 });
    await page.evaluate(() => {
      window.__feel.patch({ kappa: 0, crestAt: 100, crestSlope: 0.12, crestWidth: 10 });
      window.__feel.addFeature({ kind: 'jumpCrest', s0: 90, s1: 110, x0: -7, x1: 7 });
    });
    await run(page, [{ time: 3.6, controls: { throttle: 1 } }]);
    const kickLand = (await events(page)).find((e) => e.type === 'rider:land');
    return {
      metrics: {
        hopAir: r3(hopLand?.airTime), hopPeak: r3(maxOf(hop, 'y')), hopPerfect: hopLand?.perfect ?? null,
        rampAir: r3(rampLand?.airTime), rampPeak: r3(maxOf(ramp, 'y')), rampPerfect: rampLand?.perfect ?? null,
        rampBoost: rampEv.some((e) => e.type === 'rider:boost' && e.kind === 'land'),
        rampSteerAir: r3(steerLand?.airTime), rampSteerPerfect: steerLand?.perfect ?? null,
        rampStickAir: r3(stickLand?.airTime), rampStickPerfect: stickLand?.perfect ?? null,
        rampPitchMaxDeg: r3(maxOf(ramp, 'pitch') * DEG), rampPitchMinDeg: r3(minOf(ramp, 'pitch') * DEG),
        sharpCrestAir: r3(sharpLand?.airTime ?? 0), sharpCrestPeak: r3(maxOf(sharp, 'y')),
        kickCrestAir: r3(kickLand?.airTime ?? 0),
      },
      rows: ramp, strip,
    };
  },
};


export const HANDLING = [accel, coastBrake, steer, keyboard, slalom, curveHold, drift, air];
