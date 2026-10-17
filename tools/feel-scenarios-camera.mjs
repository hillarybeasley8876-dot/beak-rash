// Feel scenarios: frame-rate independence (screen jitter, camera jerk), slow motion, camera rig checks.
import { jitter } from './feel-lib.mjs';
import { prep, r3, run } from './feel-steps.mjs';

/** RMS jerk (m/s³) of the camera relative to the bike: what the eye reads as camera wobble. */
function camJerk(rows, dt) {
  let sum = 0;
  let n = 0;
  const rel = (r, k) => r[`cam${k}`] - r[`b${k}`];
  for (let i = 3; i < rows.length; i++) {
    const d3 = (k) => rel(rows[i], k) - 3 * rel(rows[i - 1], k) + 3 * rel(rows[i - 2], k) - rel(rows[i - 3], k);
    sum += d3('x') ** 2 + d3('y') ** 2 + d3('z') ** 2;
    n++;
  }
  return n ? Math.sqrt(sum / n) / dt ** 3 : 0;
}

/** Same in track space (camera offset from the rider in s/x/y): excludes the track's own sampling kinks. */
function camJerkTrack(rows, dt) {
  let sum = 0;
  let n = 0;
  for (let i = 3; i < rows.length; i++) {
    const d3 = (k) => rows[i][k] - 3 * rows[i - 1][k] + 3 * rows[i - 2][k] - rows[i - 3][k];
    sum += d3('cos') ** 2 + d3('cox') ** 2 + d3('coy') ** 2;
    n++;
  }
  return n ? Math.sqrt(sum / n) / dt ** 3 : 0;
}

/** Screen-space smoothness of the player bike at several frame rates and in 0.1× slow motion. */
const jitterSc = {
  name: 'jitter',
  async run({ page }) {
    const out = {};
    for (const [label, dt] of [['30', 1 / 30], ['60', 1 / 60], ['144', 1 / 144]]) {
      await prep(page, { v: 20, x: 0, kappa: null, flat: false, s: 150 });
      const rows = await run(page, [{ time: 4, controls: { throttle: 1 }, steerSin: 0.5, amp: 0.6 }], dt);
      const late = rows.filter((r) => r.t > 0.5);
      out[`screenPx_${label}`] = r3(Math.hypot(jitter(late, 'sx'), jitter(late, 'sy')));
      out[`screenAcc_${label}`] = r3(Math.hypot(jitter(late, 'sx'), jitter(late, 'sy')) / (dt * dt));
      out[`fovJit_${label}`] = r3(jitter(late, 'fov') / (dt * dt));
      out[`camJerk_${label}`] = r3(camJerk(late, dt));
      out[`camJerkTrack_${label}`] = r3(camJerkTrack(late, dt));
    }
    await prep(page, { v: 20, x: 0, kappa: null, flat: false, s: 150 });
    await page.evaluate(() => window.__br.setScale('ko', 0.1));
    const slow = await run(page, [{ time: 3, controls: { throttle: 1 }, steerSin: 0.5, amp: 0.6 }]);
    await page.evaluate(() => window.__br.setScale('ko', 1));
    const late = slow.filter((r) => r.t > 0.5);
    out.slowmoScreenPx = r3(Math.hypot(jitter(late, 'sx'), jitter(late, 'sy')));
    out.slowmoMaxStepPx = r3(Math.max(...late.slice(1).map((r, i) => Math.hypot(r.sx - late[i].sx, r.sy - late[i].sy))));
    return { metrics: out };
  },
};

const camera = {
  name: 'camera',
  async run({ page, strips }) {
    await prep(page, { v: 20, x: 0, kappa: null, flat: false, s: 300 });
    const res = await page.evaluate(() => {
      const br = window.__br;
      const f = window.__feel;
      const app = br.app;
      const ses = br.session();
      const tr = ses.track;
      const out = { minClear: 99, fovAtTop: 0, lookBackMode: '', cineSteps: [], blendFrames: 0 };
      f.run([{ time: 2, controls: { throttle: 1 } }], 1 / 60, false);
      out.fovAtTop = app.camera.fov;
      for (let i = 0; i < 240; i++) {
        f.run([{ time: 1 / 60, controls: { throttle: 1, steer: Math.sin(i / 20) } }], 1 / 60, false);
        const p = tr.project(app.camera.position, ses.player.s - 5);
        out.minClear = Math.min(out.minClear, p.y);
      }
      f.run([{ time: 0.25, controls: { throttle: 1, lookBack: true } }], 1 / 60, false);
      out.lookBackMode = br.sim.cam.mode;
      f.run([{ time: 0.1, controls: { throttle: 1 } }], 1 / 60, false);
      let t = 0;
      app.rig.override((cam, dt) => {
        t += dt;
        cam.position.set(cam.position.x, cam.position.y + 0.2, cam.position.z);
        return t < 0.5;
      }, 0.35);
      let prev = app.camera.position.clone();
      for (let i = 0; i < 90; i++) {
        f.run([{ time: 1 / 60, controls: { throttle: 1 } }], 1 / 60, false);
        const step = app.camera.position.distanceTo(prev);
        prev = app.camera.position.clone();
        out.cineSteps.push(+step.toFixed(3));
        if (br.sim.cam.blending) out.blendFrames++;
      }
      return out;
    });
    const steps = res.cineSteps;
    const steady = steps.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const blendSteps = steps.slice(29, 29 + res.blendFrames + 2);
    // A pop = one frame moving far more than its neighbours (blends ramp smoothly instead).
    let pop = 0;
    for (let i = 30; i < steps.length - 1; i++) {
      pop = Math.max(pop, steps[i] / Math.max(1e-3, Math.max(steps[i - 1], steps[i + 1])));
    }
    return {
      metrics: {
        fovAtTop: r3(res.fovAtTop), minClearance: r3(res.minClear), lookBackMode: res.lookBackMode,
        blendOutSec: r3(res.blendFrames / 60), steadyStep: r3(steady),
        blendMaxStep: r3(Math.max(...blendSteps)), popRatio: r3(pop),
      },
    };
  },
};


export const CAMERA = [jitterSc, camera];
