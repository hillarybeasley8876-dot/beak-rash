// Acceptance round 1 regressions (run in the page; see page.mjs): SHOWTIME target assist, the SHOWTIME press held
// through a KO cinematic or a hop, skill presses queued behind another skill. Rider ids: 1 goose, 2 cat, 3 capybara.
export const acc1 = [
  ['SHOWTIME target assist: nobody in reach → denied with 无目标 (SP kept); a lone rival 90 m ahead is dived on', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    p.sp = 100; cc.press('ult'); cc.step(2);
    const none = { denied: cc.of('skill:denied', (e) => e.riderId === 0 && e.slot === 4)[0]?.reason,
      line: cc.of('taunt', (e) => e.riderId === 0)[0]?.text, sp: p.sp, starts: cc.of('ult:start').length };
    const g = cc.R(1);
    c.pin(1, 90, 1.6); cc.step(2); c.unpin(1); cc.mark();
    const s0 = p.s;
    p.sp = 100; cc.press('ult'); cc.step(1);
    const f = cc.until(() => cc.of('ult:impact').length > 0, 600);
    const imp = cc.of('ult:impact')[0], land = { gap: g.s - p.s, dx: Math.abs(g.x - p.x), travel: p.s - s0 };
    cc.step(90);
    const info = { none, f, victims: imp?.victims, land };
    return { ok: none.denied === 'state' && none.line === '无目标！' && none.sp === 100 && none.starts === 0 && f > 0 &&
      !!imp?.victims.includes(1) && land.gap > 1.5 && land.gap < 4 && land.travel > 80, info };
  }],
  ['SHOWTIME target assist: lands on the pack 70-90 m ahead (all three hit); a rival 25 m behind is out of reach (never flies back)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const ult = () => {
      cc.mark(); p.sp = 100; cc.press('ult'); cc.step(1);
      cc.until(() => cc.of('ult:impact').length > 0, 600);
      const imp = cc.of('ult:impact')[0];
      cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 300);
      return imp?.victims ?? [];
    };
    [[1, 70, -1.6], [2, 78, 1.6], [3, 90, 0]].forEach(([id, ds, dx]) => c.pin(id, ds, dx));
    cc.step(2); c.unpin();
    const pack = ult();
    cc.reset();
    c.pin(1, -25, 1.6); cc.step(2); c.unpin(1);
    const target = p.ultTarget;
    cc.mark(); p.sp = 100; cc.press('ult'); cc.step(2);
    const back = { target, denied: cc.of('skill:denied', (e) => e.riderId === 0 && e.slot === 4)[0]?.reason, starts: cc.of('ult:start').length, sp: p.sp };
    const info = { pack, back };
    return { ok: [1, 2, 3].every((id) => pack.includes(id)) && !back.target && back.denied === 'state' && back.starts === 0 && back.sp === 100, info };
  }],
  ['SHOWTIME near the line: a rival that will have finished by the impact is no target (denied)', () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C(); const p = cc.P();
    const L = cc.S().track.length, home = p.s;
    br.teleport(0, L - 30, 0); c.set(0, { speed: 20 }); c.pin(1, 12, 1.6); cc.step(2); cc.mark();
    p.sp = 100; cc.press('ult'); cc.step(2);
    const denied = cc.of('skill:denied', (e) => e.riderId === 0 && e.slot === 4)[0]?.reason, starts = cc.of('ult:start').length;
    br.teleport(0, home, 0); c.pin(1, -60, 0); cc.step(2);
    return { ok: denied === 'state' && starts === 0 && p.sp === 100, info: { denied, starts, sp: p.sp } };
  }],
  ['SHOWTIME pressed during a KO cinematic waits for its end (no denial), or casts after the 3 s latch cap', () => {
    const cc = window.__cc, br = window.__br; cc.reset(); const c = cc.C(); const p = cc.P();
    const cine = (phase) => br.app.bus.emit('cine:ko', { phase, attacker: 0, victim: 2, chain: 1 });
    c.pin(1, 15, 1.6); cc.step(2); c.unpin(1); cc.mark();
    cine('start'); p.sp = 100; cc.press('ult'); cc.step(40);
    const during = { starts: cc.of('ult:start').length, denied: cc.of('skill:denied').length, sp: p.sp - cc.stylePaid().sp };
    cine('end'); cc.step(2);
    const after = cc.of('ult:start').length;
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 300);
    c.pin(1, 15, 1.6); cc.step(2); c.unpin(1); cc.mark();
    cine('start'); p.sp = 100; cc.press('ult'); cc.step(150);
    const held = cc.of('ult:start').length;
    cc.step(60);
    const capped = cc.of('ult:start').length;
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 300);
    cine('end');
    const info = { during, after, held, capped };
    return { ok: during.starts === 0 && during.denied === 0 && during.sp === 100 && after === 1 && held === 0 && capped === 1, info };
  }],
  ['a skill pressed late in another queues (wing 0.67 s into Big Gulp casts as the pouch shuts); an early press is denied at once', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    cc.press('skill2'); cc.step(1);
    const g0 = cc.ev.find((e) => e.t === 'skill:cast' && e.p.slot === 2)?.f ?? -1;
    cc.step(40); cc.press('skill3'); cc.step(1);
    const quiet = cc.of('skill:denied').length;
    cc.until(() => cc.of('skill:cast', (e) => e.slot === 3).length > 0, 120);
    const w0 = cc.ev.find((e) => e.t === 'skill:cast' && e.p.slot === 3)?.f ?? -1;
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.wing').length > 0, 300);
    c.resetCooldowns(); cc.mark();
    cc.press('skill2'); cc.step(18); cc.press('skill3'); cc.step(1);
    const early = cc.of('skill:denied', (e) => e.slot === 3)[0]?.reason;
    cc.step(80);
    const late = cc.of('skill:cast', (e) => e.slot === 3).length;
    const info = { quiet, gap: (w0 - g0) / 60, early, late };
    return { ok: g0 >= 0 && quiet === 0 && info.gap > 1.1 && info.gap < 1.3 && early === 'state' && late === 0, info };
  }],
  ['SHOWTIME pressed in a hop fires on landing instead of being denied', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.pin(1, 15, 1.6); cc.step(2); c.unpin(1); cc.mark();
    p.sp = 100; cc.press('hop'); cc.step(6);
    const air = p.airborne;
    cc.press('ult'); cc.step(1);
    const quiet = cc.of('skill:denied').length + cc.of('ult:start').length;
    const f = cc.until(() => cc.of('ult:start').length > 0, 60);
    cc.until(() => cc.of('skill:end', (e) => e.skillId === 'pelican.ult').length > 0, 300);
    return { ok: air && quiet === 0 && f > 0 && cc.of('skill:denied').length === 0, info: { air, quiet, f } };
  }],
];
