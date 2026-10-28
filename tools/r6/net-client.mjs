#!/usr/bin/env node
// r6 acceptance: the net client (SPEC §28 — 联机), without the lobby UI. Lead-owned, read-only for workers. Starts the
// relay, opens two game clients (Chromium as Alice, WebKit as Bob) and drives them through window.__br.app.net (the
// NetSystem contract in src/core/contracts.ts): connect, a room, picks, ready, the host's start, the race on relay
// ticks with each client's own (scripted) input, a skill press that the other client sees, the state hashes, and a
// human leaving mid-race (an AI takes the bike over).
//   node tools/r6/net-client.mjs [--port 8792] [--seconds 20]
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const PORT = Number(a.port ?? 8792);
const SECONDS = Number(a.seconds ?? 20);
const RELAY = `ws://127.0.0.1:${PORT}/ws`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const relay = spawn('deno', ['run', '--allow-net', 'relay/main.ts', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
let relayLog = '';
relay.stdout.on('data', (d) => { relayLog += d; });
relay.stderr.on('data', (d) => { relayLog += d; });
const stopRelay = () => { try { relay.kill(); } catch { /* gone */ } if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(relay.pid), '/t', '/f'], { stdio: 'ignore' }); };
process.on('exit', stopRelay);
for (let i = 0; i < 60; i++) {
  const ok = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text()).catch(() => '');
  if (ok.includes('relay ok')) break;
  await sleep(250);
}

/** Shared between the two pages: each side posts what the other waits for. */
const shared = { code: null, bobJoined: false, raceA: false, raceB: false, bobGone: false, castSeenByB: false, pressAt: 0 };
const until = async (f, ms, step = 100) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; };
const L = (s1, s2, s3, ult) => ({ slots: [s1, s2, s3], ult });
const QUERY = `/?screen=menu&quality=low&relay=${encodeURIComponent(RELAY)}`;
/** In-page: a short snapshot of the online race. */
const SNAP = () => {
  const s = window.__br.session(), n = window.__br.net;
  return s ? { online: !!s.config.online, local: s.config.online?.local ?? null, humans: s.humans.map((r) => r.id), time: +s.time.toFixed(2), phase: s.phase,
    x: s.riders.slice(0, 2).map((r) => +r.x.toFixed(2)), screen: window.__br.app.ui.screen, hashes: n?.hashes?.() ?? [] } : null;
};

const alice = withPage(async (page, h) => {
  await h.goto(QUERY, { timeout: 120000 });
  const ok = await page.evaluate(() => window.__br.app.net.connect('Alice'));
  expect(ok === true, `Alice connects to the relay (connect → ${ok}; state ${await page.evaluate(() => window.__br.app.net.state)} ${await page.evaluate(() => window.__br.app.net.message)})`);
  await page.evaluate(() => window.__br.app.net.createRoom());
  const room = await until(() => page.evaluate(() => window.__br.app.net.room), 5000);
  expect(!!room && /^[A-Z2-9]{4}$/.test(room.code) && room.host === room.you, `createRoom → a room with a code, Alice is host (${JSON.stringify(room && { code: room.code, host: room.host, you: room.you })})`);
  shared.code = room?.code ?? null;
  await until(() => shared.bobJoined, 20000);
  const two = await until(() => page.evaluate(() => (window.__br.app.net.room?.members.length ?? 0) === 2), 5000);
  expect(!!two, 'Alice sees Bob join the room');
  await page.evaluate((L) => {
    const n = window.__br.app.net;
    n.pick({ character: 'pelican', bike: 'roadbike', loadout: L });
    n.setup({ trackId: 'coast', weather: null, reverse: false });
    n.ready(true);
  }, L('pelican.torpedo', 'pelican.gulp', 'pelican.wing', 'pelican.ult'));
  await until(() => page.evaluate(() => window.__br.app.net.room?.members.every((m) => m.ready)), 10000);
  await page.evaluate(() => window.__br.app.net.start());
  const racing = await until(() => page.evaluate(() => window.__br.app.ui.screen === 'race' && window.__br.session()?.phase !== 'intro' && !!window.__br.session()?.config.online), 90000, 250);
  expect(!!racing, 'Alice\'s client loads the online race and it runs (screen race, past the intro)');
  shared.raceA = true;
  await page.evaluate(() => window.__br.setControls({ throttle: 1, steer: -0.6 }));
  await until(() => shared.raceB, 60000);
  await sleep(SECONDS * 1000 * 0.6);
  shared.pressAt = Date.now();
  await page.evaluate(() => window.__br.press('skill1'));
  await sleep(SECONDS * 1000 * 0.4);
  const snapA = await page.evaluate(SNAP);
  shared.snapA = snapA;
  await until(() => shared.bobGone, 60000);
  await sleep(2500);
  const afterLeave = await page.evaluate(SNAP);
  expect(afterLeave?.humans.length === 1 && afterLeave.time > snapA.time + 1, `Bob leaves: Alice's race goes on and Bob's bike is an AI rider (humans ${JSON.stringify(afterLeave?.humans)}, time ${snapA?.time} → ${afterLeave?.time})`);
  await noErrors(h, 'alice');
}, { size: '960x540', browser: 'chromium' });

const bob = withPage(async (page, h) => {
  await h.goto(QUERY, { timeout: 120000 });
  await page.evaluate(() => window.__br.app.net.connect('Bob'));
  const code = await until(() => shared.code, 30000);
  await page.evaluate((c) => window.__br.app.net.joinRoom(c), code);
  const joined = await until(() => page.evaluate(() => (window.__br.app.net.room?.members.length ?? 0) === 2), 8000);
  expect(!!joined, `Bob joins the room by its code (${code})`);
  shared.bobJoined = true;
  await page.evaluate((L) => {
    const n = window.__br.app.net;
    n.pick({ character: 'moodeng', bike: 'mtb', loadout: L });
    n.ready(true);
  }, L('moodeng.bounce', 'pool.watergun', 'pool.icelance', 'ult.storm'));
  await page.evaluate(() => {
    window.__casts = [];
    window.__br.app.bus.on('skill:cast', (e) => window.__casts.push({ ...e, at: Date.now() }));
  });
  const racing = await until(() => page.evaluate(() => window.__br.app.ui.screen === 'race' && window.__br.session()?.phase !== 'intro' && !!window.__br.session()?.config.online), 90000, 250);
  expect(!!racing, 'Bob\'s client loads the same race');
  await page.evaluate(() => window.__br.setControls({ throttle: 1, steer: 0.6 }));
  shared.raceB = true;
  await until(() => shared.snapA, (SECONDS + 60) * 1000, 200);
  const snapB = await page.evaluate(SNAP);
  const casts = await page.evaluate(() => window.__casts.filter((e) => e.riderId === 0));
  const A = shared.snapA;
  expect(A?.local === 0 && snapB?.local === 1, `each client rides its own human (Alice slot ${A?.local}, Bob slot ${snapB?.local})`);
  expect(A && snapB && A.x[0] < A.x[1] && snapB.x[0] < snapB.x[1], `each client's input moves its own rider on both screens: Alice steers left, Bob right (Alice sees x ${JSON.stringify(A?.x)}, Bob sees ${JSON.stringify(snapB?.x)})`);
  expect(A && snapB && Math.abs(A.time - snapB.time) < 1.5 && A.time > SECONDS * 0.4, `both race clocks run together (${A?.time} s vs ${snapB?.time} s)`);
  const ha = new Map((A?.hashes ?? []).map((x) => [x.tick, x.h])), hb = (snapB?.hashes ?? []).filter((x) => ha.has(x.tick));
  const same = hb.filter((x) => ha.get(x.tick) === x.h).length;
  expect(hb.length >= 8 && same === hb.length, `the state hashes agree on every common tick (${same} of ${hb.length} equal; __br.net.hashes())`);
  expect(casts.length >= 1, `Alice's skill press shows on Bob's screen (skill:cast from rider 0: ${casts.length}, ${casts[0] ? casts[0].at - shared.pressAt : '-'} ms after the press)`);
  await noErrors(h, 'bob');
  shared.bobGone = true;   // the page closes when this function returns
}, { size: '960x540', browser: 'webkit' });

await Promise.all([alice, bob]).catch((err) => expect(false, `both clients ran to the end (${err.message})`));
stopRelay();
console.log(`relay log (last lines):\n${relayLog.split('\n').slice(-12).join('\n')}`);
finish('r6-net-client');
