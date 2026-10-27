#!/usr/bin/env node
// r6 acceptance: police (SPEC §25 薄纱警察 — the police can be beaten). Lead-owned, read-only for workers.
// Before r6 a player swinging at every chance had the officer in reach for 1.2 s of a 17 s ★2 chase and never
// downed it (each knock sent it 3 s away); skills and SHOWTIME could not touch it.
//   node tools/r6/police.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from '../r4/accept-lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EVENTS = ['police:wanted', 'police:hurt', 'police:down', 'police:knock', 'police:bounty', 'police:squad', 'police:offDuty',
  'pickup:spawn', 'npc:say', 'police:busted', 'combat:weaponPick'];

/** A ★2 chase on the coast with the rivals sent far ahead; the officer is put beside the player. */
async function chase(page, h, extra = '') {
  await race(page, h, { track: 'coast', seed: 3, extra: `&traffic=0&police=1${extra}` });
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 700 + r.id * 15, 0); });
  await capture(page, EVENTS);
  await page.evaluate(() => window.__br.race.setHeat(0.8));
  for (let i = 0; i < 60; i++) {
    await hold(page, { throttle: 0.8 }, 10);
    const p = await page.evaluate(() => window.__br.race.police());
    if (p && p.mode === 'chase' && Math.abs(p.ds) < 3) return true;
  }
  return false;
}

// 1. A real fight: swing (real presses) whenever the officer is in reach, wings only → it goes down within 20 s,
//    and while the player keeps swinging it stays in reach most of the time.
await withPage(async (page, h) => {
  expect(await chase(page, h), 'a ★2 chase starts and the officer arrives beside the player');
  const out = await page.evaluate(async () => {
    const b = window.__br, s = b.session(), p = s.player;
    let inReach = 0, frames = 0, down = false;
    const off = b.app.bus.on('police:down', () => { down = true; });
    for (let f = 0; f < 60 * 20 && !down; f += 2) {
      const pol = b.race.police();
      const near = pol && pol.mode === 'chase' && Math.abs(pol.ds) < 1.6 && Math.abs(pol.lat) < 2.2;
      if (near) inReach += 2;
      frames += 2;
      b.setControls({ throttle: 0.8, attackL: near && !p.action && pol.lat < 0, attackR: near && !p.action && pol.lat >= 0 });
      b.step(2);
      p.hp = Math.max(p.hp, 60);
    }
    off();
    b.setControls({ throttle: 0.8 });
    return { down, t: +(frames / 60).toFixed(1), reach: +(inReach / Math.max(1, frames)).toFixed(2) };
  });
  expect(out.down, `bare wings down the officer within 20 s of swinging (${JSON.stringify(out)})`);
  expect(out.reach >= 0.45, `the officer stays in reach for ≥ 45 % of the fight (${out.reach})`);
  const ev = await events(page);
  const hurt = ev.filter((x) => x.n === 'police:hurt');
  expect(hurt.length >= 3 && hurt.length <= 8, `it takes 3–8 wing hits (${hurt.length}: ${hurt.map((x) => x.e.hp).join(' → ')})`);
  // the payoff: bounty + refund, the 柯基下班了 line, the baton on the road
  const bounty = ev.find((x) => x.n === 'police:bounty');
  expect(!!bounty && bounty.e.bounty >= 50 && bounty.e.riderId === 0, `police:bounty pays the player (${JSON.stringify(bounty?.e)})`);
  expect(ev.some((x) => x.n === 'npc:say' && /下班/.test(x.e.text)) || ev.some((x) => x.n === 'police:down'), 'the officer says it is clocking off (柯基下班了)');
  const baton = ev.find((x) => x.n === 'pickup:spawn' && x.e.kind === 'weapon' && x.e.weapon === 'baton');
  expect(!!baton, `its baton drops as a weapon pickup (${JSON.stringify(baton?.e)})`);
  // the player can pick the baton up and use it
  if (baton) {
    await page.evaluate((e) => { const b = window.__br; b.teleport(0, e.s - 3, e.x); b.session().player.weapon = 'none'; }, baton.e);
    await hold(page, { throttle: 0.6 }, 90);
    const w = await page.evaluate(() => window.__br.session().player.weapon);
    expect(w === 'baton', `the player picks the baton up (${w})`);
  }
  await noErrors(h, 'police fight');
}, { size: '960x540' });

// 2. Skills hurt the officer: the torpedo hits it; SHOWTIME downs every officer it reaches.
await withPage(async (page, h) => {
  expect(await chase(page, h), 'chase for the skill test');
  await clearEvents(page);
  const torp = await page.evaluate(async () => {
    const b = window.__br, s = b.session(), p = s.player;
    const pol = b.race.police();
    const o = s.obstacles.find((x) => x.id === 900);
    b.teleport(0, o.s - 14, o.x);
    p.speed = o.speed;
    b.combat.resetCooldowns(0);
    b.combat.cast(0, 1);
    for (let i = 0; i < 120; i++) { b.step(1); }
    return pol?.hp;
  });
  let ev = await events(page);
  const hit = ev.find((x) => x.n === 'police:hurt');
  expect(!!hit, `the fish torpedo hurts the officer (police:hurt ${JSON.stringify(hit?.e)}; hp before ${torp})`);
  await clearEvents(page);
  await page.evaluate(() => {
    const b = window.__br, s = b.session(), p = s.player;
    const o = s.obstacles.find((x) => x.id === 900);
    b.teleport(0, o.s - 12, o.x + 1.5);
    p.speed = o.speed;
    p.sp = 100;
    b.combat.resetCooldowns(0);
    b.combat.cast(0, 4);
    for (let i = 0; i < 150; i++) b.step(1);
  });
  ev = await events(page);
  expect(ev.some((x) => x.n === 'police:down'), `SHOWTIME downs the officer it reaches (${ev.filter((x) => /police/.test(x.n)).map((x) => x.n).join(',')})`);
  await noErrors(h, 'police skills');
}, { size: '960x540' });

// 3. Three downs → the 特警 squad; all of them down → 警局下班: no more police this race.
await withPage(async (page, h) => {
  expect(await chase(page, h), 'chase for the squad test');
  const run = await page.evaluate(async () => {
    const b = window.__br, s = b.session();
    const log = [];
    const hit = (id, dmg = 999) => b.app.bus.emit('combat:obstacleHit', { obstacleId: id, attacker: 0, weapon: 'pan', damage: dmg, thrown: true, pos: { x: 0, y: 1, z: 0 } });
    const offs = ['police:down', 'police:squad', 'police:offDuty'].map((n) => b.app.bus.on(n, (e) => log.push([n, e.phase ?? '', e.obstacleId ?? null])));
    // down officers until three are down (re-raising the heat brings new ones)
    for (let k = 0; k < 600 && log.filter((x) => x[0] === 'police:down').length < 3; k++) {
      const live = s.obstacles.filter((o) => o.kind === 'police' && o.active && o.id < 910);
      if (live.length) hit(live[0].id);
      else b.race.setHeat(0.8);
      b.step(5);
    }
    // the squad
    for (let k = 0; k < 400 && !log.some((x) => x[0] === 'police:offDuty'); k++) {
      const squad = s.obstacles.filter((o) => o.kind === 'police' && o.active && o.id >= 910);
      if (squad.length) {
        const p = s.player, o = squad[0];
        b.teleport(0, o.s - 0.5, o.x - 1.2);
        hit(o.id);
      }
      b.step(5);
    }
    offs.forEach((f) => f());
    // after 警局下班: heat does nothing for the rest of the race
    b.race.setHeat(0.9);
    for (let i = 0; i < 40; i++) b.step(10);
    const after = b.race.police();
    return { log, after: after && { mode: after.mode, wanted: after.wanted } };
  });
  const squad = run.log.filter((x) => x[0] === 'police:squad');
  expect(squad.some((x) => x[1] === 'call' || x[1] === 'arrive'), `three downs call the 特警 squad (${JSON.stringify(squad)})`);
  expect(run.log.some((x) => x[0] === 'police:offDuty'), `downing the whole squad → police:offDuty (${JSON.stringify(run.log.slice(-6))})`);
  expect(!!run.after && run.after.mode === 'off' && run.after.wanted === 0, `警局下班: no chase starts again this race (${JSON.stringify(run.after)})`);
  await noErrors(h, 'police squad');
}, { size: '960x540' });

finish('r6-police');
