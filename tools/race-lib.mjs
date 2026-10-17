// Shared in-page helpers for the race unit's scenario/soak tools: an event recorder and a human-like
// player controller (throttle + PID lane keeping + traffic dodge; 'brawler' also swings and fires skills).

/** In-page: record race-relevant bus events into window.__rl.log ({ t, p, time }). */
export const RECORD = `(() => {
  const br = window.__br, bus = br.app.bus;
  const log = []; window.__rl = { log };
  const T = ['race:intro','race:countdown','race:start','race:placeChange','race:finishLine','race:end','race:finalStretch',
    'police:alert','police:busted','traffic:honk','taunt','rider:boost','rider:crash','rider:respawn','combat:hit','combat:ko',
    'skill:cast','combat:bell','combat:swing'];
  for (const t of T) bus.on(t, (p) => log.push({ t, p: JSON.parse(JSON.stringify(p)), time: +(br.session()?.time ?? 0).toFixed(3) }));
  bus.on('race:end', (p) => { window.__rl.end = p.results; });
})()`;

/** In-page: window.__mkHuman(mode) → tick(dt) that writes the player's controls. */
export const HUMAN = `window.__mkHuman = (mode) => {
  const br = window.__br, s = br.session(), p = s.player, tr = s.track;
  const st = { int: 0, atkCd: 0, skCd: 0, steer: 0 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return (dt) => {
    const hw = tr.bounds(Math.min(p.s, tr.length)).halfWidth;
    let tx = 0;
    for (const o of s.obstacles) {
      if (!o.active || !o.solid) continue;
      const ds = o.s - p.s, rel = p.speed - o.speed;
      if (ds < -o.halfLength - 1.5 || ds > 55 || (rel < 1 && ds > 4)) continue;
      const clear = o.halfWidth + 1.4;
      if (Math.abs(tx - o.x) < clear) { const l = o.x - clear, r = o.x + clear; tx = Math.abs(l) < Math.abs(r) ? l : r; }
    }
    tx = clamp(tx, -hw + 1, hw - 1);
    const err = tx - p.x;
    st.int = clamp(st.int + err * dt, -4, 4);
    const want = clamp(0.45 * err + 0.35 * st.int - 0.1 * p.vx, -1, 1);
    st.steer += (want - st.steer) * Math.min(1, dt * 14);
    const c = { throttle: 1, steer: st.steer };
    st.atkCd -= dt; st.skCd -= dt;
    if (mode === 'brawler' && p.mode === 'racing') {
      for (const r of s.riders) {
        if (r === p || r.mode !== 'racing') continue;
        const ds = r.s - p.s, dx = r.x - p.x;
        if (Math.abs(ds) < 1.3 && Math.abs(dx) > 0.5 && Math.abs(dx) < 1.25 && st.atkCd <= 0) {
          if (dx > 0) c.attackR = true; else c.attackL = true; st.atkCd = 0.4;
        }
        if (ds > 6 && ds < 45 && Math.abs(dx) < 3 && st.skCd <= 0 && p.cooldowns[0] <= 0) { c.skill1 = true; st.skCd = 1; }
      }
      if (p.sp >= 100 && st.skCd <= 0) { c.ult = true; st.skCd = 1; }
    }
    br.setControls(c);
  };
};`;

/**
 * In-page: window.__runHuman(frames, dt, every, mode) steps the race with the human controller and
 * returns samples every `every` frames (time, player state, leader gap, police mode, heat).
 */
export const RUN = `window.__runHuman = (frames, dt, every, mode) => {
  const br = window.__br; const tick = window.__humanTick ??= window.__mkHuman(mode);
  const out = [];
  for (let i = 0; i < frames; i++) {
    tick(dt); br.step(1, dt);
    if (i % every === 0) {
      const s = br.session(); if (!s) break; const p = s.player;
      const racing = s.riders.filter((r) => r.finishTime === null);
      const lead = Math.max(...s.riders.map((r) => r.s));
      const last = racing.length ? Math.min(...racing.map((r) => r.s)) : p.s;
      out.push({ t: +s.time.toFixed(2), ps: +p.s.toFixed(1), v: +p.speed.toFixed(1), place: p.place, mode: p.mode,
        hp: Math.round(p.hp), gapLead: +(lead - p.s).toFixed(0), spread: +(lead - last).toFixed(0), phase: s.phase,
        police: br.race?.police() ?? null, heat: +p.heat.toFixed(2) });
    }
    if (window.__rl?.end) break;
  }
  return out;
};`;

/** Load a race page with the recorder and the human controller installed. */
export async function openRace(h, query) {
  await h.goto(`/?${query}`);
  await h.eval(RECORD);
  await h.eval(HUMAN);
  await h.eval(RUN);
}

export const events = (h, t) => h.eval(`window.__rl.log.filter((e) => e.t === '${t}')`);
export const median = (xs) => { const v = xs.slice().sort((p, q) => p - q); return v[Math.floor(v.length / 2)] ?? 0; };
