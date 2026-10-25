// Fix round 1 regressions (run in the page; see page.mjs). Rider ids: 1 goose, 2 cat, 3 capybara, 4 shiba,
// 5 pigeon, 6 penguin, 7 seagull, 8 sloth, 9 corgi.
export const fixes = [
  ['SHOWTIME refunds no SP (4 KOs), its flight is no sim landing, one coalesced impact punch', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    const ids = [1, 2, 3, 4];
    [[1, 12, -2], [2, 20, 2], [3, -6, 3], [4, 30, 0]].forEach(([id, ds, dx]) => c.pin(id, ds, dx));
    cc.step(2);
    for (const id of ids) cc.R(id).hp = 30;
    const kos0 = p.kos, coins0 = p.coins;
    p.sp = 100; cc.mark();
    cc.press('ult'); cc.step(1);
    const f = cc.until(() => cc.of('ult:impact').length > 0, 600);
    const impactFrame = cc.ev.find((e) => e.t === 'ult:impact')?.f;
    // combat is the only cam:shake emitter (fx's ult cinematic adds its own hit-stop on top, so count shakes)
    const stops = cc.ev.filter((e) => e.t === 'cam:shake' && e.f === impactFrame).length;
    cc.step(150);
    const kos = cc.of('combat:ko', (k) => k.attacker === 0 && k.skillId === 'pelican.ult').length;
    const land = cc.of('rider:land', (e) => e.riderId === 0).length + cc.of('rider:boost', (e) => e.riderId === 0 && e.kind === 'land').length;
    const hurtSp = ids.map((id) => cc.R(id).sp);
    return { ok: f > 0 && kos === 4 && p.kos === kos0 + 4 && p.coins === coins0 + 200 && p.sp < 1 && land === 0 && stops === 1 &&
      hurtSp.every((sp) => sp >= 1.5), info: { kos, sp: p.sp, land, stops, hurtSp } };
  }],
  ['bell: no SP on an empty road; combat:bell lists who was angered', () => {
    const cc = window.__cc; cc.reset(); const p = cc.P(); const c = cc.C();
    cc.press('bell'); cc.step(1); cc.step(2);
    const empty = cc.of('combat:bell')[0], sp0 = p.sp;
    cc.step(200);
    c.pin(1, 6, 1); cc.step(2);
    cc.press('bell'); cc.step(1); cc.step(2);
    const busy = cc.of('combat:bell')[1];
    return { ok: empty?.riderId === 0 && empty.angered.length === 0 && sp0 === 0 && busy?.angered.join() === '1' && p.sp === 3 &&
      cc.of('taunt', (e) => e.riderId === 0).length === 2, info: { empty, sp0, busy, sp: p.sp } };
  }],
  ['events: combat:weaponBreak; projectile:spawn / end on hit and on poof', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); c.force({ crit: false, block: false, loose: false });
    c.give(0, 'slipper', 1); c.pin(1, 0.2, 1.2); cc.step(2);
    cc.press('attackR'); cc.step(1); cc.step(30);
    const brk = cc.of('combat:weaponBreak')[0];
    c.pin(1, 25, 3); cc.step(2); cc.press('skill1'); cc.step(1);
    const spawn = cc.of('projectile:spawn')[0];
    cc.until(() => cc.of('projectile:end').length > 0, 240);
    const hit = cc.of('projectile:end')[0];
    c.pin(1, -60, 0); c.resetCooldowns(0); cc.step(2); cc.press('skill1'); cc.step(1);
    cc.until(() => cc.of('projectile:end').length > 1, 400);
    const poof = cc.of('projectile:end')[1], spawns = cc.of('projectile:spawn');
    return { ok: brk?.riderId === 0 && brk.weapon === 'slipper' && cc.P().weapon === 'none' && spawn?.owner === 0 && spawn.target === 1 &&
      spawn.kind === 'pelican.torpedo' && hit?.id === spawn.id && hit.hit === 1 && spawns.length === 2 && poof?.id === spawns[1].id && poof.hit === null,
      info: { brk, spawn, hit, poof } };
  }],
  ['wing dash: braking still slows you; rams only riders alongside or ahead', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    cc.ctl({ throttle: 1 }); cc.step(60);
    c.pin(1, -1.6, 1.0); c.pin(2, 1.0, -1.0); cc.step(1);
    cc.press('skill3'); cc.step(1); cc.step(8);
    const rams = cc.of('combat:hit', (h) => h.skillId === 'pelican.wing').map((h) => h.victim);
    c.pin(1, -60, 0); c.pin(2, -70, 0);
    const v0 = p.speed;
    cc.ctl({ throttle: 0, brake: 1 }); cc.step(60);
    const v1 = p.speed;
    cc.ctl({ throttle: 1 }); cc.step(90);
    return { ok: rams.join() === '2' && v1 < v0 - 6, info: { rams, v0, v1 } };
  }],
  ['ghosting riders cannot attack; a swing or cast clears respawn invulnerability', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P(); c.force({ crit: false, block: false, loose: false });
    c.pin(5, 0.2, -1.2); cc.step(2); c.cast(5, 1); cc.step(30);
    const v = cc.R(5), ghost = v.mods.invisible && !v.mods.canAttack && v.action === null, swung = c.swing(5, 1);
    cc.step(100);
    const back = v.mods.canAttack && !v.mods.invisible;
    p.invuln = 2; cc.press('attackR'); cc.step(1);
    const afterSwing = p.invuln;
    cc.step(40); p.invuln = 2; cc.press('skill1'); cc.step(1);
    return { ok: ghost && !swung && back && afterSwing === 0 && p.invuln === 0 && cc.of('combat:hit', (h) => h.attacker === 5).length === 0,
      info: { ghost, swung, back, afterSwing, invuln: p.invuln } };
  }],
];
