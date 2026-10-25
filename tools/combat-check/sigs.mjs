// Rival signature skills, bell taunt and cleanup scenarios (run in the page). Rivals cast through
// __br.combat.cast(id, 1) (the same path as controls.skill1).
export const sigs = [
  ['goose HONK stuns + slows riders in its cone; whistle slows; chill blocks attacks', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.pin(1, -6, 0); cc.step(2); c.cast(1, 1); cc.step(20);
    const honk = cc.has(p, 'stun') && cc.has(p, 'slow');
    cc.step(150); c.pin(1, -70, 0);
    c.pin(9, -8, 0); cc.step(2); cc.mark(); p.heat = 0.5; c.cast(9, 1); cc.step(3); p.heat = 0;
    const whistle = cc.has(p, 'slow') && cc.of('skill:hit', (e) => e.skillId === 'corgi.whistle' && e.victim === 0).length === 1;
    c.pin(9, -70, 0); cc.step(80);
    c.pin(3, -3, 1); cc.step(2); c.cast(3, 1); cc.step(5);
    const chilled = cc.has(p, 'chill') && !p.mods.canAttack;
    cc.mark(); cc.press('attackR'); cc.step(1); cc.step(5);
    const noSwing = cc.of('combat:swing', (e) => e.riderId === 0).length === 0;
    return { ok: honk && whistle && chilled && noSwing, info: { honk, whistle, chilled, noSwing } };
  }],
  ['cat OIIA spin hits around it; doge reflects melee; penguin slide is melee-immune', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.pin(2, 0.5, 1.5); cc.step(2); c.cast(2, 1); cc.step(50);
    const spin = cc.of('combat:hit', (h) => h.skillId === 'cat.spin' && h.victim === 0)[0];
    c.pin(2, -70, 0); c.pin(4, 0.2, 1.2); cc.step(2); c.cast(4, 1); cc.step(2); cc.mark();
    const hpDoge = cc.R(4).hp, hpP = cc.P().hp;
    cc.press('attackR'); cc.step(1); cc.step(30);
    const blocked = cc.of('combat:hit', (h) => h.victim === 4 && h.blocked).length === 1;
    const reflected = cc.of('combat:hit', (h) => h.attacker === 4 && h.victim === 0 && h.skillId === 'shiba.doge').length === 1;
    const dogeOk = blocked && reflected && cc.R(4).hp === hpDoge && cc.P().hp < hpP;
    c.pin(4, -70, 0); c.pin(6, 0.2, 1.2); cc.step(90); c.cast(6, 1); cc.step(2); cc.mark();
    cc.press('attackR'); cc.step(1); cc.step(30);
    const slide = cc.of('combat:hit', (h) => h.victim === 6 && h.blocked).length === 1 && cc.topMul(cc.R(6)) >= 1.249;
    return { ok: spin?.damage === 10 && dogeOk && slide, info: { spin: spin?.damage, blocked, reflected, dogeOk, slide } };
  }],
  ['pigeon NO SHOW: untouchable for 1.5 s, then reappears ~25 m ahead', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false });
    c.pin(5, 0.2, 1.2); cc.step(2); c.cast(5, 1); cc.step(2);
    const v = cc.R(5), hidden = v.mods.invisible && v.mods.intangible;
    cc.press('attackR'); cc.step(1); cc.step(20);
    const hits = cc.of('combat:hit', (h) => h.victim === 5).length;
    c.unpin(5);
    let jump = 0, prev = v.s;
    cc.until(() => { jump = Math.max(jump, v.s - prev); prev = v.s; return !cc.has(v, 'invisible'); }, 200);
    return { ok: hidden && hits === 0 && jump > 20, info: { hidden, hits, jump } };
  }],
  ['seagull MINE! steals a weapon, else 20 SP; denied with nobody near', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.give(0, 'leek'); c.pin(7, 0.5, 1.5); cc.step(2); c.cast(7, 1); cc.step(3);
    const stole = cc.R(7).weapon === 'leek' && p.weapon === 'none' && cc.of('combat:weaponPick', (e) => e.stolenFrom === 0).length === 1;
    c.resetCooldowns(7); p.sp = 50; cc.R(7).sp = 0; c.cast(7, 1); cc.step(3);
    const sp = Math.round(p.sp) <= 31 && cc.R(7).sp >= 19.5;
    c.pin(7, 150, 0); c.resetCooldowns(7); cc.step(2); cc.mark(); c.cast(7, 1); cc.step(2);
    const denied = cc.of('skill:denied', (e) => e.riderId === 7)[0]?.reason === 'state';
    return { ok: stole && sp && denied, info: { stole, sp, denied, psp: p.sp } };
  }],
  ['sloth FLASH: +60 % boost with instant acceleration', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    c.pin(8, -10, 2); cc.step(2); c.unpin(8); c.cast(8, 1); cc.step(2);
    const v = cc.R(8);
    return { ok: cc.topMul(v) >= 1.599 && cc.has(v, 'boost') && v.speed > 18, info: { mul: cc.topMul(v), speed: v.speed } };
  }],
  ['bell: angers rivals within 15 m, +3 SP, 3 s cooldown', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.pin(1, 6, 1); c.pin(2, 30, 0); cc.step(2);
    const sp0 = p.sp;
    cc.press('bell'); cc.step(1); cc.step(2);
    const angry = cc.has(cc.R(1), 'angry') && !cc.has(cc.R(2), 'angry');
    cc.press('bell'); cc.step(1); cc.step(2);
    const taunts1 = cc.of('taunt', (e) => e.riderId === 0).length;
    cc.step(200);
    cc.press('bell'); cc.step(1); cc.step(2);
    const taunts2 = cc.of('taunt', (e) => e.riderId === 0).length;
    return { ok: angry && p.sp - sp0 >= 3 && taunts1 === 1 && taunts2 === 2, info: { angry, sp: p.sp - sp0, taunts1, taunts2 } };
  }],
  ['nothing runs away: projectiles, skills and visuals all wind down', () => {
    const cc = window.__cc; cc.reset(); cc.step(400);
    const n = cc.C().counts();
    return { ok: n.projectiles === 0 && n.skills === 0 && n.visuals <= 1, info: n };
  }],
  ['restart mid-skill disposes everything (one combat root, fresh debug API)', async () => {
    const cc = window.__cc, br = window.__br; cc.reset();
    const old = cc.C();
    cc.P().sp = 100; cc.press('skill1'); cc.press('skill3'); old.cast(3, 1); cc.step(3);
    const busy = old.counts();
    await br.start({});
    const count = () => { let n = 0; br.app.scene.traverse((o) => { if (o.name === 'combat') n++; }); return n; };
    const fresh = br.combat !== old && !!br.combat;
    cc.until(() => cc.S().phase === 'racing', 3000);
    cc.step(30);
    return { ok: busy.skills >= 2 && fresh && count() === 1, info: { busy, fresh, roots: count() } };
  }],
];
