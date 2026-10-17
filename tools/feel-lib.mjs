// Shared helpers for tools/feel-telemetry.mjs: a page-side recorder (installed into the game page),
// track patching for clean measurements, frame strips, and node-side metric helpers.
import fs from 'node:fs';
import path from 'node:path';

/** Install window.__feel into the page (recorder, segment runner, patches, strips). */
export async function installFeel(page) {
  await page.evaluate(() => {
    const br = window.__br;
    const app = br.app;
    const V = app.camera.position.constructor;
    const Q = app.camera.quaternion.constructor;
    const pos = new V();
    const quat = new Q();
    const ndc = new V();
    const feel = { t: 0, rec: [], events: [], kb: 0, frame: 0, strip: null };
    window.__feel = feel;
    const types = ['rider:hop', 'rider:land', 'rider:drift', 'rider:boost', 'rider:bump', 'rider:crash',
      'rider:respawn', 'rider:nearMiss', 'rider:offroad', 'rider:obstacleHit', 'cam:shake', 'cam:kick'];
    for (const ty of types) {
      app.bus.on(ty, (e) => feel.events.push({ t: +feel.t.toFixed(4), type: ty, ...e, pos: undefined }));
    }
    feel.reset = () => { feel.t = 0; feel.rec = []; feel.events = []; feel.frame = 0; };
    feel.sample = (tag) => {
      const s = br.session();
      const r = s.player;
      const sim = br.sim.riders()[r.id] ?? {};
      s.physics.pose(r, pos, quat);
      ndc.copy(pos).project(app.camera);
      const W = app.size.width;
      const H = app.size.height;
      const c = app.camera.position;
      return {
        t: +feel.t.toFixed(4), tag: tag ?? '', s: r.s, x: r.x, y: r.y, v: r.speed, vx: r.vx, vy: r.vy,
        yaw: r.yaw, lean: r.lean, pitch: sim.pitch ?? 0, air: r.airborne ? 1 : 0, drift: r.drifting ? 1 : 0,
        level: sim.driftLevel ?? 0, boost: r.boostTime, power: r.boostPower, draft: r.draft, mode: r.mode,
        hp: r.hp, surface: r.surface, camx: c.x, camy: c.y, camz: c.z, fov: app.camera.fov,
        sx: (ndc.x * 0.5 + 0.5) * W, sy: (1 - (ndc.y * 0.5 + 0.5)) * H,
        bx: pos.x, by: pos.y, bz: pos.z,
        steer: s.controls.get(r.id)?.steer ?? 0, kappa: s.track.frameAt(Math.min(r.s, s.track.length)).curvature,
        ...camOffset(),
        r1s: s.riders[1]?.s ?? 0, r1x: s.riders[1]?.x ?? 0, r1vx: s.riders[1]?.vx ?? 0, r1v: s.riders[1]?.speed ?? 0,
      };
    };
    const approach = (a, b, d) => (a < b ? Math.min(a + d, b) : Math.max(a - d, b));
    /** Chase camera offset from the rider in track space (cos = Δs, cox = Δx, coy = height), from the rig. */
    function camOffset() {
      const c = br.sim.cam;
      return { cos: c.offS ?? 0, cox: c.offX ?? 0, coy: c.height ?? 0 };
    }
    /** segs: [{ time, controls, tag, steerSin, amp, steerRamp: {target, rate}, edge, grabEvery }] */
    feel.run = (segs, dt, record = true) => {
      for (const seg of segs) {
        const n = Math.max(1, Math.round(seg.time / dt));
        for (let i = 0; i < n; i++) {
          const c = { ...(seg.controls ?? {}) };
          if (seg.steerSin) c.steer = Math.sin(2 * Math.PI * seg.steerSin * i * dt) * (seg.amp ?? 1);
          if (seg.steerRamp) {
            const tgt = seg.steerRamp.target;
            if (Math.sign(feel.kb) === -Math.sign(tgt) && tgt !== 0) feel.kb = 0;
            feel.kb = approach(feel.kb, tgt, (tgt === 0 ? 11 : seg.steerRamp.rate) * dt);
            c.steer = feel.kb;
          }
          if (seg.steerHold) {
            // Line holder: PD on x plus curvature feed-forward (what a decent player/AI would do).
            const ses = br.session();
            const r = ses.player;
            const tn = br.sim.tuning;
            const k = ses.track.frameAt(Math.min(r.s, ses.track.length)).curvature;
            const auth = (tn.steerAuthLow + (tn.steerAuthHigh - tn.steerAuthLow) * Math.min(1, r.speed / 20));
            const push = k * r.speed * r.speed * tn.curvePush;
            const h = seg.steerHold;
            const row = br.sim.riders()[r.id] ?? {};
            if (r.drifting && row.driftDir) {
              // Drift follows the bend; steering sets the speed across (driftLatOut…driftLatIn × v/top).
              const d = row.driftDir;
              const want = (h.dkp ?? 0.9) * (h.x - r.x);
              const vn = Math.max(0.05, Math.min(1, r.speed / 20));
              const u = Math.max(0, Math.min(1, ((want * d) / vn - tn.driftLatOut) / (tn.driftLatIn - tn.driftLatOut)));
              c.steer = d * (2 * u - 1);
            } else {
              c.steer = Math.max(-1, Math.min(1, push / auth + (h.kp ?? 0.35) * (h.x - r.x) - (h.kd ?? 0.12) * r.vx));
            }
          }
          if (seg.edge && i === 0) c[seg.edge] = true;
          br.setControls(c);
          br.step(1, dt);
          feel.t += dt;
          feel.frame++;
          if (record) feel.rec.push(feel.sample(seg.tag));
          if (feel.strip && seg.grabEvery && i % seg.grabEvery === 0) feel.grab();
        }
      }
    };
    feel.waitRacing = (dt = 1 / 60) => {
      for (let i = 0; i < 2400 && br.session()?.phase !== 'racing'; i++) br.step(1, dt);
      return br.session()?.phase;
    };
    feel.place = (id, s, x = 0, v = 0) => {
      const r = br.session().rider(id);
      Object.assign(r, { s, x, speed: v, vx: 0, y: 0, vy: 0, airborne: false, drifting: false, driftCharge: 0,
        boostTime: 0, boostPower: 0, draft: 0, mode: 'racing', invuln: 0, crash: null });
    };
    feel.stripStart = (w = 320, cols = 4) => {
      const h = Math.round((w * app.size.height) / app.size.width);
      feel.strip = { canvas: document.createElement('canvas'), w, h, cols, n: 0, max: 16 };
      feel.strip.canvas.width = w * cols;
      feel.strip.canvas.height = h * Math.ceil(feel.strip.max / cols);
    };
    feel.grab = () => {
      const st = feel.strip;
      if (!st || st.n >= st.max) return;
      const g = st.canvas.getContext('2d');
      const x = (st.n % st.cols) * st.w;
      const y = Math.floor(st.n / st.cols) * st.h;
      g.drawImage(app.canvas, x, y, st.w, st.h);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(x, y, 64, 16);
      g.fillStyle = '#fff';
      g.font = '12px monospace';
      g.fillText(`${feel.t.toFixed(2)}s`, x + 4, y + 12);
      st.n++;
    };
    feel.stripEnd = () => {
      const st = feel.strip;
      feel.strip = null;
      if (!st || st.n === 0) return null;
      const out = document.createElement('canvas');
      out.width = st.w * Math.min(st.cols, st.n);
      out.height = st.h * Math.ceil(st.n / st.cols);
      out.getContext('2d').drawImage(st.canvas, 0, 0);
      return out.toDataURL('image/png');
    };
  });
}

/** Page-side track patches for clean measurements (call after installFeel). */
export async function installPatches(page) {
  await page.evaluate(() => {
    const br = window.__br;
    const feel = window.__feel;
    /** opt: { kappa, flatSlope, slope, crestAt, crestSlope, crestWidth, wall } — null/undefined = untouched. */
    feel.patch = (opt) => {
      const tr = br.session().track;
      if (!feel.orig) feel.orig = { frameAt: tr.frameAt, bounds: tr.bounds, surfaceAt: tr.surfaceAt };
      const o = feel.orig;
      tr.frameAt = (s, out) => {
        const f = o.frameAt.call(tr, s, out);
        if (opt.kappa !== undefined && opt.kappa !== null) f.curvature = opt.kappa;
        if (opt.flatSlope) f.slope = 0;
        if (opt.slope !== undefined && opt.slope !== null) f.slope = opt.slope;
        if (opt.crestAt !== undefined && opt.crestAt !== null) {
          const d = s - opt.crestAt;
          f.slope = opt.crestSlope * Math.max(-1, Math.min(1, -d / (opt.crestWidth ?? 2)));
        }
        return f;
      };
      if (opt.wall) {
        tr.bounds = () => ({ halfWidth: opt.wall, left: opt.wall, right: opt.wall, leftKind: 'wall', rightKind: 'wall' });
        tr.surfaceAt = (s, x) => (Math.abs(x) <= opt.wall ? 'road' : 'wall');
      } else {
        tr.bounds = o.bounds;
        tr.surfaceAt = o.surfaceAt;
      }
    };
    feel.unpatch = () => {
      const tr = br.session().track;
      if (!feel.orig) return;
      Object.assign(tr, feel.orig);
    };
    feel.addFeature = (f) => br.session().track.features.push(f);
    feel.clearFeatures = () => { br.session().track.features.length = 0; };
    feel.addObstacle = (o) => br.session().obstacles.push({ active: true, solid: true, height: 1.6, ...o });
    feel.clearObstacles = () => { br.session().obstacles.length = 0; };
  });
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 1));
}

export function writeCsv(file, rows) {
  if (!rows.length) return;
  ensureDir(path.dirname(file));
  const keys = Object.keys(rows[0]);
  const fmt = (v) => (typeof v === 'number' ? +v.toFixed(5) : v);
  fs.writeFileSync(file, [keys.join(','), ...rows.map((r) => keys.map((k) => fmt(r[k])).join(','))].join('\n'));
}

export function saveDataUrl(file, url) {
  if (!url) return null;
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  return file;
}

/** First time (relative to t0) the series crosses `level` going up (or down if the level is below the start). */
export function crossTime(rows, key, level, t0 = 0) {
  const start = rows.find((r) => r.t >= t0);
  if (!start) return null;
  const up = level >= start[key];
  for (const r of rows) {
    if (r.t < t0) continue;
    if (up ? r[key] >= level : r[key] <= level) return +(r.t - t0).toFixed(4);
  }
  return null;
}

export const maxOf = (rows, key, f = () => true) => rows.filter(f).reduce((m, r) => Math.max(m, r[key]), -Infinity);
export const minOf = (rows, key, f = () => true) => rows.filter(f).reduce((m, r) => Math.min(m, r[key]), Infinity);

/** RMS of the second difference of a series (jitter): smooth motion → ~0, frame-to-frame wobble → large. */
export function jitter(rows, key) {
  let sum = 0;
  let n = 0;
  for (let i = 2; i < rows.length; i++) {
    const d2 = rows[i][key] - 2 * rows[i - 1][key] + rows[i - 2][key];
    sum += d2 * d2;
    n++;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

export const r3 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? v : +v.toFixed(3));
