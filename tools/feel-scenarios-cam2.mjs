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

/** Page-side: crash the player (traffic on a straight / off the beach into the sea), follow the respawn: glide
 *  frames, rider on screen per glide frame, deliberate cuts and the largest rotation step outside cuts. */
const RESPAWN_LOOP = ([o]) => {
  const f = window.__feel;
  const br = window.__br;
  const ses = br.session();
  const cam = br.app.camera;
  const p = ses.player;
  ses.obstacles.length = 0;
  for (const r of ses.riders) if (!r.isPlayer) f.place(r.id, 3000 - r.id * 20, 0, 0);
  f.place(p.id, o.s, o.x === 'beach' ? -ses.track.bounds(o.s).left + 2 : o.x, o.v);
  br.setControls({ throttle: 1 });
  br.step(20, 1 / 60);
  if (o.crash) ses.physics.crash(p, o.crash, null);
  const V = cam.position.constructor;
  const Q = cam.quaternion.constructor;
  const bp = new V(), bq = new Q(), pq = new Q().copy(cam.quaternion);
  let cuts = Number(br.sim.cam.cuts ?? 0);
  const cuts0 = cuts;
  let glide = 0, seen = 0, maxRot = 0, respawnAt = -1;
  for (let i = 0; i < 420; i++) {
    br.setControls({ throttle: 1, steer: o.steer });
    br.step(1, 1 / 60);
    const c = Number(br.sim.cam.cuts ?? 0);
    const rot = 2 * Math.acos(Math.min(1, Math.abs(pq.dot(cam.quaternion)))) * 57.29578;
    if (c === cuts) maxRot = Math.max(maxRot, rot);
    cuts = c;
    pq.copy(cam.quaternion);
    if (respawnAt < 0 && p.mode === 'respawning') respawnAt = i;
    if (br.sim.cam.blending === true) {
      glide++;
      ses.physics.pose(p, bp, bq);
      bp.y += 0.9;
      bp.project(cam);
      if (Math.abs(bp.x) < 1 && Math.abs(bp.y) < 1 && bp.z < 1) seen++;
    }
    if (respawnAt >= 0 && i > respawnAt + 45) break;
  }
  return { respawned: respawnAt >= 0, glide, onScreen: glide ? seen / glide : 1, cuts: cuts - cuts0, maxRot };
};

/** Respawn after a traffic crash and a water crash: the rider stays on screen (>= 90 % of glide frames). */
const respawnCam = {
  name: 'respawnCam',
  stub: 'combat,race,fx,ui,audio',
  async run({ page }) {
    const m = {};
    for (const o of [
      { tag: 'traffic', s: 500, x: 0, v: 20, steer: 0, crash: 'traffic' },
      { tag: 'water', s: 520, x: 'beach', v: 18, steer: -1, crash: null },
      { tag: 'slow', s: 500, x: 0, v: 4, steer: 0, crash: 'obstacle' },
    ]) {
      const r = await page.evaluate(RESPAWN_LOOP, [o]);
      m[`${o.tag}_respawned`] = r.respawned;
      m[`${o.tag}_glideFrames`] = r.glide;
      m[`${o.tag}_onScreen`] = r3(r.onScreen);
      m[`${o.tag}_cuts`] = r.cuts;
      m[`${o.tag}_maxRotDeg`] = r3(r.maxRot);
    }
    return { metrics: m };
  },
};

/** SHOWTIME (ult) hand-back: the first chase frame after the cinematic is already settled (eye height vs 0.6 s on). */
const ultHandback = {
  name: 'ultHandback',
  stub: '',
  async run({ page }) {
    const r = await page.evaluate(() => {
      const f = window.__feel;
      const br = window.__br;
      const ses = br.session();
      const app = br.app;
      const p = ses.player;
      ses.obstacles.length = 0;
      for (const rr of ses.riders) if (!rr.isPlayer) f.place(rr.id, 3000 - rr.id * 20, 0, 0);
      f.place(p.id, 300, 0, 20);
      f.place(1, 318, 1, 19);
      p.sp = 100;
      br.setControls({ throttle: 1 });
      br.step(20, 1 / 60);
      const eyeY = () => ses.track.project(app.camera.position, p.s).y;
      let cine = false, back = -1, y0 = 0, y1 = 0;
      for (let i = 0; i < 420; i++) {
        br.setControls({ throttle: 1, ult: i === 2 });
        br.step(1, 1 / 60);
        if (app.rig.mode === 'cinematic') cine = true;
        else if (cine && back < 0) { back = i; y0 = eyeY(); }
        if (back >= 0 && i === back + 36) { y1 = eyeY(); break; }
      }
      return { cine, back, y0, y1 };
    });
    return { metrics: { cinematic: r.cine && r.back > 0, handbackEyeY: r3(r.y0), settledEyeY: r3(r.y1), handbackDy: r3(Math.abs(r.y0 - r.y1)) } };
  },
};

/** Paused during a crash shake / a boost kick / speed buzz: the camera holds perfectly still. chasePose = chase. */
const pauseCam = {
  name: 'pauseCam',
  stub: 'combat,race,fx,ui,audio',
  async run({ page }) {
    const m = await page.evaluate(() => {
      const f = window.__feel;
      const br = window.__br;
      const ses = br.session();
      const app = br.app;
      const cam = app.camera;
      const out = {};
      for (const tag of ['buzz', 'shake', 'kick']) {
        f.place(ses.player.id, 300, 0, 20);
        br.setControls({ throttle: 1 });
        br.step(30, 1 / 60);
        if (tag === 'shake') app.bus.emit('cam:shake', { intensity: 0.6, duration: 0.9 });
        if (tag === 'kick') app.bus.emit('rider:boost', { riderId: ses.player.id, kind: 'drift', power: 0.35, time: 1.3 });
        br.step(3, 1 / 60);
        app.clock.setScale('pause', 0);
        const p0 = cam.position.clone(), q0 = cam.quaternion.clone(), f0 = cam.fov;
        let move = 0, rot = 0, fov = 0;
        for (let i = 0; i < 60; i++) {
          br.step(1, 1 / 60);
          move = Math.max(move, cam.position.distanceTo(p0));
          rot = Math.max(rot, 2 * Math.acos(Math.min(1, Math.abs(q0.dot(cam.quaternion)))) * 57.29578);
          fov = Math.max(fov, Math.abs(cam.fov - f0));
        }
        app.clock.setScale('pause', 1);
        out[`${tag}_move`] = +move.toFixed(5);
        out[`${tag}_rotDeg`] = +rot.toFixed(4);
        out[`${tag}_fov`] = +fov.toFixed(4);
      }
      // No shake running: the published chase pose is where the camera is.
      br.step(90, 1 / 60);
      const pos = cam.position.clone(), quat = cam.quaternion.clone();
      const fv = app.rig.chasePose ? app.rig.chasePose(pos, quat) : NaN;
      out.chasePoseErr = +(pos.distanceTo(cam.position) + Math.abs(fv - cam.fov) * 0.01).toFixed(4);
      return out;
    });
    return { metrics: m };
  },
};

export const CAMERA2 = [trafficCam, respawnCam, ultHandback, pauseCam];
