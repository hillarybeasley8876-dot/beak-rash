// Feel scenarios: camera hand-offs (override blend-out, KO / wrecked cinematics, respawn glide, race
// intro → GO) measured per frame: rotation step (deg), translation step, FOV step, deliberate cuts, and
// camera-to-rider clearance. Runs with every unit live (the KO director and race intro are real).

/** Page-side probe: step frames, sample the render camera against the previous frame. */
async function installProbe(page) {
  await page.evaluate(() => {
    const br = window.__br;
    const app = br.app;
    const V = app.camera.position.constructor;
    const Q = app.camera.quaternion.constructor;
    const pq = new Q(), pp = new V(), bp = new V(), bq = new Q();
    let has = false;
    let pf = 0;
    const probe = (n, ctl, dt = 1 / 60) => {
      const rows = [];
      for (let i = 0; i < n; i++) {
        br.setControls(ctl ? ctl(i) : { throttle: 1 });
        br.step(1, dt);
        const c = app.camera;
        const ses = br.session();
        ses.physics.pose(ses.player, bp, bq);
        bp.y += 0.9;
        rows.push({
          i, rot: has ? 2 * Math.acos(Math.min(1, Math.abs(pq.dot(c.quaternion)))) * 57.29578 : 0,
          move: has ? c.position.distanceTo(pp) : 0, fovStep: has ? Math.abs(c.fov - pf) : 0,
          dRider: c.position.distanceTo(bp), mode: app.rig.mode, blending: br.sim.cam.blending === true,
          cuts: Number(br.sim.cam.cuts ?? 0), rmode: ses.player.mode, phase: ses.phase,
        });
        pq.copy(c.quaternion); pp.copy(c.position); pf = c.fov; has = true;
      }
      return rows;
    };
    probe.reset = () => { has = false; };
    window.__camProbe = probe;
  });
}

/** Rotation/translation analysis of a hand-off window; cut frames (rig counted a cut) are excluded. */
function analyse(rows, from = 0, to = rows.length) {
  const w = rows.slice(Math.max(0, from), to);
  const cutAt = new Set();
  for (let i = 1; i < w.length; i++) if (w[i].cuts > w[i - 1].cuts) cutAt.add(i);
  let maxRot = 0, pop = 0, maxMove = 0, minDist = 99;
  for (let i = 1; i < w.length - 1; i++) {
    if (cutAt.has(i)) continue;
    const r = w[i].rot;
    maxRot = Math.max(maxRot, r);
    maxMove = Math.max(maxMove, w[i].move);
    const nb = Math.max(w[i - 1].rot, w[i + 1].rot, 0.5);
    if (!cutAt.has(i - 1) && !cutAt.has(i + 1)) pop = Math.max(pop, r / nb);
    if (w[i].blending) minDist = Math.min(minDist, w[i].dRider);
  }
  const r3 = (v) => +v.toFixed(3);
  return { cuts: cutAt.size, maxRotDeg: r3(maxRot), rotPopRatio: r3(pop), maxMove: r3(maxMove), minBlendDist: r3(minDist), blendFrames: w.filter((r) => r.blending).length };
}

/** Override posed relative to the player: azimuth `az` (deg, 0 = behind), radius, height, looking at it. */
function overrideAt(page, az, radius, height, hold = 0.5) {
  return page.evaluate(([az, radius, height, hold]) => {
    const br = window.__br;
    const ses = br.session();
    const V = br.app.camera.position.constructor;
    const look = new V();
    let t = 0;
    br.app.rig.override((cam, dt) => {
      t += dt;
      const p = ses.player;
      const a = (az * Math.PI) / 180;
      ses.track.toWorld(p.s - Math.cos(a) * radius, p.x - Math.sin(a) * radius, height, cam.position);
      ses.track.toWorld(p.s, p.x, 0.9, look);
      cam.lookAt(look);
      return t < hold;
    }, 0.35);
  }, [az, radius, height, hold]);
}

const handoff = {
  name: 'handoff',
  stub: '',
  async run({ page, h }) {
    await installProbe(page);
    const m = {};
    const setup = (s) => page.evaluate((s) => {
      const f = window.__feel; const ses = window.__br.session();
      ses.obstacles.length = 0;
      for (const r of ses.riders) if (!r.isPlayer) f.place(r.id, 3000 - r.id * 20, 0, 0);
      f.place(ses.player.id, s, -1.5, 19);
      ses.player.hp = ses.player.maxHp;
      window.__camProbe(30);
      window.__camProbe.reset();
    }, s);
    const probe = (n) => page.evaluate((n) => window.__camProbe(n), n);
    for (const [tag, az] of [['back', 175], ['side', 60]]) {
      await setup(400);
      await overrideAt(page, az, 4.5, 1.4);
      const a = analyse(await probe(80), 28);
      for (const [k, v] of Object.entries(a)) m[`${tag}_${k}`] = v;
    }
    for (const [tag, victim, attacker] of [['ko', 1, 0], ['wrecked', 0, 1]]) {
      await setup(400);
      await page.evaluate(() => window.__feel.place(1, 401, 1.2, 19));
      await page.evaluate(([v, a]) => window.__br.ko(v, a), [victim, attacker]);
      const rows = await probe(240);
      // The cut INTO the cinematic is the director's; measure the hand-back (last cinematic frame on).
      let last = -1;
      rows.forEach((r, i) => { if (r.mode === 'cinematic') last = i; });
      const a = analyse(rows, last - 4, last + 45);
      m[`${tag}_handbackFrame`] = last;
      for (const [k, v] of Object.entries(a)) m[`${tag}_${k}`] = v;
    }
    await setup(500);
    await page.evaluate(() => { const ses = window.__br.session(); ses.physics.crash(ses.player, 'traffic', null); });
    const rs = analyse(await probe(260));
    for (const [k, v] of Object.entries(rs)) m[`respawn_${k}`] = v;
    // Race intro flyover → GO: record from the grid until 1.5 s after the race starts.
    await h.goto('/?race=coast&seed=1&rivals=pigeon&traffic=0&police=0&manual=1');
    await installProbe(page);
    const rows = [];
    for (let k = 0; k < 60; k++) {
      const chunk = await probe(60);
      rows.push(...chunk);
      const go = rows.findIndex((r) => r.phase === 'racing');
      if (go >= 0 && rows.length - go > 90) break;
    }
    const hand = rows.findIndex((r, i) => i > 0 && rows[i - 1].mode === 'cinematic' && r.mode !== 'cinematic');
    const it = analyse(rows, Math.max(0, hand - 5));
    for (const [k, v] of Object.entries(it)) m[`intro_${k}`] = v;
    m.intro_handoffFrame = hand;
    return { metrics: m };
  },
};

export const HANDOFF = [handoff];
