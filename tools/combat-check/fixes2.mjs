// Fix round 1 regressions, part 2: melee fairness, skill buffer, weapons, vacuum, whistle, boost stacking.
export const fixes2 = [
  ['a swing whiffs if the attacker is stunned mid-windup; same-substep swings trade', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.pin(1, 0.2, 1.2); cc.step(2);
    c.swing(1, -1); cc.step(1); c.status(1, 'stun', 1); cc.step(40);
    const stunnedHits = cc.of('combat:hit', (h) => h.attacker === 1).length;
    cc.R(1).statuses.length = 0; cc.step(30); cc.mark();
    const a = c.swing(0, 1), b = c.swing(1, -1); cc.step(40);
    const mine = cc.of('combat:hit', (h) => h.attacker === 0 && h.victim === 1).length;
    const theirs = cc.of('combat:hit', (h) => h.attacker === 1 && h.victim === 0).length;
    return { ok: stunnedHits === 0 && a && b && mine === 1 && theirs === 1, info: { stunnedHits, a, b, mine, theirs } };
  }],
  ['a skill pressed during a hit stagger is buffered and fires when it ends (no denial)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ crit: false, block: false, loose: false });
    c.pin(1, 0.2, 1.2); cc.step(2);
    c.swing(1, -1);
    cc.until(() => cc.of('combat:hit', (h) => h.victim === 0).length > 0, 60);
    const staggered = p.action?.kind === 'hit';
    cc.press('skill1'); cc.step(1);
    const early = cc.of('skill:cast').length + cc.of('skill:denied').length;
    cc.until(() => cc.of('skill:cast').length > 0, 40);
    const cast = cc.of('skill:cast')[0], denied = cc.of('skill:denied').length;
    return { ok: staggered && early === 0 && cast?.skillId === 'pelican.torpedo' && denied === 0, info: { staggered, early, cast, denied } };
  }],
  ['no forced downgrades: armed riders skip crates; an armed biter knocks the weapon onto the road', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.give(0, 'slipper'); cc.ctl({ throttle: 1 }); cc.step(10);
    c.spawn('crate', p.s + 8, p.x); cc.step(60);
    const crate = cc.of('pickup:take').length, kept = p.weapon;
    c.give(3, 'leek'); c.pin(3, 0.8, 1.2); cc.step(2);
    cc.press('skill2'); cc.step(1); cc.step(20);
    const bite = cc.of('combat:hit', (h) => h.skillId === 'pelican.gulp' && h.victim === 3)[0];
    const drop = cc.of('combat:weaponDrop', (e) => e.riderId === 3)[0];
    return { ok: crate === 0 && kept === 'slipper' && bite?.damage === 12 && p.weapon === 'slipper' && cc.R(3).weapon === 'none' && drop?.weapon === 'leek',
      info: { crate, kept, bite: bite?.damage, mine: p.weapon, drop } };
  }],
  ['Big Gulp vacuum: refused items stay put, stray items go home, no pull from afar on the next gulp', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.give(0, 'pan'); cc.ctl({ throttle: 1 }); cc.step(20);
    const kb = c.spawn('weapon', p.s + 2, p.x + 1.5, 'keyboard');
    const k0 = c.items().find((it) => it.id === kb);
    cc.press('skill2'); cc.step(1); cc.step(69);
    const late = c.spawn('coin', p.s + 3, p.x + 2), c0 = c.items().find((it) => it.id === late);
    let pulled = false;
    cc.until(() => {
      const it = c.items().find((i) => i.id === late);
      pulled = pulled || (!!it && (Math.abs(it.s - c0.s) > 0.05 || Math.abs(it.x - c0.x) > 0.05));
      return c.running().length === 0;
    }, 120);
    const k1 = c.items().find((it) => it.id === kb), coin = c.items().find((it) => it.id === late);
    const home = !!coin && coin.alive && Math.abs(coin.s - c0.s) < 0.01 && Math.abs(coin.x - c0.x) < 0.01;
    c.resetCooldowns(0); cc.step(120);
    cc.press('skill2'); cc.step(1); cc.until(() => c.running().length === 0, 200);
    const taken = cc.of('pickup:take').length, k2 = c.items().find((it) => it.id === kb);
    return { ok: !!k1 && Math.abs(k1.s - k0.s) < 0.01 && Math.abs(k1.x - k0.x) < 0.01 && pulled && home && taken === 0 &&
      Math.abs(k2.s - k0.s) < 0.01, info: { k0, k1, pulled, coin, c0, taken, k2 } };
  }],
  // r7 (SPEC §29): the whistle warns everyone in its cone (slow 25 %) and fines the offenders (slow 50 %)
  ['whistle warns everyone ahead (slow 25 %) and fines offenders (slow 50 %)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const slowOf = () => Math.max(0, ...p.statuses.filter((q) => q.id === 'slow' && q.time > 0).map((q) => q.strength));
    c.pin(9, -8, 0); cc.step(2); p.heat = 0; c.cast(9, 1); cc.step(3);
    const warned = slowOf();
    c.resetCooldowns(9); cc.step(100); p.heat = 0.6; c.cast(9, 1); cc.step(3);
    const fined = slowOf();
    return { ok: Math.abs(warned - 0.25) < 0.01 && Math.abs(fined - 0.5) < 0.01, info: { warned, fined } };
  }],
  ['the bell cannot ring a hit stagger away; SHOWTIME executes riders it leaves at <= 20 % HP', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ crit: false, block: false, loose: false });
    c.pin(1, 0.2, 1.2); cc.step(2); c.swing(1, -1);
    cc.until(() => p.action?.kind === 'hit', 60);
    cc.press('bell'); cc.step(1);
    const kept = p.action?.kind, bells = cc.of('combat:bell').length;
    c.pin(1, 15, 1); cc.step(60);
    const v = cc.R(5); c.pin(5, 10, -1); cc.step(2); v.hp = Math.floor(v.maxHp * 0.2) + 45; p.sp = 100; cc.mark();
    cc.press('ult'); cc.step(1); cc.until(() => cc.of('ult:impact').length > 0, 600); cc.step(10);
    const ko = cc.of('combat:ko', (k) => k.victim === 5)[0], full = cc.of('combat:ko', (k) => k.victim === 1).length;
    const style = cc.stylePaid();   // the r4 STYLE chain pays a bonus on top of the r3 economy
    return { ok: kept === 'hit' && bells === 0 && ko?.attacker === 0 && ko.skillId === 'pelican.ult' && full === 0 && p.sp - style.sp < 1,
      info: { kept, bells, ko, full, sp: p.sp, style } };
  }],
  ['skill boosts keep their own clock: a short drift boost under DOGE ends on time', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    c.pin(4, 6, 2); cc.step(2);
    const v = cc.R(4);
    v.boostTime = 0.25; v.boostPower = 0.35; c.cast(4, 1); cc.step(2);
    const overlap = cc.topMul(v);
    cc.step(30);
    const after = cc.topMul(v);
    return { ok: Math.abs(overlap - 1.35) < 0.01 && v.boostTime <= 0.15 && Math.abs(after - 1.15) < 0.01 && cc.has(v, 'boost'),
      info: { overlap, after, boostTime: v.boostTime } };
  }],
];
