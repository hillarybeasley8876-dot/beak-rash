#!/usr/bin/env node
// r4 acceptance: w3-audio (sounds for every r4 event, the two new race songs). Lead-owned, read-only for workers.
// Reads window.__br.audio.trace() (sfx / voice / bark / sting entries with performance.now() ms) and .state().song.
//   node tools/r4/w3-audio.mjs
import { expect, finish, noErrors, withPage } from './accept-lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = { x: 0, y: 1, z: 0 };

await withPage(async (page, h) => {
  await h.goto('/?race=coast&seed=3&traffic=0&police=0');
  await page.evaluate(() => window.__br.audio.unlock());
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__br.session()?.phase === 'racing', null, { timeout: 60000 });
  await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 700 + r.id * 12, 0); });
  // every new event must make a sound within 400 ms (positions: just ahead of the camera)
  const cases = [
    ['police:wanted ★3', 'police:wanted', { riderId: 0, level: 3, prev: 2 }],
    ['police:windup', 'police:windup', { riderId: 0, obstacleId: 900, side: 1, pos: P, time: 0.45 }],
    ['police:swing', 'police:swing', { riderId: 0, obstacleId: 900, side: 1, pos: P, hit: false }],
    ['npc:hit (baton)', 'npc:hit', { victim: 0, obstacleId: 900, damage: 10, blocked: false, parried: false, side: 1, weapon: 'baton', pos: P }],
    ['police:roadblock', 'police:roadblock', { riderId: 0, s: 900, gapX: 2, gapWidth: 3.2, pos: P }],
    ['police:down', 'police:down', { obstacleId: 900, attacker: 0, pos: P }],
    ['police:bribe', 'police:bribe', { riderId: 0, obstacleId: 900, amount: 50, accepted: true }],
    ['combat:parry', 'combat:parry', { riderId: 0, attacker: null, obstacleId: 900, weapon: 'pan', pos: P }],
    ['combat:throw', 'combat:throw', { riderId: 0, weapon: 'slipper', dir: 1, pos: P, projectileId: 1 }],
    ['rider:trick start', 'rider:trick', { riderId: 0, phase: 'start', kind: 'spin', count: 1, points: 0 }],
    ['rider:trick land', 'rider:trick', { riderId: 0, phase: 'land', kind: 'spin', count: 2, points: 290 }],
    ['style:bank', 'style:bank', { riderId: 0, total: 1200, count: 5, sp: 12, coins: 4, broken: false }],
    ['race:nemesis', 'race:nemesis', { riderId: 1, character: 'goose', grudge: 80 }],
    ['race:alliance form', 'race:alliance', { phase: 'form', members: [1, 2], target: 0, reason: 'leader' }],
    ['race:event warn', 'race:event', { kind: 'fishSpill', phase: 'warn', s: 900, pos: P }],
    ['secret:found duck', 'secret:found', { id: 'duck_coast', riderId: 0, pos: P, first: true }],
  ];
  for (const [label, name, payload] of cases) {
    const t0 = await page.evaluate(([n, p]) => { const t = performance.now(); window.__br.app.bus.emit(n, p); return t; }, [name, payload]);
    await sleep(450);
    const got = await page.evaluate((t) => window.__br.audio.trace().filter((e) => e.ms >= Math.floor(t)).map((e) => `${e.kind}:${e.id}`), t0);
    expect(got.length > 0, `${label} → a sound (${got.slice(0, 3).join(', ') || 'none'})`);
    await sleep(250);
  }
  const parry = await page.evaluate(() => window.__br.audio.trace().some((e) => /parry|clang|pan/.test(e.id)));
  expect(parry, 'the parry has its own metallic sound (an id with parry / clang / pan)');
  const quack = await page.evaluate(() => window.__br.audio.trace().some((e) => /quack|duck/.test(e.id)));
  expect(quack, 'a found duck quacks (an id with quack / duck)');
  await noErrors(h, 'r4 sounds');
}, { size: '960x540' });

// the new tracks have their own race songs
for (const id of ['watertown', 'gobi']) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=3&traffic=0&police=0`);
    await page.evaluate(() => window.__br.audio.unlock());
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__br.session()?.phase === 'racing', null, { timeout: 60000 });
    await sleep(4000);
    const song = await page.evaluate(() => window.__br.audio.state().song);
    expect(song === `race-${id}`, `${id}: its own race song plays (${song})`);
    await noErrors(h, `${id} song`);
  }, { size: '960x540' });
}

finish('w3-audio');
