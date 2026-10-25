// Fix round 2 regressions (run in the page; see page.mjs). Rider ids: 1 goose, 2 cat, 3 capybara, 4 shiba,
// 5 pigeon, 6 penguin, 7 seagull, 8 sloth, 9 corgi.
export const fixes3 = [
  ['bell: three rings at the same angry rival pay 3 SP once; a rival 10 m behind pays nothing', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const ring = () => { cc.press('bell'); cc.step(1); cc.step(200); return p.sp; };
    c.pin(1, 4, 3); cc.step(2);
    const sp = [ring(), ring(), ring()];
    c.pin(1, -80, 0); c.pin(2, -10, 2); cc.step(2);
    const behind = ring(), angered2 = cc.of('combat:bell').at(-1)?.angered ?? [];
    c.pin(2, -80, 0); c.pin(3, -4, 2); cc.step(2);
    const close = ring();
    c.pin(3, -80, 0); c.pin(1, 4, 3); cc.step(300);
    const expired = !cc.has(cc.R(1), 'angry'), again = ring();
    return { ok: sp.join() === '3,3,3' && behind === 3 && angered2.join() === '2' && close === 6 && expired && again === 9,
      info: { sp, behind, angered2, close, expired, again } };
  }],
  ['statuses: a strong short slow never inherits a weak long slow\'s timer (both orders)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const run = (first, second) => {
      p.statuses.length = 0; c.status(0, 'slow', ...first); c.status(0, 'slow', ...second);
      const at = []; for (const n of [30, 45, 60]) { cc.step(n); at.push(+p.mods.speedMul.toFixed(3)); }
      return at;
    };
    const honkThenWhistle = run([2, 0.15], [1, 0.35]), whistleThenHonk = run([1, 0.35], [2, 0.15]);
    const same = run([1, 0.35], [2, 0.35]);
    const want = '0.65,0.85,1';
    return { ok: honkThenWhistle.join() === want && whistleThenHonk.join() === want && same.join() === '0.65,0.65,1',
      info: { honkThenWhistle, whistleThenHonk, same, crashes: cc.of('rider:crash').length, style: cc.stylePaid() } };
  }],
  ['KO credit tie: two lethal hits on one substep credit the first (killing) blow', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.pin(2, 0.2, 1.2); c.pin(1, 0.2, 2.4); cc.step(2);
    cc.R(2).hp = 5;
    const a = c.swing(0, 1), b = c.swing(1, -1);
    cc.until(() => cc.of('combat:ko').length > 0, 60); cc.step(2);
    const hits = cc.of('combat:hit', (h) => h.victim === 2).map((h) => h.attacker), ko = cc.of('combat:ko')[0];
    return { ok: a && b && hits.join() === '0,1' && ko?.victim === 2 && ko.attacker === 0, info: { hits, ko } };
  }],
  ['fish at full HP and cans at full SP stay on the road (riding through and Big Gulp alike); hurt riders take them', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    cc.ctl({ throttle: 1 }); cc.step(10); p.sp = 100;
    const fish = c.spawn('fish', p.s + 8, p.x), can = c.spawn('can', p.s + 12, p.x); cc.step(60);
    const ride = cc.of('pickup:take').length;
    const f2 = c.spawn('fish', p.s + 2.5, p.x + 1.5), c2 = c.spawn('can', p.s + 3, p.x - 1.5);
    cc.press('skill2'); cc.step(1); cc.until(() => c.running().length === 0, 200);
    const gulp = cc.of('pickup:take').length, left = [fish, can, f2, c2].filter((id) => c.items().some((it) => it.id === id && it.alive)).length;
    p.hp = p.maxHp - 30; p.sp = 50; c.spawn('fish', p.s + 8, p.x); c.spawn('can', p.s + 12, p.x); cc.step(60);
    const taken = cc.of('pickup:take').map((e) => e.kind).join();
    const style = cc.stylePaid();   // the r4 STYLE chain pays a bonus on top of the r3 economy
    return { ok: ride === 0 && gulp === 0 && left === 4 && taken === 'fish,can' && p.hp === p.maxHp - 5 && p.sp - style.sp === 70,
      info: { ride, gulp, left, taken, hp: p.hp, sp: p.sp, style } };
  }],
  ['torpedo: a car in the way stops it (no hit, projectile:end hit null); with the road clear it hits', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); const s = cc.S();
    c.pin(1, 22, 2.5); cc.step(2);
    const car = { id: 9001, kind: 'car', s: p.s + 10, x: 2, speed: p.speed, halfWidth: 0.9, halfLength: 2.2, height: 1.55, solid: true, active: true };
    s.obstacles.push(car);
    const shoot = () => {
      cc.mark(); cc.press('skill1'); cc.step(1);
      cc.until(() => { car.s = p.s + 10; car.speed = p.speed; return cc.of('projectile:end').length > 0; }, 200);
      return cc.of('projectile:end')[0];
    };
    const hp0 = cc.R(1).hp, blocked = shoot(), hp1 = cc.R(1).hp;
    s.obstacles.splice(s.obstacles.indexOf(car), 1); c.resetCooldowns(0); cc.step(30);
    const clear = shoot();
    return { ok: blocked?.hit === null && hp1 === hp0 && clear?.hit === 1 && cc.R(1).hp < hp1, info: { blocked, hp0, hp1, clear, hp2: cc.R(1).hp } };
  }],
  ['presses are never lost: J after U cuts the cast pose, B rings during a cast pose, J after B cuts the bell', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const mine = (t) => cc.of(t, (e) => e.riderId === 0).length;
    cc.press('skill1'); cc.step(1); cc.step(3);
    const pose = p.action?.kind; cc.press('attackR'); cc.step(1);
    const jAfterU = mine('combat:swing'); cc.step(40);
    c.resetCooldowns(0); cc.press('skill1'); cc.step(1); cc.step(3);
    const pose2 = p.action?.kind; cc.press('bell'); cc.step(1);
    const bAfterU = mine('combat:bell'); cc.step(10);
    const inBell = p.action?.kind; cc.press('attackR'); cc.step(1);
    const jAfterB = mine('combat:swing');
    return { ok: pose === 'skill' && jAfterU === 1 && pose2 === 'skill' && bAfterU === 1 && inBell === 'bell' && jAfterB === 2,
      info: { pose, jAfterU, pose2, bAfterU, inBell, jAfterB } };
  }],
  ['presses are never lost: J in a hit stagger fires when it ends; U then I during one swing casts both', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ crit: false, block: false, loose: false });
    const mine = (t) => cc.of(t, (e) => e.riderId === 0);
    c.pin(1, 0.2, 1.2); cc.step(2); c.swing(1, -1);
    cc.until(() => p.action?.kind === 'hit', 60); cc.step(2);
    cc.press('attackR'); cc.step(1);
    const early = mine('combat:swing').length, held = cc.until(() => mine('combat:swing').length > 0, 40);
    c.pin(1, -60, 0); cc.step(60); c.resetCooldowns(0); cc.mark();
    c.swing(0, 1); cc.step(1); cc.press('skill1'); cc.step(1); cc.press('skill2'); cc.step(1);
    cc.until(() => mine('skill:cast').length >= 2 || mine('skill:denied').length > 0, 60);
    const casts = mine('skill:cast').map((e) => e.slot).join(), denied = mine('skill:denied').length;
    return { ok: early === 0 && held > 0 && casts === '1,2' && denied === 0, info: { early, held, casts, denied } };
  }],
  ['Big Gulp: busy only while the pouch is open or holds a rival; the pelican swings 0.1 s after a late spit', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ crit: false, block: false, loose: false });
    cc.press('skill2'); cc.step(1); cc.step(54);
    c.pin(5, 1.0, 0.8); cc.step(2); c.unpin(5);
    const caught = cc.has(cc.R(5), 'gulped');
    cc.until(() => cc.of('skill:hit', (e) => e.skillId === 'pelican.gulp').length > 0, 90);
    const spitAt = cc.ev.find((e) => e.t === 'skill:hit')?.f;
    cc.step(6); cc.press('attackL'); cc.step(1);
    const swing = cc.ev.find((e) => e.t === 'combat:swing' && e.p.riderId === 0)?.f, running = c.running().some((k) => k.id === 'pelican.gulp');
    cc.until(() => c.running().length === 0, 120);
    return { ok: caught && spitAt > 0 && swing > spitAt && swing - spitAt <= 8 && running, info: { caught, spitAt, swing, running } };
  }],
  ['Big Gulp eats HONK and WHISTLE waves: no stun or slow, +4 SP each, a 咕嘟 bubble; the pouch closed, the honk lands', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.pin(1, -6, 0); c.pin(9, -8, 1); cc.step(2);
    cc.press('skill2'); cc.step(1); cc.step(2);
    p.heat = 0.6; c.cast(1, 1); c.cast(9, 1); cc.step(20);
    const ate = { stun: cc.has(p, 'stun'), slow: cc.has(p, 'slow'), sp: p.sp, gulps: cc.of('taunt', (e) => e.riderId === 0 && e.text === '咕嘟！').length };
    const hits = cc.of('skill:hit', (e) => e.victim === 0).length;
    p.heat = 0; cc.until(() => c.running().length === 0, 200); c.resetCooldowns(); cc.step(2);
    c.cast(1, 1); cc.step(20);
    const after = cc.has(p, 'stun') && cc.has(p, 'slow');
    return { ok: !ate.stun && !ate.slow && ate.sp === 8 && ate.gulps === 2 && hits === 0 && after, info: { ate, hits, after } };
  }],
  ['rival heavies near the player are telegraphed: glint + 1.6x windup, a J 0.2 s in still counters; far ones are not', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ block: false, loose: false });
    c.give(1, 'baguette'); c.pin(1, 0.2, 1.2); c.pin(2, 30, 0); c.give(2, 'baguette'); cc.step(2);
    const v0 = c.counts().visuals;
    c.swing(1, -1, true); cc.step(1);
    const glint = c.counts().visuals - v0, windup = c.data(1).swing.windup;
    cc.step(11); cc.press('attackR'); cc.step(1); cc.step(40);
    const counter = cc.of('combat:hit', (h) => h.attacker === 0)[0], back = cc.of('combat:hit', (h) => h.attacker === 1).length;
    c.swing(2, 1, true); cc.step(1);
    const far = c.data(2).swing.windup;
    return { ok: glint === 1 && Math.abs(windup - 0.16 * (0.38 / 0.32) * 1.6) < 1e-6 && counter?.crit === true && back === 0 &&
      Math.abs(far - 0.16 * (0.38 / 0.32)) < 1e-6, info: { glint, windup, counter, back, far } };
  }],
];
