#!/usr/bin/env node
// r4 acceptance: w1-combat-throw (SPEC §15 throw, §14 npc:strike, §19 pickup:spawn). Lead-owned, read-only for workers.
//   node tools/r4/w1-throw.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, sleep, withPage } from './accept-lib.mjs';

const C = { throttle: 1 };

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3 });
  await capture(page, ['combat:throw', 'combat:swing', 'combat:hit', 'combat:obstacleHit', 'npc:hit', 'combat:ko', 'rider:crash', 'projectile:spawn']);
  const ids = await page.evaluate(() => window.__br.session().riders.filter((r) => !r.isPlayer).map((r) => r.id));
  const [r1, r2, r3] = ids;
  await page.evaluate(() => { window.__br.combat.clearItems(); window.__br.combat.force({ crit: false }); });

  // A. a tap stays a heavy swing
  await page.evaluate(([a]) => { const c = window.__br.combat; c.pin(a, 0.3, 1.4); c.give(0, 'baguette', 6); }, [r1]);
  await hold(page, C, 20);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 3);
  await hold(page, { ...C, heavyHeld: false }, 50);
  let ev = await events(page);
  expect(ev.some((x) => x.n === 'combat:swing' && x.e.riderId === 0 && x.e.heavy), 'tap: a heavy swing starts');
  expect(!ev.some((x) => x.n === 'combat:throw'), 'tap: nothing is thrown');
  expect((await page.evaluate(() => window.__br.session().player.weapon)) === 'baguette', 'tap: the baguette stays in hand');

  // B. hold → aim → release throws forward and hits the rival ahead
  await page.evaluate(([a, b]) => { const c = window.__br.combat; c.unpin(a); c.pin(b, 14, 0); c.give(0, 'baguette', 6); c.resetCooldowns(); }, [r1, r2]);
  await hold(page, C, 30);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
  await hold(page, { ...C, heavyHeld: true }, 30);
  const aim = await page.evaluate(() => { const p = window.__br.session().player; return { kind: p.action?.kind ?? null, weapon: p.weapon }; });
  expect(aim.kind === 'throw' && aim.weapon === 'baguette', `hold: the rider aims (action ${aim.kind}, weapon ${aim.weapon})`);
  expect(!(await events(page, 'combat:throw')).length, 'hold: nothing thrown while the key is held');
  await hold(page, { ...C, heavyHeld: false }, 1);
  let thr = await events(page, 'combat:throw');
  expect(thr.length === 1 && thr[0].e.weapon === 'baguette' && thr[0].e.dir === 1 && thr[0].e.riderId === 0, `release: one forward throw (${JSON.stringify(thr.map((x) => x.e))})`);
  expect((await page.evaluate(() => window.__br.session().player.weapon)) === 'none', 'release: the weapon left the hand');
  await hold(page, C, 90);
  ev = await events(page, 'combat:hit');
  const hit = ev.find((x) => x.e.attacker === 0 && x.e.victim === r2);
  expect(!!hit && hit.e.weapon === 'baguette', `throw: hits the rival 14 m ahead (${JSON.stringify(ev.map((x) => [x.e.attacker, x.e.victim, x.e.weapon, x.e.damage]))})`);
  expect(!!hit && Math.abs(hit.e.damage - 19 * 1.2) < 2.5, `throw: damage = heavyDamage x 1.2 (${hit?.e.damage})`);
  const drop = await page.evaluate(() => window.__br.combat.items().filter((i) => i.alive && i.kind === 'weapon' && i.weapon === 'baguette').length);
  expect(drop === 1, `throw: the baguette lands as a road pickup (${drop})`);

  // C. aiming auto-releases after 1.5 s
  await page.evaluate(() => { const c = window.__br.combat; c.clearItems(); c.give(0, 'leek', 10); c.resetCooldowns(); });
  await hold(page, C, 20);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
  await hold(page, { ...C, heavyHeld: true }, 120);
  thr = await events(page, 'combat:throw');
  expect(thr.length === 1, `aim: auto-release within 2 s of holding (${thr.length} throws)`);

  // D. lookBack held at release throws backwards
  await page.evaluate(([b, c3]) => { const c = window.__br.combat; c.unpin(b); c.pin(c3, -12, 0); c.give(0, 'leek', 10); c.resetCooldowns(); }, [r2, r3]);
  await hold(page, { ...C, heavyHeld: false }, 30);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
  await hold(page, { ...C, heavyHeld: true, lookBack: true }, 30);
  await hold(page, { ...C, heavyHeld: false, lookBack: true }, 1);
  thr = await events(page, 'combat:throw');
  expect(thr.length === 1 && thr[0].e.dir === -1, `lookBack: thrown backwards (${JSON.stringify(thr.map((x) => x.e.dir))})`);
  await hold(page, C, 90);
  ev = await events(page, 'combat:hit');
  expect(ev.some((x) => x.e.attacker === 0 && x.e.victim === r3), 'backward throw hits the rival 12 m behind');

  // E. wings cannot be thrown
  await page.evaluate(([c3]) => { const c = window.__br.combat; c.unpin(c3); c.give(0, 'none'); c.resetCooldowns(); }, [r3]);
  await hold(page, C, 20);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
  await hold(page, { ...C, heavyHeld: true }, 60);
  await hold(page, { ...C, heavyHeld: false }, 30);
  expect(!(await events(page, 'combat:throw')).length, 'unarmed: holding heavy never throws');

  // F. a thrown weapon hits an obstacle → combat:obstacleHit
  await page.evaluate(() => {
    const s = window.__br.session();
    const p = s.player;
    s.obstacles.push({ id: 777, kind: 'prop', s: p.s + 11, x: p.x, speed: 0, halfWidth: 0.5, halfLength: 0.5, height: 1.6, solid: false, active: true });
    window.__br.combat.give(0, 'pan', 6);
    window.__br.combat.resetCooldowns();
  });
  await hold(page, C, 2);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
  await hold(page, { ...C, heavyHeld: true }, 20);
  await hold(page, { ...C, heavyHeld: false }, 60);
  ev = await events(page, 'combat:obstacleHit');
  expect(ev.some((x) => x.e.obstacleId === 777 && x.e.thrown && x.e.attacker === 0 && x.e.weapon === 'pan' && x.e.damage > 0),
    `obstacle: a thrown pan reports combat:obstacleHit on the prop (${JSON.stringify(ev.map((x) => x.e))})`);
  await page.evaluate(() => { const s = window.__br.session(); s.obstacles.splice(s.obstacles.findIndex((o) => o.id === 777), 1); });

  // G. pickup:spawn puts a pickup on the road
  const before = await page.evaluate(() => window.__br.combat.items().filter((i) => i.alive).length);
  await page.evaluate(() => { const p = window.__br.session().player; window.__br.app.bus.emit('pickup:spawn', { kind: 'coin', s: p.s + 40, x: 2 }); window.__br.app.bus.emit('pickup:spawn', { kind: 'weapon', s: p.s + 42, x: -2, weapon: 'slipper' }); });
  await hold(page, C, 2);
  const spawned = await page.evaluate(() => window.__br.combat.items().filter((i) => i.alive));
  expect(spawned.length === before + 2 && spawned.some((i) => i.kind === 'weapon' && i.weapon === 'slipper'), `pickup:spawn adds a coin and a slipper (${spawned.length - before})`);

  // H. npc:strike is resolved like a melee hit and answered with npc:hit
  await page.evaluate(() => { const c = window.__br.combat; c.clearItems(); c.give(0, 'none'); c.set(0, { hp: 100 }); c.force({ crit: false, block: false }); window.__br.session().player.invuln = 0; });
  await hold(page, C, 5);
  await clearEvents(page);
  const vx0 = await page.evaluate(() => window.__br.session().player.vx);
  await page.evaluate(() => { const p = window.__br.session().player; window.__br.app.bus.emit('npc:strike', { victim: 0, obstacleId: 900, damage: 10, knock: 4.2, side: 1, heavy: false, weapon: 'baton', pos: { x: 0, y: 1, z: 0 }, cause: 'police' }); });
  await hold(page, C, 3);
  const st = await page.evaluate(() => { const p = window.__br.session().player; return { hp: p.hp, vx: p.vx }; });
  ev = await events(page, 'npc:hit');
  expect(ev.length === 1 && ev[0].e.victim === 0 && ev[0].e.damage === 10 && !ev[0].e.blocked && !ev[0].e.parried, `npc:strike → npc:hit {damage 10} (${JSON.stringify(ev.map((x) => x.e))})`);
  expect(Math.abs(st.hp - 90) < 0.01, `npc:strike takes 10 HP (${st.hp})`);
  expect(st.vx < vx0 - 1, `npc:strike from the right knocks the rider left (vx ${vx0.toFixed(2)} → ${st.vx.toFixed(2)})`);
  await page.evaluate(() => { window.__br.session().player.invuln = 2; });
  await clearEvents(page);
  await page.evaluate(() => window.__br.app.bus.emit('npc:strike', { victim: 0, obstacleId: 900, damage: 10, knock: 4.2, side: -1, heavy: false, weapon: 'baton', pos: { x: 0, y: 1, z: 0 }, cause: 'police' }));
  await hold(page, C, 2);
  ev = await events(page, 'npc:hit');
  expect(ev.length === 1 && ev[0].e.damage === 0, `invulnerable: npc:hit with damage 0 (${JSON.stringify(ev.map((x) => x.e))})`);
  await page.evaluate(() => { const p = window.__br.session().player; p.invuln = 0; window.__br.combat.set(0, { hp: 6 }); });
  await clearEvents(page);
  await page.evaluate(() => window.__br.app.bus.emit('npc:strike', { victim: 0, obstacleId: 900, damage: 14, knock: 4.2, side: 1, heavy: true, weapon: 'baton', pos: { x: 0, y: 1, z: 0 }, cause: 'police' }));
  await hold(page, C, 10);
  const ko = await events(page, 'combat:ko');
  const crash = await events(page, 'rider:crash');
  expect(ko.some((x) => x.e.victim === 0 && x.e.attacker === null && x.e.cause === 'police'), `lethal npc:strike → combat:ko {attacker null, cause police} (${JSON.stringify(ko.map((x) => x.e))})`);
  expect(crash.some((x) => x.e.riderId === 0 && x.e.cause === 'police'), 'lethal npc:strike crashes the rider with cause police');
  await page.evaluate(() => window.__br.combat.force(null));
  await noErrors(h, 'throw');
}, { size: '1280x720' });

await sleep(100);
finish('w1-throw');
