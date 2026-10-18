// Feel scenarios for what the third feel review caught: an L3 release mid-corner flung the bike outward (the
// boost outgrew the steering), pressing into a rival looped bounces with damage and snapped both headings,
// plus the weight / respawn / scrape / slipstream minors. Line-holding drift charge is reported, not checked.
import { DEG, events, prep, r3, run } from './feel-steps.mjs';

/** L3 release in a constant bend (κ = dir/R, walls at ±8.4 m), then `after` × full lock into it for 1.5 s. */
async function releaseRun(page, R, after) {
  const dir = -1; // left bend
  await prep(page, { v: 20, x: -dir * 5.8, kappa: dir / R, wall: 8.4 });
  return page.evaluate(([d, aft]) => {
    const f = window.__feel;
    const br = window.__br;
    const p = br.session().player;
    let rel = -1;
    const rows = [];
    for (let i = 0; i < 420; i++) {
      const lvl = br.sim.riders()[p.id]?.driftLevel ?? 0;
      if (rel < 0 && lvl >= 3) rel = i;
      const drifting = rel < 0;
      br.setControls({ throttle: 1, steer: drifting ? d : d * aft, drift: drifting });
      br.step(1, 1 / 60);
      f.t += 1 / 60;
      if (rel >= 0) rows.push({ yaw: p.yaw * d, x: p.x * d, mode: p.mode });
      if (rel >= 0 && i - rel >= 90) break;
    }
    if (!rows.length) return null;
    let step = 0;
    for (let i = 1; i < rows.length; i++) step = Math.max(step, Math.abs(rows[i].yaw - rows[i - 1].yaw));
    return {
      releaseT: rel / 60, crashed: rows.some((q) => q.mode === 'crashed'),
      runWide: rows[0].x - Math.min(...rows.map((q) => q.x)),
      yawOut: -Math.min(0, ...rows.map((q) => q.yaw)), maxYawStep: step,
    };
  }, [dir, after]);
}

const driftRelease = {
  name: 'driftRelease',
  async run({ page }) {
    const m = {};
    for (const R of [46, 60, 90]) {
      for (const [tag, after] of [['full', 1], ['half', 0.5], ['neutral', 0]]) {
        const res = await releaseRun(page, R, after);
        const k = `R${R}_${tag}`;
        if (!res) {
          m[`${k}_crashed`] = 'no L3';
          continue;
        }
        m[`${k}_crashed`] = res.crashed;
        m[`${k}_runWide`] = r3(res.runWide);
        m[`${k}_yawOutDeg`] = r3(res.yawOut * DEG);
        m[`${k}_maxYawStepDeg`] = r3(res.maxYawStep * DEG);
      }
    }
    return { metrics: m };
  },
};

/** The player presses into a coasting rival alongside for 3 s: bumps, HP, per-frame heading steps of both. */
const pressYaw = {
  name: 'pressYaw',
  async run({ page }) {
    const m = {};
    for (const [tag, dt] of [['60', 1 / 60], ['144', 1 / 144]]) {
      // Let the previous run's heading ease / carry windows run out apart before the measured press.
      await prep(page, { v: 18, x: 0, rival: { id: 1, s: 300, x: 0, v: 18 } });
      await run(page, [{ time: 0.4, controls: { throttle: 1 } }]);
      await prep(page, { v: 18, x: 0.4, rival: { id: 1, s: 60, x: -1.2, v: 18 } });
      const res = await page.evaluate((d) => {
        const f = window.__feel;
        const br = window.__br;
        const ses = br.session();
        const p = ses.player;
        const g = ses.rider(1);
        p.hp = p.maxHp;
        g.hp = g.maxHp;
        let py = p.yaw;
        let gy = g.yaw;
        let ps = 0;
        let gs = 0;
        for (let i = 0; i < Math.round(3 / d); i++) {
          br.setControls({ throttle: 1, steer: -1 });
          br.step(1, d);
          f.t += d;
          if (i > 0) {
            ps = Math.max(ps, Math.abs(p.yaw - py));
            gs = Math.max(gs, Math.abs(g.yaw - gy));
          }
          py = p.yaw;
          gy = g.yaw;
        }
        return { ps, gs, hpP: p.maxHp - p.hp, hpG: g.maxHp - g.hp, minDx: Math.abs(g.x - p.x) };
      }, dt);
      const bumps = (await events(page)).filter((e) => e.type === 'rider:bump').length;
      m[`bumps_${tag}`] = bumps;
      m[`playerYawStepDeg_${tag}`] = r3(res.ps * DEG);
      m[`rivalYawStepDeg_${tag}`] = r3(res.gs * DEG);
      m[`hpLost_${tag}`] = r3(res.hpP + res.hpG);
    }
    return { metrics: m };
  },
};

/** Drift charge when the drift holds its line on R150 (counter-steering against the bend): a report, no check. */
const lineHold = {
  name: 'lineHold',
  async run({ page }) {
    await prep(page, { v: 20, x: 0, kappa: 1 / 150, wall: 30 });
    await run(page, [
      { time: 0.05, controls: { throttle: 1, steer: 0.8, drift: true } },
      { time: 3.5, controls: { throttle: 1, drift: true }, steerHold: { x: 0 } },
    ]);
    const ev = (await events(page)).filter((e) => e.type === 'rider:drift' && e.riderId === 0);
    const t0 = ev.find((e) => e.phase === 'start')?.t ?? 0;
    const m = {};
    for (const L of [1, 2, 3]) {
      const e = ev.find((x) => x.phase === 'level' && x.level === L);
      m[`R150_L${L}`] = e ? r3(e.t - t0) : null;
    }
    return { metrics: m };
  },
};

/** No slipstream or slingshot while braking or below 8 m/s; braking resets the draft. */
const draftBrake = {
  name: 'draftBrake',
  async run({ page }) {
    await prep(page, { v: 20, x: 0, rival: { id: 1, s: 66, x: 0, v: 20 } });
    const rows = await run(page, [
      { time: 1.2, controls: { throttle: 1 } },
      { time: 1.0, controls: { brake: 1 }, tag: 'brake' },
    ]);
    const braking = rows.filter((q) => q.tag === 'brake');
    const tb = braking[0]?.t ?? 0;
    const ev = (await events(page)).filter((e) => e.type === 'rider:boost' && e.riderId === 0 && e.t >= tb);
    const m = {
      draftBeforeBrake: r3(rows.filter((q) => q.tag !== 'brake').at(-1)?.draft ?? 0),
      draftWhileBraking: r3(Math.max(...braking.slice(1).map((q) => q.draft))),
      slingshotWhileBraking: ev.length,
    };
    await prep(page, { v: 7, x: 0, rival: { id: 1, s: 66, x: 0, v: 7 } });
    const slow = await run(page, [{ time: 1.5, controls: { throttle: 0.2 } }]);
    m.draftSlow = r3(Math.max(...slow.map((q) => q.draft)));
    return { metrics: m };
  },
};

/** Weight cues and contact poses: brake pitch, respawn push-off, the pose while scraping a wall at full lock. */
const poses = {
  name: 'poses',
  async run({ page }) {
    const m = {};
    await prep(page, { v: 20, x: 0 });
    const brake = await run(page, [{ time: 2, controls: { brake: 1 } }]);
    m.brakePitchDeg = r3(Math.min(...brake.map((q) => q.pitch)) * DEG);
    await prep(page, { v: 20, x: 4.1, wall: 6 });
    const wall = await run(page, [{ time: 3, controls: { throttle: 1, steer: 1 } }]);
    const late = wall.filter((q) => q.t > 1.5);
    m.scrapeYawDeg = r3((late.reduce((a, q) => a + q.yaw, 0) / late.length) * DEG);
    m.scrapeLeanDeg = r3((late.reduce((a, q) => a + q.lean, 0) / late.length) * DEG);
    await prep(page, { v: 15, x: 0 });
    m.respawnMaxDv = await page.evaluate(() => {
      const f = window.__feel;
      const br = window.__br;
      const ses = br.session();
      const p = ses.player;
      ses.physics.crash(p, 'obstacle', null);
      let prev = 0;
      let max = 0;
      for (let i = 0; i < 260; i++) {
        br.setControls({ throttle: 1 });
        br.step(1, 1 / 60);
        f.t += 1 / 60;
        const v = p.mode === 'racing' ? p.speed : 0;
        max = Math.max(max, v - prev);
        prev = v;
      }
      return p.mode === 'racing' ? max : -1;
    });
    m.respawnMaxDv = r3(m.respawnMaxDv);
    return { metrics: m };
  },
};

/** Page-side: camera → rider distance and the hero's projected height (foot → 1.8 m above) right now. */
function installHeroProbe(page) {
  return page.evaluate(() => {
    const br = window.__br;
    const app = br.app;
    const V = app.camera.position.constructor;
    const Qn = app.camera.quaternion.constructor;
    const pos = new V();
    const head = new V();
    const q = new Qn();
    window.__hero = () => {
      const ses = br.session();
      ses.physics.pose(ses.player, pos, q);
      head.set(0, 1.8, 0).applyQuaternion(q).add(pos);
      const dist = app.camera.position.distanceTo(head.clone().lerp(pos, 0.5));
      const a = pos.clone().project(app.camera).y;
      const b = head.project(app.camera).y;
      return { dist, size: ((b - a) / 2) * app.size.height };
    };
  });
}

/**
 * Real coast geometry (the stub world is straight, so a curvature patch cannot test world distances): chase
 * distance on the L46 hairpin's inside / outside line vs a straight, and the hero size through an L3 release there.
 */
const tightCam = {
  name: 'tightCam',
  stub: 'actors,combat,race,fx,ui,audio',
  async run({ page }) {
    await installHeroProbe(page);
    const m = {};
    const hold = async (s, x) => {
      await prep(page, { s, v: 12, x, kappa: null, flat: false });
      return page.evaluate(([xx]) => {
        const f = window.__feel;
        let sum = 0;
        let n = 0;
        for (let i = 0; i < 180; i++) {
          f.run([{ time: 1 / 60, controls: { throttle: 0.5 }, steerHold: { x: xx } }], 1 / 60, false);
          if (i >= 120) { sum += window.__hero().dist; n++; }
        }
        return sum / n;
      }, [x]);
    };
    const flat = await hold(300, 0);
    for (const [tag, x] of [['in', -5.5], ['out', 5.5]]) m[`L46${tag}_distRatio`] = r3((await hold(1335, x)) / flat);
    await prep(page, { s: 1318, v: 20, x: 5.8, kappa: null, flat: false });
    const sz = await page.evaluate(() => {
      const br = window.__br;
      const p = br.session().player;
      const sizes = [];
      let rel = -1;
      for (let i = 0; i < 300 && (rel < 0 || i - rel < 75); i++) {
        if (rel < 0 && (br.sim.riders()[p.id]?.driftLevel ?? 0) >= 3) rel = i;
        br.setControls({ throttle: 1, steer: -1, drift: rel < 0 });
        br.step(1, 1 / 60);
        sizes.push(window.__hero().size);
      }
      if (rel < 12) return null;
      const pre = sizes.slice(rel - 12, rel).reduce((x, y) => x + y, 0) / 12;
      return { pre, min: Math.min(...sizes.slice(rel)) };
    });
    m.releaseSizePre = sz ? r3(sz.pre) : null;
    m.releaseShrink = sz ? r3(1 - sz.min / sz.pre) : null;
    return { metrics: m };
  },
};

/**
 * A rival closing in from 6 m to `gap` m behind the hero on its line at 4.2 m/s (re-placed every frame): hero points
 * visible from the rendered eye (the camera critic's 9 rays: s ± 0.5 × wheels / hips / head vs the rival's box
 * |ds| < .85, |dx| < .32, 1.8 m tall).
 */
const occlusion = {
  name: 'occlusion',
  async run({ page }) {
    const m = {};
    for (const gap of [1.8, 2.5, 3.5]) {
      await prep(page, { v: 18, x: 0.3 });
      const res = await page.evaluate((g) => {
        const br = window.__br;
        const ses = br.session();
        const p = ses.player;
        const r = ses.rider(1);
        const cam = br.app.camera;
        let worst = 0;
        let fullRun = 0;
        let maxRun = 0;
        let sum = 0;
        for (let i = 0; i < 180; i++) {
          const d = Math.max(g, 6 - i * 0.07);
          Object.assign(r, { s: p.s - d, x: p.x, speed: p.speed, vx: 0, mode: 'racing', invuln: 0 });
          br.setControls({ throttle: 1, steer: Math.sin(i / 25) * 0.15 });
          br.step(1, 1 / 60);
          const e = ses.track.project(cam.position, p.s);
          let blocked = 0;
          for (const ds of [-0.5, 0, 0.5]) for (const hy of [0.35, 1.0, 1.6]) {
            let hit = false;
            for (let k = 1; k < 16 && !hit; k++) {
              const a = k / 16;
              const ss = e.s + (p.s + ds - e.s) * a;
              const xx = e.x + (p.x - e.x) * a;
              const yy = e.y + (p.y + hy - e.y) * a;
              hit = Math.abs(ss - r.s) < 0.85 && Math.abs(xx - r.x) < 0.32 && yy < r.y + 1.8;
            }
            if (hit) blocked++;
          }
          fullRun = blocked === 9 ? fullRun + 1 : 0;
          maxRun = Math.max(maxRun, fullRun);
          if (i >= 70) {
            worst = Math.max(worst, blocked);
            sum += 9 - blocked;
          }
        }
        return { minVisible: 9 - worst, meanVisible: sum / 110, maxRun };
      }, gap);
      const k = `gap${String(gap).replace('.', '')}`;
      m[`${k}_minVisible`] = res.minVisible;
      m[`${k}_meanVisible`] = r3(res.meanVisible);
      m[`${k}_fullHiddenRun`] = res.maxRun;
    }
    return { metrics: m };
  },
};

export const REVIEW3 = [driftRelease, pressYaw, lineHold, draftBrake, poses, tightCam, occlusion];
