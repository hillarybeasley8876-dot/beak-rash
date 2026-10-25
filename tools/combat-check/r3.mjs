// Polish round 3 regressions (run in the page; see page.mjs): the SP economy (swing / skill / KO pay, one full
// swing per rival per 4 s, nothing from SHOWTIME or for 12 s after it), RiderState.ultTarget, and a SHOWTIME that
// never flies back or lets anyone pass it. Rider ids: 1 goose, 2 cat, 3 capybara, 4 shiba.
export const r3 = [
  ['r3 SP: a swing pays 2.5 once per 4 s per rival (0.5 between), a skill hit 1, a KO 10; nothing for 12 s after SHOWTIME', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ crit: false, block: false, loose: false });
    const gain = (fn, frames) => { const sp0 = p.sp, s0 = cc.stylePaid().total; fn(); cc.step(frames); return +(p.sp - sp0 - (cc.stylePaid().total - s0)).toFixed(2); };
    const swing = (side) => gain(() => { cc.press(side); cc.step(1); }, 100); // 1.7 s apart: no combos
    c.pin(3, 0.2, 1.2); c.pin(2, 0.2, -1.2); cc.step(2);
    const first = swing('attackR'), again = swing('attackR'), other = swing('attackL');
    cc.step(60);
    const fresh = swing('attackR'); // > 4 s after the first
    c.pin(3, -80, 0); c.pin(2, -80, 0); c.pin(1, 20, 0); cc.step(2);
    const torpedo = gain(() => { cc.press('skill1'); cc.step(1); cc.until(() => cc.of('skill:hit', (e) => e.skillId === 'pelican.torpedo').length > 0, 120); }, 1);
    c.pin(1, -80, 0); c.pin(4, 0.2, 1.2); cc.step(2); cc.R(4).hp = 3;
    const ko = gain(() => { cc.press('attackR'); cc.step(1); cc.until(() => cc.of('combat:ko').length > 0, 60); }, 2);
    c.pin(4, -80, 0); c.pin(3, 14, 1.6); c.pin(2, 22, -1.6); cc.step(2); cc.mark();
    const ultStyle0 = cc.stylePaid().total;
    p.sp = 100; cc.press('ult'); cc.step(1);
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 600);
    const ult = +(p.sp - (cc.stylePaid().total - ultStyle0)).toFixed(2);
    c.pin(3, 0.2, 1.2); c.pin(2, -80, 0); cc.step(2);
    const locked = swing('attackR');
    cc.step(600);
    const back = swing('attackR');
    const info = { first, again, other, fresh, torpedo, ko, ult, locked, back };
    const near = (v, want) => v >= want - 1e-6 && v < want + 0.3; // drafting may add a trickle
    return { ok: near(first, 2.5) && near(again, 0.5) && near(other, 2.5) && near(fresh, 2.5) && near(torpedo, 1) && near(ko, 12.5) &&
      ult < 0.3 && near(locked, 0) && near(back, 2.5), info };
  }],
  ['r3 ultTarget mirrors the SHOWTIME check: false (a press is denied 无目标) with nobody in reach, true with a rival 20 m ahead; rivals false', () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C(); const p = cc.P();
    cc.step(2);
    const none = p.ultTarget;
    p.sp = 100; cc.press('ult'); cc.step(2);
    const denied = cc.of('skill:denied', (e) => e.riderId === 0 && e.slot === 4)[0]?.reason, line = cc.of('taunt', (e) => e.riderId === 0)[0]?.text;
    c.pin(1, 20, 1.6); cc.step(2);
    const some = p.ultTarget, rivals = cc.S().riders.filter((r) => !r.isPlayer).every((r) => r.ultTarget === false);
    const L = cc.S().track.length, home = p.s;
    c.pin(1, 5, 1.6); br.teleport(0, L - 12, 0); c.set(0, { speed: 20 }); cc.step(1); // a rival ahead, the dive past the line
    const nearLine = p.ultTarget;
    br.teleport(0, home, 0); c.pin(1, 20, 1.6); cc.step(2); cc.mark();
    cc.press('ult'); cc.step(2);
    const cast = cc.of('ult:start').length;
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 600);
    const info = { none, denied, line, some, rivals, nearLine, cast };
    return { ok: none === false && denied === 'state' && line === '无目标！' && some === true && rivals && nearLine === false && cast === 1, info };
  }],
  ['r3 SHOWTIME never flies back: pack 8-26 m behind → s ≥ s0 + v0·t, riders within 20 m hit, a boosted rider behind never passes', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    cc.ctl({ throttle: 1 }); cc.step(60);
    [[1, -8, 1.6], [2, -14, -1.6], [3, -26, 0], [4, -2, 0.6]].forEach(([id, ds, dx]) => c.pin(id, ds, dx));
    cc.step(2); c.unpin();
    const b = cc.R(4);
    Object.assign(b, { boostTime: 2.5, boostPower: 0.4, speed: p.speed + 6 });
    cc.mark(); p.sp = 100;
    const s0 = p.s, v0 = p.speed, t0 = cc.S().time;
    cc.press('ult'); cc.step(1);
    let lag = Infinity, ahead = 0, worst = p.place;
    cc.until(() => {
      lag = Math.min(lag, p.s - s0 - v0 * (cc.S().time - t0));
      if (b.s > p.s) ahead++;
      worst = Math.max(worst, p.place);
      return cc.of('ult:impact').length > 0;
    }, 600);
    const victims = cc.of('ult:impact')[0]?.victims ?? [];
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 300);
    const info = { lag: +lag.toFixed(2), ahead, worst, victims };
    return { ok: lag >= -0.05 && ahead === 0 && worst === 1 && [1, 2, 4].every((id) => victims.includes(id)) && !victims.includes(3), info };
  }],
];
