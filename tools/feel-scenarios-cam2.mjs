// Camera scenarios for what the second camera review caught: the crash cam following the wreck into the
// vehicle it hit (eye inside the box / body hidden behind or inside it), the respawn glide that lost the
// rider, the SHOWTIME hand-back landing on an unsettled pose, the camera moving behind the pause menu and
// water crashes framing the body as a speck. Each one asserts the visible result, not the implementation.
import { prep, r3 } from './feel-steps.mjs';

/** Page-side: eye-in-box frames and the longest run of frames with the body hidden by / inside `ob`. */
const TRAFFIC_LOOP = ([kind, o, ahead, grab]) => {
  const f = window.__feel;
  const br = window.__br;
  const ses = br.session();
  const app = br.app;
  const p = ses.player;
  f.addObstacle({ id: 900, kind, s: p.s + ahead, x: 0, ...o });
  const ob = ses.obstacles[ses.obstacles.length - 1];
  const body = new app.camera.position.constructor();
  const inside = (q, pad) => Math.abs(q.s - ob.s) < ob.halfLength + pad && Math.abs(q.x - ob.x) < ob.halfWidth + pad
    && q.y < ob.height + pad;
  let crashI = -1;
  let cause = null;
  let inBox = 0;
  let run = 0;
  let occMax = 0;
  let lift = 0;
  let frames = 0;
  for (let i = 0; i < 260; i++) {
    ob.s += ob.speed / 60;
    const steer = crashI < 0 ? Math.max(-1, Math.min(1, 0.6 * (ob.x - p.x) - 0.1 * p.vx)) : 0;
    br.setControls({ throttle: 1, steer });
    br.step(1, 1 / 60);
    f.t += 1 / 60;
    if (p.mode === 'crashed' && crashI < 0) {
      crashI = i;
      cause = p.crash?.cause ?? null;
    }
    if (crashI < 0) continue;
    if (p.mode !== 'crashed') break;
    frames++;
    const cam = app.camera;
    cam.updateMatrixWorld();
    const e = ses.track.project(cam.position, p.s);
    if (inside(e, 0.15)) inBox++;
    ses.views.get(p.id)?.anchor('body', body);
    const b = ses.track.project(body, p.s);
    let hidden = inside(b, 0);
    for (let k = 1; k < 12 && !hidden; k++) {
      const a = k / 12;
      hidden = inside({ s: e.s + (b.s - e.s) * a, x: e.x + (b.x - e.x) * a, y: e.y + (b.y - e.y) * a }, -0.05);
    }
    run = hidden ? run + 1 : 0;
    occMax = Math.max(occMax, run);
    lift = Math.max(lift, br.sim.cam.lift ?? 0);
    if (grab && f.strip && (i - crashI) % 12 === 4 && (i - crashI) < 52) f.grab();
  }
  ob.active = false;
  return { crashed: crashI >= 0, cause, frames, inBox, occMax, lift };
};

/** Crash into a stationary car, a stopped van and an oncoming bus (real actors: the body tumbles). */
const trafficCam = {
  name: 'trafficCam',
  stub: 'world,combat,race,fx,ui,audio',
  async run({ page, strips }) {
    const m = {};
    const cases = [
      ['car', { halfWidth: 0.9, halfLength: 1.95, height: 1.55, speed: 0 }, 30],
      ['van', { halfWidth: 0.975, halfLength: 2.3, height: 2.15, speed: 0 }, 30],
      ['bus', { halfWidth: 1.3, halfLength: 5.0, height: 3.05, speed: -10 }, 80],
    ];
    if (strips) await page.evaluate(() => window.__feel.stripStart(320));
    for (const [kind, o, ahead] of cases) {
      await prep(page, { v: 20, x: 0, s: 100, kappa: 0 });
      const r = await page.evaluate(TRAFFIC_LOOP, [kind, o, ahead, strips]);
      m[`${kind}_crashed`] = r.crashed && r.cause === 'traffic';
      m[`${kind}_eyeInBox`] = r.inBox;
      m[`${kind}_hiddenRun`] = r.occMax;
      m[`${kind}_lift`] = r3(r.lift);
      m[`${kind}_frames`] = r.frames;
      await page.evaluate(() => {
        const br = window.__br;
        for (let i = 0; i < 400 && br.session().player.mode !== 'racing'; i++) br.step(1, 1 / 60);
      });
    }
    const strip = strips ? await page.evaluate(() => window.__feel.stripEnd()) : null;
    return { metrics: m, strip };
  },
};

export const CAMERA2 = [trafficCam];
