#!/usr/bin/env node
// r4 acceptance: w1-style (SPEC §17 STYLE chains). Lead-owned, read-only for workers. Feeds bus events by hand (combat
// stubbed, traffic/police off, rivals parked far behind) and checks the chain arithmetic, banking and save.
//   node tools/r4/w1-style.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 0.6 };

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3, extra: '&traffic=0&police=0&stub=combat' });
  // Rivals far AHEAD (they ride faster than this throttle): no draft, slingshot or rider near miss reaches the player.
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 500 + r.id * 12, (r.id % 3) - 1); });
  await hold(page, C, 30);
  await capture(page, ['style:chain', 'style:bank']);
  const emit = (name, payload) => page.evaluate(([n, p]) => window.__br.app.bus.emit(n, p), [name, payload]);
  const P = { x: 0, y: 1, z: 0 };

  // 1. a chain of three kinds with a same-kind repeat, banked by the 3 s timeout
  await emit('rider:nearMiss', { riderId: 0, kind: 'traffic' });
  await hold(page, C, 30);
  let ch = (await events(page, 'style:chain')).map((x) => x.e);
  expect(ch.length === 1 && ch[0].points === 60 && ch[0].total === 60 && ch[0].mult === 1 && ch[0].count === 1 && ch[0].riderId === 0,
    `near miss starts a chain {points 60, total 60, mult 1, count 1} (${JSON.stringify(ch)})`);
  await emit('rider:land', { riderId: 0, airTime: 0.6, perfect: true });
  await hold(page, C, 30);
  await emit('rider:nearMiss', { riderId: 0, kind: 'rider' });
  await hold(page, C, 30);
  await emit('rider:nearMiss', { riderId: 0, kind: 'traffic' });
  await hold(page, C, 10);
  ch = (await events(page, 'style:chain')).map((x) => x.e);
  const last = ch[ch.length - 1];
  expect(ch.length === 4, `four actions extend the chain (${ch.length})`);
  expect(!!last && last.total === 230 && last.mult === 1.25 && last.count === 4,
    `variety ×1.25, a back-to-back repeat scores half: total 60+80+60+30 = 230 (${JSON.stringify(last)})`);
  expect(!(await events(page, 'style:bank')).length, 'no bank while the chain is alive');
  await hold(page, C, 200);
  let bank = (await events(page, 'style:bank')).map((x) => x.e);
  expect(bank.length === 1 && bank[0].total === 288 && bank[0].count === 4 && bank[0].sp === 2 && bank[0].coins === 1 && bank[0].broken === false,
    `3 s idle banks {total round(230×1.25)=288, count 4, sp 2, coins 1, broken false} (${JSON.stringify(bank)})`);
  const best = await page.evaluate(() => window.__br.app.save.data.stats.bestStyle);
  expect(best >= 288, `save.stats.bestStyle keeps the best bank (${best})`);

  // 2. drift L3 boost then a hit taken: the chain banks at once, broken
  await clearEvents(page);
  await emit('rider:boost', { riderId: 0, kind: 'drift', power: 0.35, time: 1.3 });
  await hold(page, C, 20);
  await emit('combat:hit', { attacker: 3, victim: 0, damage: 8, side: 1, weapon: 'none', heavy: false, crit: false, blocked: false, pos: P, skillId: null });
  await hold(page, C, 5);
  ch = (await events(page, 'style:chain')).map((x) => x.e);
  bank = (await events(page, 'style:bank')).map((x) => x.e);
  expect(ch.length === 1 && ch[0].points === 180, `drift L3 boost = 180 (${JSON.stringify(ch.map((c) => c.points))})`);
  expect(bank.length === 1 && bank[0].broken === true && bank[0].total === 180, `a hit taken banks the chain as broken (${JSON.stringify(bank)})`);

  // 3. other riders' events and blocked hits do not count / do not break
  await clearEvents(page);
  await emit('rider:nearMiss', { riderId: 2, kind: 'traffic' });
  await emit('combat:ko', { attacker: 2, victim: 4, cause: 'ko', pos: P, skillId: null, weapon: 'none' });
  await hold(page, C, 5);
  expect(!(await events(page, 'style:chain')).length, 'events of other riders are ignored');
  await emit('combat:ko', { attacker: 0, victim: 4, cause: 'ko', pos: P, skillId: null, weapon: 'pan' });
  await hold(page, C, 5);
  await emit('combat:hit', { attacker: 3, victim: 0, damage: 0, side: 1, weapon: 'none', heavy: false, crit: false, blocked: true, pos: P, skillId: null });
  await hold(page, C, 5);
  ch = (await events(page, 'style:chain')).map((x) => x.e);
  bank = (await events(page, 'style:bank')).map((x) => x.e);
  expect(ch.length === 1 && ch[0].points === 200 && bank.length === 0, `a KO scores 200; a blocked hit does not break the chain (${JSON.stringify({ ch: ch.map((c) => c.points), bank })})`);

  // 4. tricks pay their own points; a crash banks broken
  await emit('rider:trick', { riderId: 0, phase: 'land', kind: 'spin', count: 2, points: 290 });
  await hold(page, C, 5);
  await emit('rider:crash', { riderId: 0, cause: 'wall', speed: 20, pos: P, attacker: null });
  await hold(page, C, 5);
  ch = (await events(page, 'style:chain')).map((x) => x.e);
  bank = (await events(page, 'style:bank')).map((x) => x.e);
  expect(ch.length === 2 && ch[1].points === 290 && ch[1].mult === 1.25, `a landed 2-trick air adds its 290 points, ×1.25 (${JSON.stringify(ch[1])})`);
  expect(bank.length === 1 && bank[0].broken && bank[0].total === Math.round((200 + 290) * 1.25), `a crash banks broken: round(490×1.25) (${JSON.stringify(bank)})`);
  await noErrors(h, 'style');
}, { size: '1280x720' });

finish('w1-style');
