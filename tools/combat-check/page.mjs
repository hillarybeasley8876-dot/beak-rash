// In-page helpers for tools/combat-check.mjs. `installHelpers` runs inside the browser (page.evaluate),
// so it may only use what exists there (window.__br). Everything lands on window.__cc.
export function installHelpers() {
  const br = window.__br;
  const EVENTS = [
    'combat:swing', 'combat:hit', 'combat:ko', 'combat:combo', 'combat:weaponDrop', 'combat:weaponPick',
    'skill:cast', 'skill:hit', 'skill:end', 'skill:denied', 'ult:start', 'ult:impact', 'pickup:take', 'taunt',
    'rider:crash', 'rider:respawn', 'hitstop', 'combat:bell', 'combat:weaponBreak', 'projectile:spawn', 'projectile:end',
    'rider:land', 'rider:boost', 'cam:shake', 'race:finishLine',
  ];
  const cc = {
    ev: [],
    offs: [],
    listen() {
      for (const off of cc.offs) off();
      cc.offs = EVENTS.map((t) => br.app.bus.on(t, (p) => cc.ev.push({ t, p: JSON.parse(JSON.stringify(p)), f: br.frames })));
    },
    mark() { cc.ev.length = 0; },
    of(t, pred) { return cc.ev.filter((e) => e.t === t && (!pred || pred(e.p))).map((e) => e.p); },
    S() { return br.session(); },
    P() { return br.session().player; },
    R(id) { return br.session().rider(id); },
    C() { return br.combat; },
    /** Lateral target the scripted player steers toward (null = hands off). */
    lane: 0,
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        const sc = br.app.input.scripted;
        const p = br.session().player;
        if (sc && cc.lane !== null) sc.steer = Math.max(-1, Math.min(1, (cc.lane - p.x) * 0.9 - p.vx * 0.12));
        br.step(1);
      }
    },
    ctl(c) { br.setControls({ throttle: 0.75, ...c }); },
    /** Latched edge press (survives hit-stop frames until a sim step consumes it). */
    press(action) { br.press(action); },
    /** Step until pred() or maxFrames; returns frames used (-1 on timeout). */
    until(pred, maxFrames = 600) {
      for (let i = 0; i < maxFrames; i++) {
        if (pred()) return i;
        cc.step(1);
      }
      return pred() ? maxFrames : -1;
    },
    has(r, id) { return r.statuses.some((st) => st.id === id && st.time > 0); },
    /** Effective top-speed multiplier: mods (skill boosts) × the shared physics boost (drift, pad, rubber band). */
    topMul(r) { return r.mods.speedMul * (1 + (r.boostTime > 0 ? r.boostPower : 0)); },
    /** Restart the race with the same URL config and ride until racing (after finish-line scenarios). */
    async restart() {
      await br.start({});
      cc.until(() => cc.S().phase === 'racing', 3000);
      cc.ctl({ throttle: 1 }); cc.step(60);
    },
    /** Fresh, deterministic state: everyone racing at full HP, rivals parked far behind (passive). */
    reset(keep = []) {
      const c = br.combat;
      const s = cc.S();
      c.unpin();
      for (const r of s.riders) if (!r.isPlayer) c.pin(r.id, -60 - r.id * 12, 0, true);
      cc.until(() => s.riders.every((r) => r.mode === 'racing') && c.counts().skills === 0, 900);
      c.unpin();
      c.force(null);
      c.resetCooldowns();
      c.clearItems();
      br.app.clock.clearScale('ko');
      br.app.clock.clearScale('ult');
      for (const r of s.riders) {
        Object.assign(r, { hp: r.maxHp, sp: 0, action: null, combo: 0, comboTimer: 0, lastHitBy: null, invuln: 0, heat: 0 });
        r.statuses.length = 0;
        c.give(r.id, 'none');
        if (!r.isPlayer && !keep.includes(r.id)) c.pin(r.id, -60 - r.id * 12, 0, true);
      }
      br.teleport(0, cc.P().s, 0);
      Object.assign(cc.P(), { vx: 0, yaw: 0 });
      cc.lane = 0;
      cc.ctl({});
      cc.step(3);
      cc.mark();
    },
  };
  window.__cc = cc;
  cc.listen();
  return true;
}
