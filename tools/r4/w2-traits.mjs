#!/usr/bin/env node
// r4 acceptance: w2-combat-traits (SPEC §15 weapon traits + pan parry; §16/§17 trick and STYLE rewards).
// Lead-owned, read-only for workers.   node tools/r4/w2-traits.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 1 };
const P = { x: 0, y: 1, z: 0 };

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3 });
  await capture(page, ['combat:hit', 'combat:parry', 'combat:throw', 'combat:weaponDrop', 'combat:weaponPick', 'npc:hit', 'projectile:end']);
  const ids = await page.evaluate(() => window.__br.session().riders.filter((r) => !r.isPlayer).map((r) => r.id));
  const [r1, r2, r3] = ids;
  // the slipper's target must not be the capybara: its chill aura stops the player's swings (and throws)
  const r4 = await page.evaluate(() => window.__br.session().riders.find((r) => !r.isPlayer && ['cat', 'shiba', 'seagull', 'goose', 'pigeon'].includes(r.character) && r.id > 3)?.id ?? 4);
  const cb = (fn, args) => page.evaluate(([f, a]) => new Function('c', 'a', f)(window.__br.combat, a), [fn, args]);
  /** Send a rider a case let go far ahead again (an unpinned rider stays right next to the player). */
  const park = (id) => page.evaluate((i) => { const b = window.__br; b.teleport(i, b.session().player.s + 500, 0); }, id);
  const rider = (id) => page.evaluate((i) => { const r = window.__br.session().rider(i); return { hp: r.hp, sp: r.sp, coins: r.coins, weapon: r.weapon, statuses: r.statuses.map((s) => s.id), action: r.action?.kind ?? null }; }, id);
  // park everyone far AHEAD (they race away) except who a case pins next to the player
  await page.evaluate((list) => { const b = window.__br, s = b.session(); list.forEach((id, i) => b.teleport(id, s.player.s + 500 + i * 12, 0)); }, ids);
  await cb('c.clearItems(); c.force({ crit: false })', null);
  await hold(page, C, 20);

  // 1. saltfish boomerang: a throw that hits nothing comes back to the hand
  await cb('c.give(0, "saltfish", 8); c.resetCooldowns()', null);
  await clearEvents(page);
  await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
  await hold(page, { ...C, heavyHeld: true }, 20);
  await hold(page, { throttle: 0, brake: 1, heavyHeld: false }, 150);
  let me = await rider(0);
  expect((await events(page, 'combat:throw')).length === 1 && me.weapon === 'saltfish', `saltfish boomerang: thrown at nothing while braking, back in the hand (${me.weapon})`);
  await hold(page, C, 60);

  // 2. baguette: every heavy hit knocks the victim's weapon loose
  let loose = 0;
  for (let i = 0; i < 4; i++) {
    // the victim's hp is topped up: a KO would start the KO slow-mo (clock layer 'ko') under the parry test below
    await cb('c.pin(a[0], 0.2, 1.3); c.set(a[0], { hp: 100 }); c.give(a[0], "pan", 6); c.give(0, "baguette", 6); c.resetCooldowns(); c.force({ crit: false, block: false })', [r1]);
    await hold(page, C, 10);
    await cb('c.swing(0, 1, true)', null);
    await hold(page, C, 40);
    if ((await rider(r1)).weapon !== 'pan') loose++;
  }
  expect(loose === 4, `baguette: 4 of 4 heavy hits knock the pan loose (${loose})`);
  await cb('c.unpin(a[0])', [r1]);
  await park(r1);

  // 3. pan PARRY: a swing pressed just before a rival's heavy hit lands
  await page.evaluate(([a]) => { const b = window.__br; b.teleport(a, b.session().player.s, 1.3); }, [r2]);
  await cb('c.pin(a[0], 0.2, 1.3, false); c.give(0, "pan", 6); c.give(a[0], "none"); c.set(0, { hp: 100 }); c.resetCooldowns(); c.force({ crit: false, block: false })', [r2]);
  await hold(page, C, 20);
  await clearEvents(page);
  await cb('c.swing(a[0], -1, true)', [r2]);
  await hold(page, C, 3);
  await cb('c.swing(0, -1, false)', null); // away from the attacker: a parry, not a counter-hit
  await hold(page, C, 30);
  const parry = await events(page, 'combat:parry');
  me = await rider(0);
  const att = await rider(r2);
  expect(parry.some((x) => x.e.riderId === 0 && x.e.attacker === r2) && me.hp === 100, `pan parry: combat:parry, no damage (hp ${me.hp}, ${JSON.stringify(parry.map((x) => x.e))})`);
  expect(att.statuses.includes('stun'), `pan parry: the attacker is stunned (${JSON.stringify(att.statuses)})`);
  await cb('c.unpin(a[0])', [r2]);
  await park(r2);

  // 4. pan PARRY of a police baton: npc:strike right after the player's swing → npc:hit parried
  await cb('c.give(0, "pan", 6); c.set(0, { hp: 100 }); c.resetCooldowns()', null);
  await page.evaluate(() => { window.__br.session().player.invuln = 0; });
  await hold(page, C, 20);
  await clearEvents(page);
  await cb('c.swing(0, -1, false)', null);
  await hold(page, C, 4);
  await page.evaluate((p) => window.__br.app.bus.emit('npc:strike', { victim: 0, obstacleId: 900, damage: 10, knock: 4.2, side: 1, heavy: false, weapon: 'baton', pos: p, cause: 'police' }), P);
  await hold(page, C, 4);
  const nh = (await events(page, 'npc:hit')).map((x) => x.e);
  expect(nh.length === 1 && nh[0].parried === true && nh[0].damage === 0, `pan parries the baton: npc:hit {parried true, damage 0} (${JSON.stringify(nh)})`);
  expect((await events(page, 'combat:parry')).some((x) => x.e.riderId === 0 && x.e.obstacleId === 900), 'pan parries the baton: combat:parry names obstacle 900');

  // 5. leek: the 3rd hit within 1.2 s deals x1.5
  await cb('c.pin(a[0], 0.2, 1.3); c.give(a[0], "none"); c.set(a[0], { hp: 999 }); c.give(0, "leek", 10); c.resetCooldowns(); c.force({ crit: false, block: false })', [r3]);
  await hold(page, C, 60); // let the baton case's hit reaction finish (a reacting rider cannot swing)
  await clearEvents(page);
  for (let i = 0; i < 3; i++) { await cb('c.swing(0, 1, false)', null); await hold(page, C, 26); }
  const lk = (await events(page, 'combat:hit')).filter((x) => x.e.attacker === 0 && x.e.victim === r3).map((x) => x.e.damage);
  expect(lk.length === 3 && Math.abs(lk[2] - lk[0] * 1.5) < 0.6, `leek: hits ${JSON.stringify(lk)} — the third is x1.5`);

  // 6. selfie stick: a hit blinds the victim
  await cb('c.give(0, "selfie", 9); c.resetCooldowns()', null);
  await hold(page, C, 30);
  await cb('c.swing(0, 1, false)', null);
  await hold(page, C, 18);
  expect((await rider(r3)).statuses.includes('blind'), `selfie: the victim is blinded (${JSON.stringify((await rider(r3)).statuses)})`);
  await cb('c.unpin(a[0])', [r3]);
  await park(r3);

  // 7. slipper: thrown, it homes onto a rival well outside a normal throw's cone
  const throwAt = async (weapon) => {
    await page.evaluate(([id]) => { const b = window.__br; b.teleport(id, b.session().player.s + 20, b.session().player.x + 9); }, [r4]);
    await cb('c.pin(a[0], 20, 9); c.set(a[0], { hp: 999 }); c.give(0, a[1], 3); c.resetCooldowns()', [r4, weapon]);
    await hold(page, C, 10);
    await clearEvents(page);
    await hold(page, { ...C, heavy: true, heavyHeld: true }, 1);
    await hold(page, { ...C, heavyHeld: true }, 20);
    await hold(page, { ...C, heavyHeld: false }, 100);
    return (await events(page, 'combat:hit')).some((x) => x.e.attacker === 0 && x.e.victim === r4);
  };
  const leekHit = await throwAt('leek');
  const slipperHit = await throwAt('slipper');
  expect(!leekHit && slipperHit, `slipper homes (leek ${leekHit ? 'hit' : 'missed'}, slipper ${slipperHit ? 'hit' : 'missed'} a rival 20 m ahead, 9 m aside)`);
  await cb('c.unpin(a[0]); c.clearItems()', [r4]);
  await park(r4);

  // 8. keyboard: about a 25 % crit chance (other weapons 10 %)
  await cb('c.force(null); c.pin(a[0], 0.2, 1.3); c.give(a[0], "none"); c.set(a[0], { hp: 99999 })', [r1]);
  await clearEvents(page);
  for (let i = 0; i < 120; i++) {
    // combo reset each time: ONE MORE! would force crits and hide the weapon's own chance
    await page.evaluate(() => { const p = window.__br.session().player; p.combo = 0; p.comboTimer = 0; });
    await cb('c.give(0, "keyboard", 5); c.resetCooldowns(); c.swing(0, 1, false)', null);
    await hold(page, C, 34);
  }
  const kb = (await events(page, 'combat:hit')).filter((x) => x.e.attacker === 0 && x.e.weapon === 'keyboard');
  const crits = kb.filter((x) => x.e.crit).length;
  expect(kb.length >= 100 && crits / kb.length >= 0.16 && crits / kb.length <= 0.36, `keyboard: ${crits} crits in ${kb.length} hits (want ~25 %)`);
  await cb('c.unpin(a[0])', [r1]);
  await park(r1);

  // 9. rewards: style:bank pays SP + coins; a trick landing pays SP 8 per trick
  await cb('c.set(0, { sp: 40 })', null);
  const before = await rider(0);
  await page.evaluate(() => window.__br.app.bus.emit('style:bank', { riderId: 0, total: 600, count: 3, sp: 6, coins: 2, broken: false }));
  await hold(page, C, 2);
  let after = await rider(0);
  expect(Math.abs(after.sp - before.sp - 6) < 0.01 && after.coins - before.coins === 2, `style:bank pays SP +6 and 2 coins (sp ${before.sp.toFixed(1)} → ${after.sp.toFixed(1)}, coins ${before.coins} → ${after.coins})`);
  await page.evaluate(() => window.__br.app.bus.emit('rider:trick', { riderId: 0, phase: 'land', kind: 'spin', count: 2, points: 290 }));
  await hold(page, C, 2);
  const after2 = await rider(0);
  expect(Math.abs(after2.sp - after.sp - 16) < 0.01, `a 2-trick landing pays SP +16 (${after.sp.toFixed(1)} → ${after2.sp.toFixed(1)})`);
  await noErrors(h, 'traits');
}, { size: '1280x720' });

finish('w2-traits');
