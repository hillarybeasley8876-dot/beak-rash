#!/usr/bin/env node
// r6 acceptance: online rooms end to end through the real screens (SPEC §28). Lead-owned, read-only for workers.
// A local relay, Alice on Chromium (host) and Bob on WebKit: 联机 on the menu → name → 创建房间 / 加入房间 by the code
// read off Alice's screen → 准备 → 开始比赛 → both race (scripted throttle, opposite steering) on the relay's ticks →
// the same hashes → Bob leaves through the pause menu → Alice's race goes on with Bob's bike as an AI rider.
//   node tools/r6/net-e2e.mjs [--port 8793] [--seconds 15] [--shots]
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const PORT = Number(a.port ?? 8793);
const SECONDS = Number(a.seconds ?? 15);
const RELAY = `ws://127.0.0.1:${PORT}/ws`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const relay = spawn('deno', ['run', '--allow-net', 'relay/main.ts', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
let relayLog = '';
relay.stdout.on('data', (d) => { relayLog += d; });
relay.stderr.on('data', (d) => { relayLog += d; });
const stopRelay = () => { try { relay.kill(); } catch { /* gone */ } if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(relay.pid), '/t', '/f'], { stdio: 'ignore' }); };
process.on('exit', stopRelay);
for (let i = 0; i < 60; i++) {
  if ((await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text()).catch(() => '')).includes('relay ok')) break;
  await sleep(250);
}

const shared = {};
const until = async (f, ms, step = 150) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await f(); if (v) return v; await sleep(step); } return null; };
const QUERY = `/?quality=low&relay=${encodeURIComponent(RELAY)}`;
const screenIs = (page, id, ms = 20000) => page.waitForFunction((x) => window.__br?.app?.ui?.screen === x && !window.__br.app.ui.busy, id, { timeout: ms }).then(() => true, () => false);
async function menuTo(page, cn) {
  for (let i = 0; i < 16; i++) {
    const at = await page.evaluate((cn) => { const items = [...document.querySelectorAll('.br-menu-item')]; return { cur: items.findIndex((e) => e.classList.contains('is-focus')), want: items.findIndex((e) => (e.textContent ?? '').includes(cn)) }; }, cn);
    if (at.want < 0) return false;
    if (at.cur === at.want) break;
    await page.keyboard.press(at.cur < at.want ? 'ArrowDown' : 'ArrowUp'); await sleep(120);
  }
  await page.keyboard.press('Enter');
  return true;
}
async function nameAndGo(page, name) {
  await page.click('[data-net-name]', { timeout: 5000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.type(name);
}
const SNAP = () => {
  const s = window.__br.session();
  return s ? { time: +s.time.toFixed(2), phase: s.phase, local: s.config.online?.local ?? null, humans: s.humans.map((r) => r.id),
    x: s.riders.slice(0, 2).map((r) => +r.x.toFixed(2)), hashes: window.__br.net?.hashes?.() ?? [] } : null;
};
const shot = async (page, name) => { if (a.shots) await page.screenshot({ path: `shots/r6-net-e2e/${name}.png` }); };

const alice = withPage(async (page, h) => {
  await h.goto(QUERY + '&screen=menu', { timeout: 120000 });
  await screenIs(page, 'menu');
  await sleep(500);
  expect(await menuTo(page, '联机') && await screenIs(page, 'online'), 'Alice: 联机 on the menu opens the online screen');
  await nameAndGo(page, 'Alice');
  await page.click('[data-net-create]', { timeout: 5000 });
  const inLobby = await screenIs(page, 'lobby', 20000);
  expect(inLobby, 'Alice: 创建房间 connects to the relay and opens the lobby');
  await sleep(600);
  const code = await page.evaluate(() => (document.querySelector('[data-net-code]')?.textContent ?? '').match(/[A-HJKMNP-Z2-9]{4}/)?.[0] ?? null);
  expect(!!code, `Alice: the lobby shows the room code (${code})`);
  shared.code = code;
  await shot(page, 'alice-lobby');
  const bobIn = await until(() => page.evaluate(() => document.querySelectorAll('[data-net-member]').length === 2), 40000);
  expect(!!bobIn, 'Alice: Bob appears in the lobby');
  await page.click('[data-net-ready]', { timeout: 5000 });
  const allReady = await until(() => page.evaluate(() => !document.querySelector('[data-net-start]')?.classList.contains('is-disabled')), 30000);
  expect(!!allReady, 'Alice: with both ready the host\'s 开始比赛 is enabled');
  await shot(page, 'alice-ready');
  await page.click('[data-net-start]', { timeout: 5000 });
  const racing = await until(() => page.evaluate(() => window.__br.app.ui.screen === 'race' && (window.__br.session()?.time ?? 0) > 0.5), 120000, 300);
  expect(!!racing, 'Alice: the race loads and runs on the relay\'s ticks');
  await page.evaluate(() => window.__br.setControls({ throttle: 1, steer: -0.5 }));
  shared.aliceRacing = true;
  await until(() => shared.bobRacing, 60000);
  await sleep(SECONDS * 1000);
  await shot(page, 'alice-race');
  shared.snapA = await page.evaluate(SNAP);
  await until(() => shared.bobLeft, 60000);
  await sleep(3000);
  const after = await page.evaluate(SNAP);
  expect(after && after.humans.length === 1 && after.time > shared.snapA.time + 1.5, `Alice: after Bob leaves her race goes on, Bob's bike is an AI rider (humans ${JSON.stringify(after?.humans)}, ${shared.snapA?.time} → ${after?.time} s)`);
  await noErrors(h, 'alice');
}, { size: '1280x720', browser: 'chromium' });

const bob = withPage(async (page, h) => {
  await h.goto(QUERY + '&screen=menu', { timeout: 120000 });
  await screenIs(page, 'menu');
  const code = await until(() => shared.code, 60000);
  await sleep(500);
  await menuTo(page, '联机');
  await screenIs(page, 'online');
  await nameAndGo(page, 'Bob');
  await page.click('[data-net-code-input]', { timeout: 5000 });
  await page.keyboard.type((code ?? '').toLowerCase());
  await page.click('[data-net-join]', { timeout: 5000 });
  expect(await screenIs(page, 'lobby', 20000), `Bob: 加入房间 with the code opens the lobby (${code})`);
  await sleep(500);
  await page.click('[data-net-ready]', { timeout: 5000 });
  await shot(page, 'bob-lobby');
  const racing = await until(() => page.evaluate(() => window.__br.app.ui.screen === 'race' && (window.__br.session()?.time ?? 0) > 0.5), 120000, 300);
  expect(!!racing, 'Bob: the same race loads and runs');
  await page.evaluate(() => window.__br.setControls({ throttle: 1, steer: 0.5 }));
  shared.bobRacing = true;
  await until(() => shared.snapA, (SECONDS + 90) * 1000, 200);
  const B = await page.evaluate(SNAP), A = shared.snapA;
  await shot(page, 'bob-race');
  expect(A?.local === 0 && B?.local === 1, `each client rides its own human (Alice ${A?.local}, Bob ${B?.local})`);
  expect(A && B && A.x[0] < A.x[1] && B.x[0] < B.x[1], `each player's steering moves their own rider on both screens (Alice sees ${JSON.stringify(A?.x)}, Bob sees ${JSON.stringify(B?.x)})`);
  const ha = new Map((A?.hashes ?? []).map((x) => [x.tick, x.h])), hb = (B?.hashes ?? []).filter((x) => ha.has(x.tick));
  const same = hb.filter((x) => ha.get(x.tick) === x.h).length;
  expect(hb.length >= 6 && same === hb.length, `the two clients compute the same race (${same} of ${hb.length} common hashes equal)`);
  const tags = await page.evaluate(() => [...document.querySelectorAll('.nt-name')].map((e) => e.textContent));
  expect(tags.includes('Alice'), `Bob sees Alice's name over her bike (${JSON.stringify(tags.slice(0, 6))})`);
  // Bob leaves: pause → 离开联机 → confirm
  await page.keyboard.press('Escape');
  await screenIs(page, 'pause', 10000);
  await sleep(400);
  const leave = await page.evaluate(() => [...document.querySelectorAll('.br-pause-item, [role="button"]')].findIndex((e) => (e.textContent ?? '').includes('离开联机')));
  if (leave >= 0) await page.evaluate((i) => [...document.querySelectorAll('.br-pause-item, [role="button"]')][i].click(), leave);
  await sleep(500);
  const yes = await page.evaluate(() => { const b = [...document.querySelectorAll('.br-modal [role="button"], .br-modal button')].find((e) => (e.textContent ?? '').includes('离开')); if (b) { b.click(); return true; } return false; });
  const toMenu = await screenIs(page, 'menu', 15000);
  expect(leave >= 0 && yes && toMenu, `Bob leaves through the pause menu (离开联机 → 离开) and lands on the menu (${leave}, ${yes}, ${toMenu})`);
  shared.bobLeft = true;
  await noErrors(h, 'bob');
}, { size: '1280x720', browser: 'webkit' });

await Promise.all([alice, bob]).catch((err) => expect(false, `both players ran to the end (${String(err.message).split('\n')[0]})`));
stopRelay();
console.log(`relay log (last lines):\n${relayLog.split('\n').slice(-10).join('\n')}`);
finish('r6-net-e2e');
