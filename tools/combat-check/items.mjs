// KO pipeline, weapons and pickups scenarios (run in the page).
export const items = [
  ['KO fires exactly once, credits the attacker, respawn at 70 % HP', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.pin(3, 0.2, 1.2); cc.step(2);
    const p = cc.P(), v = cc.R(3);
    v.hp = 5;
    const k0 = p.kos, coins0 = p.coins, sp0 = p.sp, w0 = v.wrecked;
    cc.press('attackR'); cc.step(1); cc.step(20);
    const kos = cc.of('combat:ko'), ko = kos[0], crashed = v.mode;
    c.unpin(3);
    const back = cc.until(() => v.mode === 'racing', 900);
    cc.step(30);
    const again = cc.of('combat:ko').length;
    return { ok: kos.length === 1 && ko.attacker === 0 && ko.victim === 3 && ko.cause === 'ko' && p.kos === k0 + 1 && p.coins === coins0 + 50 &&
      p.sp - sp0 >= 2.5 + 10 - 1e-6 && p.sp - sp0 < 2.5 + 10 + 1 && v.wrecked === w0 + 1 && crashed === 'crashed' && back >= 0 && again === 1 && Math.abs(v.hp - Math.round(v.maxHp * 0.7)) <= 1,
      info: { kos: kos.length, ko, crashed, back, hp: v.hp, max: v.maxHp, again } };
  }],
  ['debug ko() and a wall crash after a hit are credited once', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    window.__br.ko(2, 0); cc.step(3);
    const dbg = cc.of('combat:ko', (k) => k.victim === 2);
    c.pin(1, 0.2, 1.2); cc.step(2);
    cc.press('attackR'); cc.until(() => cc.of('combat:hit', (h) => h.victim === 1).length > 0, 600);
    c.unpin(1);
    cc.S().physics.crash(cc.R(1), 'wall', null); cc.step(3);
    const wall = cc.of('combat:ko', (k) => k.victim === 1);
    return { ok: dbg.length === 1 && dbg[0].attacker === 0 && wall.length === 1 && wall[0].attacker === 0 && wall[0].cause === 'wall',
      info: { dbg, wall } };
  }],
  ['knock-loose: unarmed attacker steals, armed attacker drops it on the road', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: true });
    c.give(1, 'pan'); c.pin(1, 0.2, 1.2); cc.step(2);
    cc.press('attackR'); cc.step(1); cc.step(30);
    const pick = cc.of('combat:weaponPick')[0], mine = cc.P().weapon, theirs = cc.R(1).weapon;
    c.give(0, 'baguette'); c.give(1, 'leek'); cc.step(2); cc.mark();
    cc.press('attackR'); cc.step(1); cc.step(4);
    const drop = cc.of('combat:weaponDrop')[0];
    const flying = c.items().find((it) => it.kind === 'weapon' && it.weapon === 'leek');
    cc.step(60);
    const landed = c.items().find((it) => it.kind === 'weapon' && it.weapon === 'leek');
    return { ok: pick?.stolenFrom === 1 && pick.weapon === 'pan' && mine === 'pan' && theirs === 'none' && drop?.weapon === 'leek' &&
      cc.P().weapon === 'baguette' && cc.R(1).weapon === 'none' && !!flying && !!landed && Math.abs(landed.y - 0.95) < 0.05,
      info: { pick, mine, theirs, drop, flyingY: flying?.y, landedY: landed?.y } };
  }],
  ['weapons break after their uses; pans block; blocked hits deal 0', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.give(0, 'slipper'); c.pin(3, 0.2, 1.2); cc.step(2);
    const after = [];
    for (let i = 0; i < 3; i++) { cc.R(3).hp = cc.R(3).maxHp; cc.press('attackR'); cc.step(1); cc.step(40); after.push(cc.P().weapon); }
    const hits = cc.of('combat:hit', (h) => h.attacker === 0).length;
    c.give(3, 'pan'); c.force({ crit: false, block: true, loose: false }); cc.step(2); cc.mark();
    const hp0 = cc.R(3).hp;
    cc.press('attackR'); cc.step(1); cc.step(40);
    const blocked = cc.of('combat:hit')[0];
    return { ok: hits === 3 && after[0] === 'slipper' && after[1] === 'slipper' && after[2] === 'none' && blocked?.blocked === true && blocked.damage === 0 && cc.R(3).hp === hp0,
      info: { after, hits, blocked } };
  }],
  ['pickups: coin, fish (+HP), can (+SP), crate (weapon), road weapon', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    cc.ctl({ throttle: 1 }); cc.step(30);
    p.hp = 50; p.sp = 10;
    const coins0 = p.coins;
    c.spawn('coin', p.s + 8, p.x); c.spawn('fish', p.s + 14, p.x); c.spawn('can', p.s + 20, p.x); c.spawn('crate', p.s + 26, p.x);
    cc.until(() => cc.of('pickup:take').length >= 4, 240);
    const takes = cc.of('pickup:take').map((e) => e.kind), picks = cc.of('combat:weaponPick');
    const res = { coins: p.coins - coins0, hp: p.hp, sp: Math.round(p.sp), weapon: p.weapon, x: +p.x.toFixed(2) };
    c.give(0, 'none'); cc.mark();
    c.spawn('weapon', p.s + 10, p.x, 'umbrella');
    cc.until(() => cc.of('pickup:take').length >= 1, 120);
    return { ok: takes.join() === 'coin,fish,can,crate' && res.coins === 5 && res.hp === 75 && res.sp >= 30 && res.weapon !== 'none' &&
      picks[0]?.stolenFrom === null && p.weapon === 'umbrella', info: { takes, res, now: p.weapon } };
  }],
];
