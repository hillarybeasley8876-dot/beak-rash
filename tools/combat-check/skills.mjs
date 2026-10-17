// Pelican skill scenarios: torpedo, gulp (small / big), wing dash, SHOWTIME (run in the page).
export const skills = [
  ['torpedo homes onto the rival ahead (14 dmg + stun), then cooldown denial', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    c.pin(1, 25, 3); cc.step(2);
    cc.press('skill1'); cc.step(1);
    const cast = cc.of('skill:cast')[0], flying = c.projectiles().length;
    const f = cc.until(() => cc.of('skill:hit').length > 0, 240);
    const hit = cc.of('combat:hit', (h) => h.skillId === 'pelican.torpedo')[0], stun = cc.has(cc.R(1), 'stun');
    cc.press('skill1'); cc.step(8);
    const denied = cc.of('skill:denied')[0];
    cc.step(30);
    return { ok: cast?.skillId === 'pelican.torpedo' && flying === 1 && f > 0 && hit?.victim === 1 && hit.damage === 14 && stun && denied?.reason === 'cooldown' && c.projectiles().length === 0,
      info: { cast, flying, frames: f, hit, stun, denied } };
  }],
  ['torpedo without a target flies straight and expires (no runaway)', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C();
    cc.press('skill1'); cc.step(1);
    const n0 = c.projectiles().length, target = c.projectiles()[0]?.target;
    const gone = cc.until(() => c.projectiles().length === 0, 400);
    return { ok: n0 === 1 && target === null && gone > 0, info: { n0, target, gone } };
  }],
  ['gulp swallows a small rival, 25 dmg at the spit (one skill:hit), lands ~15 m back with no landing bonus', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.pin(5, 1.0, 0.8); cc.step(2);
    const v = cc.R(5);
    cc.press('skill2'); cc.step(1); cc.step(2);
    const gulped = cc.has(v, 'gulped'), inv = v.mods.invisible;
    c.unpin(5);
    let ahead = 0;
    cc.until(() => { if (cc.has(v, 'gulped')) ahead = Math.max(ahead, v.s - p.s); return cc.of('combat:hit', (h) => h.skillId === 'pelican.gulp').length > 0; }, 240);
    const hit = cc.of('combat:hit', (h) => h.skillId === 'pelican.gulp')[0];
    const atBeak = v.s - p.s;
    cc.until(() => !v.airborne && !v.mods.intangible, 120);
    const back = v.s - p.s, stunned = cc.has(v, 'stun');
    cc.step(30);
    const skillHits = cc.of('skill:hit', (e) => e.victim === 5).length;
    const landing = cc.of('rider:land', (e) => e.riderId === 5).length + cc.of('rider:boost', (e) => e.riderId === 5 && e.kind === 'land').length;
    return { ok: gulped && inv && ahead <= 0 && hit?.victim === 5 && hit.damage === 25 && atBeak > -2 && back < -9 && back > -20 &&
      skillHits === 1 && landing === 0 && stunned && v.mode === 'racing',
      info: { gulped, inv, ahead, hit: hit?.damage, atBeak, back, stunned, skillHits, landing } };
  }],
  ['gulp bites a big rival (12 dmg) and steals its weapon; vacuums pickups', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    c.give(3, 'keyboard'); c.pin(3, 0.8, 1.2); cc.step(2);
    c.spawn('coin', p.s + 3.5, p.x - 2.5);
    cc.press('skill2'); cc.step(1); cc.step(60);
    const hit = cc.of('combat:hit', (h) => h.skillId === 'pelican.gulp')[0];
    const coin = cc.of('pickup:take', (e) => e.kind === 'coin').length;
    return { ok: hit?.victim === 3 && hit.damage === 12 && p.weapon === 'keyboard' && cc.R(3).weapon === 'none' && coin === 1,
      info: { hit, mine: p.weapon, coin } };
  }],
  ['wing dash: +40 % boost, rams riders aside (8 dmg) without slowing down', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    cc.ctl({ throttle: 1 }); cc.step(60);
    c.pin(1, 1.5, 1.0); cc.step(1);
    const v0 = p.speed;
    cc.press('skill3'); cc.step(1); cc.step(10);
    const boosted = cc.topMul(p) >= 1.399 && cc.of('rider:boost', (e) => e.riderId === 0 && e.kind === 'skill').length === 1;
    const ram = cc.of('combat:hit', (h) => h.skillId === 'pelican.wing')[0];
    cc.step(40);
    return { ok: boosted && ram?.victim === 1 && ram.damage === 8 && p.speed >= v0 - 0.2, info: { boosted, ram, v0, v: p.speed } };
  }],
  ['SHOWTIME needs 100 SP, leaps to ~8 m and the shockwave hits 40 m ahead / 12 m behind', () => {
    const cc = window.__cc; cc.reset(); const c = cc.C(); const p = cc.P();
    p.sp = 60; cc.press('ult'); cc.step(1);
    const denied = cc.of('skill:denied')[0];
    c.pin(1, 20, -2); c.pin(2, 36, 2); c.pin(3, -9, 3); c.pin(4, 52, 0); cc.step(2);
    p.sp = 100; cc.mark();
    cc.press('ult'); cc.step(1);
    const spent = p.sp;
    let top = 0;
    const f = cc.until(() => { top = Math.max(top, p.y); return cc.of('ult:impact').length > 0; }, 600);
    const imp = cc.of('ult:impact')[0], hits = cc.of('combat:hit', (h) => h.skillId === 'pelican.ult');
    cc.step(120);
    return { ok: denied?.reason === 'sp' && cc.of('ult:start').length === 1 && top > 7.5 && f > 0 && [1, 2, 3].every((id) => imp.victims.includes(id)) &&
      !imp.victims.includes(4) && hits.every((h) => h.damage === 45) && spent < 1 && p.y < 0.05,
      info: { denied: denied?.reason, spent, top, frames: f, victims: imp?.victims, dmg: hits.map((h) => h.damage), y: p.y } };
  }],
];
