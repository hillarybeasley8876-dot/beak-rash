#!/usr/bin/env node
// r4 acceptance: w1-sim-tricks (SPEC §16 air tricks, §15 umbrella glide, §20 Track.grip). Lead-owned, read-only for
// workers. Air is forced by setting the player's vy (the sim starts a 'launch' air episode, gravity 17 m/s²).
//   node tools/r4/w1-tricks.mjs
import { capture, clearEvents, events, expect, finish, hold, noErrors, race, withPage } from './accept-lib.mjs';

const C = { throttle: 1 };
const AIR = (vy) => `(() => { const p = window.__br.session().player; p.y = 0.1; p.vy = ${vy}; })()`;
const st = (page) => page.evaluate(() => { const p = window.__br.session().player; return { y: p.y, air: p.airborne, trick: p.trick ? { ...p.trick } : null, chain: p.trickChain, mode: p.mode, boost: p.boostTime }; });

/** Fly with vy, run `script` = list of [controls, frames] from take-off, then step until landed (max 3 s). */
async function fly(page, vy, script) {
  await hold(page, C, 30);
  await page.evaluate(AIR(vy));
  for (const [c, n] of script) await hold(page, { ...C, ...c }, n);
  for (let i = 0; i < 18; i++) {
    const s = await st(page);
    if (!s.air) break;
    await hold(page, C, 10);
  }
  await hold(page, C, 6);
}

await withPage(async (page, h) => {
  await race(page, h, { track: 'coast', seed: 3 });
  await capture(page, ['rider:trick', 'rider:crash', 'rider:boost', 'rider:land']);
  const mine = (ev) => ev.filter((x) => (x.e.riderId ?? 0) === 0);

  // 1. spin: fresh drift press + steer right, 0.33 s after take-off, lands clean
  await clearEvents(page);
  let mid = null;
  await hold(page, C, 30);
  await page.evaluate(AIR(8));
  await hold(page, C, 20);
  await hold(page, { ...C, drift: true, steer: 1 }, 6);
  mid = await st(page);
  await hold(page, { ...C, drift: false }, 10);
  await fly(page, 0, []);
  let ev = mine(await events(page, 'rider:trick'));
  expect(mid.trick?.kind === 'spin' && mid.trick?.dir === 1, `spin: RiderState.trick is a right spin mid-air (${JSON.stringify(mid.trick)})`);
  expect(ev.some((x) => x.e.phase === 'start' && x.e.kind === 'spin'), 'spin: rider:trick start');
  const land1 = ev.find((x) => x.e.phase === 'land');
  expect(!!land1 && land1.e.count === 1 && land1.e.points === 120, `spin: rider:trick land {count 1, points 120} (${JSON.stringify(land1?.e)})`);
  expect(!(await events(page, 'rider:crash')).some((x) => x.e.riderId === 0), 'spin: no crash');
  expect((await events(page, 'rider:boost')).some((x) => x.e.riderId === 0), 'spin: the landing gives a boost');
  expect((await st(page)).trick === null && (await st(page)).chain === 0, 'spin: trick state cleared on the ground');

  // 2. backflip: drift + brake
  await clearEvents(page);
  await fly(page, 8, [[{}, 20], [{ drift: true, brake: 1, throttle: 0 }, 6], [{ drift: false }, 4]]);
  ev = mine(await events(page, 'rider:trick'));
  expect(ev.some((x) => x.e.phase === 'start' && x.e.kind === 'backflip') && ev.some((x) => x.e.phase === 'land'), `backflip: drift + brake (${JSON.stringify(ev.map((x) => [x.e.phase, x.e.kind]))})`);

  // 3. frontflip: drift + hop
  await clearEvents(page);
  await fly(page, 8, [[{}, 20], [{ drift: true, hop: true }, 1], [{ drift: true }, 5], [{ drift: false }, 4]]);
  ev = mine(await events(page, 'rider:trick'));
  expect(ev.some((x) => x.e.phase === 'start' && x.e.kind === 'frontflip') && ev.some((x) => x.e.phase === 'land'), `frontflip: drift + hop (${JSON.stringify(ev.map((x) => [x.e.phase, x.e.kind]))})`);

  // 4. superman: drift alone, released before landing
  await clearEvents(page);
  await fly(page, 8, [[{}, 20], [{ drift: true }, 24], [{ drift: false }, 4]]);
  ev = mine(await events(page, 'rider:trick'));
  expect(ev.some((x) => x.e.kind === 'superman' && x.e.phase === 'start') && ev.some((x) => x.e.phase === 'land'), `superman: drift alone, released in time (${JSON.stringify(ev.map((x) => [x.e.phase, x.e.kind]))})`);

  // 5. superman still held at touchdown → crash 'trick'
  await clearEvents(page);
  await fly(page, 8, [[{}, 20], [{ drift: true }, 80]]);
  ev = mine(await events(page, 'rider:trick'));
  let crash = (await events(page, 'rider:crash')).filter((x) => x.e.riderId === 0);
  expect(ev.some((x) => x.e.phase === 'fail') && crash.some((x) => x.e.cause === 'trick'), `superman held into the ground: fail + crash 'trick' (${JSON.stringify(crash.map((x) => x.e.cause))})`);
  await hold(page, C, 260);

  // 6. unfinished spin at touchdown → crash 'trick'
  await clearEvents(page);
  await fly(page, 5, [[{}, 16], [{ drift: true, steer: -1 }, 4], [{ drift: false, steer: 0 }, 2]]);
  crash = (await events(page, 'rider:crash')).filter((x) => x.e.riderId === 0);
  expect(crash.some((x) => x.e.cause === 'trick'), `short air: an unfinished spin crashes with cause 'trick' (${JSON.stringify(crash.map((x) => x.e.cause))})`);
  await hold(page, C, 260);

  // 7. chain: two spins in one big air → count 2, points 120*2 + 50
  await clearEvents(page);
  await fly(page, 13, [[{}, 16], [{ drift: true, steer: 1 }, 4], [{ drift: false, steer: 0 }, 30], [{ drift: true, steer: 1 }, 4], [{ drift: false, steer: 0 }, 4]]);
  ev = mine(await events(page, 'rider:trick'));
  const land2 = ev.find((x) => x.e.phase === 'land');
  expect(!!land2 && land2.e.count === 2 && land2.e.points === 290, `chain: two spins land {count 2, points 290} (${JSON.stringify(land2?.e)})`);

  // 8. drift held from the ground never starts a trick
  await clearEvents(page);
  await hold(page, { ...C, drift: true }, 20);
  await page.evaluate(AIR(8));
  await hold(page, { ...C, drift: true }, 40);
  await hold(page, { ...C, drift: false }, 30);
  await fly(page, 0, []);
  ev = mine(await events(page, 'rider:trick'));
  expect(!ev.some((x) => x.e.phase === 'start'), `drift held from the ground: no trick (${ev.length})`);

  // 9. umbrella glide: drift in the air with an umbrella floats (longer air), no trick
  const airTime = async (glide) => {
    await page.evaluate((u) => window.__br.combat.give(0, u ? 'umbrella' : 'none'), glide);
    await clearEvents(page);
    await fly(page, 8, glide ? [[{}, 10], [{ drift: true }, 150]] : [[{}, 10]]);
    await hold(page, { ...C, drift: false }, 2);
    const land = mine(await events(page, 'rider:land'));
    const tr = mine(await events(page, 'rider:trick'));
    return { air: land.length ? land[land.length - 1].e.airTime : 0, tricks: tr.length };
  };
  const plain = await airTime(false);
  const glide = await airTime(true);
  expect(glide.air > plain.air * 1.4 && glide.tricks === 0, `umbrella glide: air ${plain.air.toFixed(2)} s → ${glide.air.toFixed(2)} s, no trick (${glide.tricks})`);
  await page.evaluate(() => window.__br.combat.give(0, 'none'));

  // 10. Track.grip scales lateral grip
  const lateral = async (grip) => {
    await page.evaluate((g) => { window.__br.session().track.grip = g; }, grip);
    await hold(page, { ...C, steer: 0 }, 60);
    await hold(page, { ...C, steer: 1 }, 4);
    const vx = await page.evaluate(() => window.__br.session().player.vx);
    await hold(page, { ...C, steer: -1 }, 4);
    await hold(page, { ...C, steer: 0 }, 60);
    return vx;
  };
  const vx1 = await lateral(1);
  const vx05 = await lateral(0.5);
  await page.evaluate(() => { window.__br.session().track.grip = 1; });
  expect(vx05 < vx1 * 0.8, `Track.grip 0.5 slows the lateral response (vx after 4 frames ${vx1.toFixed(2)} → ${vx05.toFixed(2)})`);
  await noErrors(h, 'tricks');
}, { size: '1280x720' });

finish('w1-tricks');
