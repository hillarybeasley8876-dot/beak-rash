#!/usr/bin/env node
// r6 acceptance: an online race is the same race on every client (SPEC §28 determinism contract). Lead-owned,
// read-only for workers. Three clients of one 3-human online race — Chromium at high quality as human 0 rendering
// every tick, Chromium at low quality as human 2 rendering every other tick, WebKit at medium quality as human 1 —
// are fed the same relay ticks (every human's controls per tick, integer-scripted; human 2 leaves at tick 1500 and
// an AI takes over). The game loop runs as in a real online race (core/game.ts → app.net.frame → session.tick, the
// views, camera, fx, HUD and audio every frame); session.hash() after every 60th tick must match on all three.
//   node tools/r6/net-det.mjs [--ticks 3000] [--track coast]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TICKS = Number(a.ticks ?? 3000);
const TRACK = String(a.track ?? 'coast');
const LEAVE_AT = 1500;
const L = (s1, s2, s3, ult) => ({ slots: [s1, s2, s3], ult });
const HUMANS = [
  { slot: 0, member: 11, name: 'Alice', character: 'pelican', bike: 'roadbike', loadout: L('pelican.torpedo', 'pelican.gulp', 'pelican.wing', 'pelican.ult') },
  { slot: 1, member: 12, name: 'Bob', character: 'moodeng', bike: 'mtb', loadout: L('moodeng.bounce', 'pool.watergun', 'pool.icelance', 'ult.storm') },
  { slot: 2, member: 13, name: 'Cat', character: 'hamster', bike: 'kidbike', loadout: L('hamster.violin', 'pool.pie', 'pool.thunder', 'ult.meteor') },
];

/** In-page: start the online race as `local`, feed TICKS scripted ticks through app.net.frame, `per` ticks a frame. */
async function race({ ticks, track, local, per, humans, leaveAt }) {
  const br = window.__br;
  br.manual(true);
  await br.start({ trackId: track, seed: 90210, rivals: ['goose', 'cat', 'capybara', 'shiba', 'pigeon'], traffic: true,
    online: { room: 'DET1', local, humans } });
  const s = br.session();
  const empty = { steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false, hop: false, attackL: false, attackR: false, heavy: false,
    skill1: false, skill2: false, skill3: false, ult: false, bell: false, heavyHeld: false };
  // integer-only scripts (no Math.sin: the inputs must be the same bits on every engine, like the relay's)
  const tri = (t, p) => { const m = t % p; return (m < p / 2 ? m : p - m) - p / 4; };
  const inputs = (t) => humans.map((h, i) => ({
    ...empty,
    steer: Math.round((tri(t + 37 * i, 180 + 40 * i) * 127) / 120) / 127,
    throttle: t % 600 < 540 ? 1 : 102 / 255,
    drift: i === 1 && t % 400 > 300,
    hop: t % 250 === 70 + i, attackL: t % 97 === 13 + i, attackR: t % 89 === 41 + i, heavy: t % 211 === 100 + i,
    skill1: t % 360 === 180 + 7 * i, skill2: t % 420 === 240 + 5 * i, skill3: t % 480 === 300 + 3 * i, ult: t % 900 === 600 + i,
  }));
  const hashes = [];
  let t = 0;
  const net = br.app.net;
  const frame0 = net.frame;
  net.frame = () => {
    let n = 0;
    for (; n < per && t < ticks; n++, t++) {
      s.tick(inputs(t), t === leaveAt ? [2] : []);
      if (t % 60 === 59) hashes.push(s.hash());
    }
    return n;
  };
  try {
    while (t < ticks) br.step(1, per / 60);
  } finally {
    net.frame = frame0;
  }
  return { hashes, phase: s.phase, humans: s.humans.map((r) => r.id), player: s.player.id, s: s.riders.map((r) => Math.round(r.s)) };
}

const run = (browser, quality, local, per) => withPage(async (page, h) => {
  await h.goto(`/?screen=menu&quality=${quality}`, { timeout: 120000 });
  const r = await page.evaluate(race, { ticks: TICKS, track: TRACK, local, per, humans: HUMANS, leaveAt: LEAVE_AT });
  await noErrors(h, `${browser} ${quality} local ${local}`);
  return r;
}, { size: '960x540', browser });

const A = await run('chromium', 'high', 0, 1);
const B = await run('chromium', 'low', 2, 2);
const C = await run('webkit', 'medium', 1, 1);
const firstDiff = (x, y) => { const i = x.hashes.findIndex((v, k) => v !== y.hashes[k]); return i < 0 && x.hashes.length === y.hashes.length ? null : (i + 1) * 60; };
expect(A.hashes.length === Math.floor(TICKS / 60) && A.phase !== 'intro', `the online race runs ${TICKS} ticks (${A.hashes.length} hashes, phase ${A.phase}, riders at ${A.s.join(' ')})`);
const ab = firstDiff(A, B), ac = firstDiff(A, C);
expect(ab === null, `another human's client at low quality, rendering every other tick, computes the same race (first different hash after tick ${ab})`);
expect(ac === null, `a WebKit client computes the same race as Chromium (first different hash after tick ${ac})`);
expect(A.player === 0 && B.player === 2 && C.player === 1, `each client rides its own human (session.player ${A.player} / ${B.player} / ${C.player})`);
expect(JSON.stringify(A.humans) === '[0,1]' && JSON.stringify(B.humans) === '[0,1]', `the human who left at tick ${LEAVE_AT} is an AI rider afterwards on every client (humans ${JSON.stringify(A.humans)})`);
finish('r6-net-det');
