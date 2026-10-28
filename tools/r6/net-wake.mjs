#!/usr/bin/env node
// r6 acceptance: a sleeping relay (SPEC §28 hosting). The relay runs on a free Render instance that sleeps after 15
// minutes without traffic and takes about a minute to wake: while it wakes, its address answers plain HTTP with a
// loading page and refuses WebSocket upgrades. Lead-owned, read-only for workers. A stand-in plays that part on the
// relay's port for a few seconds (HTTP 503 to GET /, upgrades refused), then the real relay takes over. The client
// must keep trying, say so in Chinese (唤醒), poke the HTTP root to wake the host, connect once the relay is up, give
// up after ?relayWait ms, and stop at once when the player leaves.
//   node tools/r6/net-wake.mjs [--port 8794]
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const PORT = Number(a.port ?? 8794);
const RELAY = `ws://127.0.0.1:${PORT}/ws`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let relay = null;
const stopRelay = () => {
  if (!relay) return;
  try { relay.kill(); } catch { /* gone */ }
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(relay.pid), '/t', '/f'], { stdio: 'ignore' });
  relay = null;
};
process.on('exit', stopRelay);
const startRelay = async () => {
  relay = spawn('deno', ['run', '--allow-net', 'relay/main.ts', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 60; i++) {
    if ((await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text()).catch(() => '')).includes('relay ok')) return true;
    await sleep(200);
  }
  return false;
};
/** The waking host: GET / → 503 loading page (counted), WebSocket upgrades refused. */
function sleepyHost() {
  const hits = { get: 0, upgrade: 0 };
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) hits.get++;
    res.writeHead(503, { 'content-type': 'text/html' });
    res.end('<html><body>Service waking up…</body></html>');
  });
  server.on('upgrade', (req, socket) => { hits.upgrade++; socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); });
  const ready = new Promise((r) => server.listen(PORT, '0.0.0.0', r));
  const close = () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); });
  return { hits, ready, close };
}
const QUERY = (extra = '') => `/?screen=menu&relay=${encodeURIComponent(RELAY)}${extra}`;
const netState = (page) => page.evaluate(() => ({ state: window.__br.app.net.state, message: window.__br.app.net.message, ok: window.__ok ?? null }));

// 1. The host sleeps for 6 s, then the relay is up: connect() waits it out and succeeds; the room works.
await withPage(async (page, h) => {
  const host = sleepyHost();
  await host.ready;
  await h.goto(QUERY());
  await page.evaluate(() => { window.__ok = null; window.__br.app.net.connect('Alice').then((ok) => { window.__ok = ok; }); });
  await sleep(2500);
  const waiting = await netState(page);
  expect(waiting.ok === null && waiting.state === 'connecting' && waiting.message.includes('唤醒'),
    `while the host is asleep connect() keeps trying and says so (state ${waiting.state}, 「${waiting.message}」)`);
  await sleep(3500);
  expect(host.hits.get >= 1, `the client pokes the host's HTTP root to wake it (GET / ${host.hits.get}×, upgrades tried ${host.hits.upgrade}×)`);
  expect(host.hits.upgrade >= 2, `the client keeps retrying the WebSocket while the host wakes (${host.hits.upgrade} tries in 6 s)`);
  await host.close();
  const up = await startRelay();
  let ok = null;
  for (let i = 0; i < 60 && ok === null; i++) { await sleep(250); ok = (await netState(page)).ok; }
  const after = await netState(page);
  expect(up && ok === true && after.state === 'online', `once the relay is up connect() resolves true and the state is online (${JSON.stringify(after)})`);
  await page.evaluate(() => window.__br.app.net.createRoom());
  await sleep(800);
  const room = await page.evaluate(() => window.__br.app.net.room?.code ?? null);
  expect(!!room, `and the room works (${room})`);
  await page.evaluate(() => window.__br.app.net.leave());
  stopRelay();
  await noErrors(h, 'wake');
}, { size: '960x540' });

// 2. Leaving while it wakes stops at once; 3. with nothing ever answering it gives up after ?relayWait.
await withPage(async (page, h) => {
  await h.goto(QUERY('&relayWait=4000'));
  await page.evaluate(() => { window.__ok = null; window.__br.app.net.connect('Bob').then((ok) => { window.__ok = ok; }); });
  await sleep(1500);
  const t0 = Date.now();
  await page.evaluate(() => window.__br.app.net.leave());
  let s = await netState(page);
  for (let i = 0; i < 20 && s.ok === null; i++) { await sleep(100); s = await netState(page); }
  expect(s.ok === false && s.state === 'offline' && Date.now() - t0 < 1500, `leave() while waking stops the tries at once (connect → ${s.ok}, state ${s.state}, ${Date.now() - t0} ms)`);
  const t1 = Date.now();
  await page.evaluate(() => { window.__ok = null; window.__br.app.net.connect('Bob').then((ok) => { window.__ok = ok; }); });
  for (let i = 0; i < 100 && (await netState(page)).ok === null; i++) await sleep(100);
  const gaveUp = await netState(page), took = Date.now() - t1;
  expect(gaveUp.ok === false && took >= 3500 && took < 8000 && gaveUp.state === 'error' && gaveUp.message.includes('连接不上'),
    `nothing at the address: it gives up after ?relayWait=4000 ms with 「连接不上…」 (${took} ms, ${JSON.stringify(gaveUp)})`);
  await noErrors(h, 'give up');
}, { size: '960x540' });

// 4. The online screen shows the waking line while it waits.
await withPage(async (page, h) => {
  const host = sleepyHost();
  await host.ready;
  await h.goto(`/?screen=online&relay=${encodeURIComponent(RELAY)}`);
  await page.waitForFunction(() => window.__br?.app?.ui?.screen === 'online' && !window.__br.app.ui.busy, null, { timeout: 20000 });
  await page.click('[data-net-name]', { timeout: 5000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Cat');
  await page.click('[data-net-create]', { timeout: 5000 });
  await sleep(3000);
  const line = await page.evaluate(() => document.querySelector('[data-net-message]')?.textContent ?? '');
  expect(line.includes('唤醒'), `the online screen shows the waking line while it waits (「${line}」)`);
  await page.evaluate(() => window.__br.app.net.leave());
  await host.close();
  await noErrors(h, 'online screen');
}, { size: '1280x720' });

stopRelay();
finish('r6-net-wake');
