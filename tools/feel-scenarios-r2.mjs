// Feel scenarios for what the second feel review caught: pressing into a wall pinballed (one impact, then a
// scrape now), steering away after an impact was dead, drift charge timing on real-world bend radii,
// PERFECT landings that steering could not fail, light knocks against a victim steering back, and drifts
// that followed hairpins on rails.
import { DEG, events, prep, r3, run } from './feel-steps.mjs';

/** Yaw direction reversals per second in rows with t > t0 (oscillation detector). */
function reversals(rows, t0) {
  const ys = rows.filter((r) => r.t > t0).map((r) => r.yaw);
  let n = 0;
  for (let i = 2; i < ys.length; i++) if ((ys[i] - ys[i - 1]) * (ys[i - 1] - ys[i - 2]) < -1e-12) n++;
  const span = rows.length ? rows[rows.length - 1].t - t0 : 1;
  return n / Math.max(0.1, span);
}

const wallPin = {
  name: 'wallPin',
  async run({ page }) {
    const m = {};
    for (const steer of [0.3, 0.6, 1]) {
      // 1.55 m from the wall limit (like the coast cliff probe), 4 s of steering into it.
      await prep(page, { v: 20, x: 4.1, wall: 6 });
      const rows = await run(page, [{ time: 4, controls: { throttle: 1, steer } }]);
      const ev = (await events(page)).filter((e) => e.type === 'rider:obstacleHit');
      const walls = ev.filter((e) => e.kind === 'wall');
      const i0 = walls.length ? rows.findIndex((r) => r.t >= walls[0].t) : -1;
      let step = 0;
      for (let i = Math.max(1, i0 - 1); i0 >= 0 && i < Math.min(rows.length, i0 + 12); i++) {
        step = Math.max(step, Math.abs(rows[i].yaw - rows[i - 1].yaw) * DEG);
      }
      const tag = String(Math.round(steer * 10));
      m[`hits_${tag}`] = walls.length;
      m[`scrapes_${tag}`] = ev.length - walls.length;
      m[`yawRevPerSec_${tag}`] = r3(reversals(rows, 1.5));
      m[`impactYawStepDeg_${tag}`] = r3(step);
      m[`vEnd_${tag}`] = r3(rows[rows.length - 1].v);
    }
    // Steer 0.6 into the wall, then full steer away from the frame the impact is reported.
    await prep(page, { v: 20, x: 4.1, wall: 6 });
    m.steerAwayFrames = await page.evaluate(() => {
      const f = window.__feel;
      const p = window.__br.session().player;
      let hit = -1;
      for (let i = 0; i < 150; i++) {
        if (hit < 0 && f.events.some((e) => e.kind === 'wall')) hit = i;
        f.run([{ time: 1 / 60, controls: { throttle: 1, steer: hit >= 0 ? -1 : 0.6 } }], 1 / 60, false);
        if (hit >= 0 && p.vx < -2) return i - hit;
      }
      return 99;
    });
    return { metrics: m };
  },
};

/** Charge timing with full commitment on a gentle (R300) and a medium (R150) bend into the drift. */
const driftTiming = {
  name: 'driftTiming',
  async run({ page }) {
    const m = {};
    for (const R of [300, 150]) {
      await prep(page, { v: 20, x: -6, kappa: 1 / R, wall: 30 });
      await run(page, [
        { time: 0.05, controls: { throttle: 1, steer: 0.8, drift: true } },
        { time: 2.6, controls: { throttle: 1, steer: 1, drift: true } },
      ]);
      const ev = (await events(page)).filter((e) => e.type === 'rider:drift' && e.riderId === 0);
      const t0 = ev.find((e) => e.phase === 'start')?.t ?? 0;
      for (const L of [1, 2, 3]) {
        const e = ev.find((x) => x.phase === 'level' && x.level === L);
        m[`R${R}_L${L}`] = e ? r3(e.t - t0) : null;
      }
    }
    return { metrics: m };
  },
};

export const REVIEW2 = [wallPin, driftTiming];
