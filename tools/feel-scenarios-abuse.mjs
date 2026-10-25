// Feel scenarios for what the first feel review caught: drifting into walls (hold / neutral / counter on a
// straight and an R150 bend), knock displacement (+ the eased heading), drift-snaking vs riding straight, one
// wall event per approach (+ the bounce carry), and speed on long descents.
import { events, prep, r3, run } from './feel-steps.mjs';

const driftWall = {
  name: 'driftWall',
  async run({ page }) {
    const m = {};
    for (const [where, kappa] of [['k0', 0], ['k150', -1 / 150]]) {
      for (const [how, steer] of [['hold', -1], ['neutral', 0], ['counter', 1]]) {
        await prep(page, { v: 20, x: 0, kappa, wall: 8.8 });
        await run(page, [
          { time: 0.1, controls: { throttle: 1, steer: -1, drift: true } },
          { time: 2.5, controls: { throttle: 1, steer, drift: true } },
        ]);
        const ev = await events(page);
        const hit = ev.find((e) => (e.type === 'rider:obstacleHit' && e.kind === 'wall') || e.type === 'rider:crash');
        const lv = ev.filter((e) => e.type === 'rider:drift' && e.phase === 'level').map((e) => e.level);
        m[`${where}_${how}_clearSec`] = hit ? r3(hit.t) : 2.6;
        m[`${where}_${how}_level`] = lv.length ? Math.max(...lv) : 0;
        m[`${where}_${how}_crashed`] = ev.some((e) => e.type === 'rider:crash');
      }
    }
    return { metrics: m };
  },
};

const knock = {
  name: 'knock',
  async run({ page }) {
    const m = {};
    // lightSteer: the victim keeps steering full lock back toward the hitter (an AI pressing in) and must still
    // be shoved visibly (review r2: 0.29 m before the direction-aware knock clamp). YawStepDeg: the largest
    // heading change in one frame after the knock (game review r2: a heavy combat knock with no body contact
    // snapped the hero 16.8 deg in one frame; knocks now ease the nose like bumps, <= 300 deg/s).
    const cases = [['light', 3.2, 0, 60], ['heavy', 9, 0, 60], ['lightSteer', 3.2, -1, 60], ['heavy144', 9, 0, 144]];
    for (const [tag, lat, steer, fps] of cases) {
      await prep(page, { v: 20, x: 0, wall: 20 });
      await run(page, [{ time: 0.2, controls: { throttle: 1 } }]);
      const res = await page.evaluate(([L, st, hz]) => {
        const ses = window.__br.session();
        const f = window.__feel;
        const p = ses.player;
        ses.physics.applyImpulse(p, { lateral: L });
        const x0 = p.x;
        let best = 0, yaw = p.yaw, step = 0, peak = 0;
        for (let i = 0; i < hz; i++) {
          f.run([{ time: 1 / hz, controls: { throttle: 1, steer: st } }], 1 / hz, false);
          best = Math.max(best, p.x - x0);
          step = Math.max(step, Math.abs(p.yaw - yaw));
          peak = Math.max(peak, Math.abs(p.yaw));
          yaw = p.yaw;
        }
        return { disp: best, step: step * 180 / Math.PI, peak: peak * 180 / Math.PI };
      }, [lat, steer, fps]);
      if (fps === 60) m[`${tag}Disp`] = r3(res.disp);
      m[`${tag}YawStepDeg`] = r3(res.step);
      m[`${tag}PeakYawDeg`] = r3(res.peak);
    }
    return { metrics: m };
  },
};

/** 20 s of alternating drifts (steer `how` while holding), released as soon as L1 is reached. */
function snakeSegs(tn, how, hold) {
  const segs = [];
  let t = 0;
  for (let i = 0; t < 20; i++) {
    const d = i % 2 ? 1 : -1;
    const st = how === 'into' ? d : -d;
    segs.push({ time: 0.05, controls: { throttle: 1, steer: d * 0.8, drift: true } });
    segs.push({ time: hold - 0.05, controls: { throttle: 1, steer: st, drift: true } });
    segs.push({ time: tn.driftLockout + 0.02, controls: { throttle: 1 } });
    t += hold + tn.driftLockout + 0.02;
  }
  return segs;
}

const snake = {
  name: 'snake',
  async run({ page }) {
    const tn = await page.evaluate(() => window.__br.sim.tuning);
    const avg = async (segs) => {
      await prep(page, { v: 20, x: 0, wall: 9 });
      const rows = await run(page, segs);
      const end = rows.find((r) => r.t >= 20) ?? rows[rows.length - 1];
      return (end.s - 60) / end.t;
    };
    const plain = await avg([{ time: 20, controls: { throttle: 1 } }]);
    const intoHold = tn.driftLevels[0] / (tn.driftChargeHigh * tn.driftChargeStraight) + 0.05;
    const into = await avg(snakeSegs(tn, 'into', intoHold));
    const counter = await avg(snakeSegs(tn, 'counter', 0.6)); // the old exploit: L1 every 0.6 s
    return { metrics: { plainAvg: r3(plain), gainInto: r3(into / plain - 1), gainCounter: r3(counter / plain - 1) } };
  },
};

const wallEvents = {
  name: 'wallEvents',
  async run({ page }) {
    const m = {};
    for (const [label, dt] of [['30', 1 / 30], ['60', 1 / 60], ['144', 1 / 144]]) {
      await prep(page, { v: 20, x: 3, wall: 6 });
      const rows = await run(page, [{ time: 1.2, controls: { throttle: 1, steer: 1 } }], dt);
      const ev = (await events(page)).filter((e) => e.type === 'rider:obstacleHit' && e.kind === 'wall');
      let gap = 9;
      for (let i = 1; i < ev.length; i++) gap = Math.min(gap, ev[i].t - ev[i - 1].t);
      const t0 = ev[0]?.t ?? 0;
      const after = rows.filter((r) => r.t >= t0 && r.t < t0 + 0.5);
      m[`hits_${label}`] = ev.length;
      m[`minGap_${label}`] = r3(gap);
      m[`carry_${label}`] = r3(after.length ? after[0].x - Math.min(...after.map((r) => r.x)) : 0);
    }
    return { metrics: m };
  },
};

const slope = {
  name: 'slope',
  async run({ page }) {
    const m = {};
    for (const [tag, sl] of [['v13', -0.13], ['v055', -0.055], ['up10', 0.1]]) {
      await prep(page, { v: 20, x: 0, wall: 9 });
      await page.evaluate((s) => window.__feel.patch({ kappa: 0, slope: s, wall: 9 }), sl);
      const rows = await run(page, [{ time: 12, controls: { throttle: 1 } }]);
      m[tag] = r3(rows[rows.length - 1].v);
    }
    return { metrics: m };
  },
};

export const ABUSE = [driftWall, knock, snake, wallEvents, slope];
