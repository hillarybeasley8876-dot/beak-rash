#!/usr/bin/env node
// r6 acceptance: the relay (SPEC §28 — 联机). Lead-owned, read-only for workers. Starts the Deno relay on a free port
// with short test timeouts and drives it with Node's WebSocket client: rooms by code, the host's start, the load
// barrier, a 60 Hz tick stream that bundles every human's input (no edge lost or doubled), hash comparison, leaving
// mid-race, limits. The protocol is src/net/protocol.ts.
//   node tools/r6/relay.mjs [--port 8791]
import { spawn } from 'node:child_process';
import { parseArgs } from '../lib.mjs';

const a = parseArgs(process.argv.slice(2));
const PORT = Number(a.port ?? 8791);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}/ws`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const expect = (ok, msg) => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const relay = spawn('deno', ['run', '--allow-net', 'relay/main.ts', '--port', String(PORT), '--idle-ms', '1500', '--load-ms', '1500', '--grace-ms', '2000'],
  { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
let relayLog = '';
relay.stdout.on('data', (d) => { relayLog += d; });
relay.stderr.on('data', (d) => { relayLog += d; });
const stopRelay = () => { try { relay.kill(); } catch { /* already gone */ } if (process.platform === 'win32') spawn('taskkill', ['/pid', String(relay.pid), '/t', '/f'], { stdio: 'ignore' }); };
process.on('exit', stopRelay);

/** A test client: a WebSocket with an inbox and helpers to wait for a message. */
function client(label) {
  const ws = new WebSocket(WS);
  const c = { label, ws, inbox: [], closed: false, id: null };
  ws.addEventListener('message', (e) => { try { c.inbox.push(JSON.parse(String(e.data))); } catch { c.inbox.push({ t: '?', raw: String(e.data) }); } });
  ws.addEventListener('close', () => { c.closed = true; });
  // listen for open right away: a socket may open before the test gets round to waiting for it
  const opened = new Promise((res, rej) => { ws.addEventListener('open', () => res(c), { once: true }); ws.addEventListener('error', () => rej(new Error(`${label}: cannot connect`)), { once: true }); });
  opened.catch(() => undefined);
  c.open = () => opened;
  c.send = (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  /** Wait for the next message matching `f` (removes it and everything before it); null on timeout. */
  c.next = async (f, ms = 2000) => {
    const t0 = Date.now();
    for (;;) {
      const i = c.inbox.findIndex(f);
      if (i >= 0) { const m = c.inbox[i]; c.inbox.splice(0, i + 1); return m; }
      if (Date.now() - t0 > ms) return null;
      await sleep(5);
    }
  };
  c.take = (t) => { const out = c.inbox.filter((m) => m.t === t); c.inbox = c.inbox.filter((m) => m.t !== t); return out; };
  return c;
}
/** Connect and say hello; a client pings every 400 ms (the test relay drops a client silent for 1.5 s) unless `silent`. */
const hello = async (c, name, { silent = false } = {}) => {
  await c.open();
  c.send({ t: 'hello', v: 1, name });
  const w = await c.next((m) => m.t === 'welcome');
  c.id = w?.id ?? null;
  if (!silent) {
    const timer = setInterval(() => { if (c.closed) clearInterval(timer); else c.send({ t: 'ping', at: Date.now() }); }, 400);
    c.ws.addEventListener('close', () => clearInterval(timer));
  }
  return w;
};
const PICK = { character: 'pelican', bike: 'roadbike', loadout: { slots: ['pelican.torpedo', 'pelican.gulp', 'pelican.wing'], ult: 'pelican.ult' } };

try {
  // the relay comes up and answers GET /
  let up = '';
  for (let i = 0; i < 60 && !up.includes('beak-rash relay ok'); i++) {
    await sleep(250);
    up = await fetch(HTTP + '/').then((r) => r.text()).catch(() => '');
  }
  expect(up.includes('beak-rash relay ok'), `GET / answers "beak-rash relay ok" (${JSON.stringify(up.slice(0, 40))}${up ? '' : `; relay output: ${relayLog.slice(0, 300)}`})`);
  if (!up) throw new Error('relay did not start');

  // ---- rooms
  const A = client('A'), B = client('B');
  const wa = await hello(A, 'Alice'), wb = await hello(B, 'Bob');
  expect(wa?.v === 1 && Number.isInteger(wa?.id) && Number.isInteger(wb?.id) && wa.id !== wb.id, `hello → welcome with a member id per connection (${JSON.stringify(wa)} ${JSON.stringify(wb)})`);
  A.send({ t: 'create' });
  const room1 = await A.next((m) => m.t === 'room');
  const code = room1?.code ?? '';
  expect(code.length === 4 && [...code].every((ch) => ALPHABET.includes(ch)) && room1.host === A.id && room1.members?.length === 1 && room1.state === 'lobby',
    `create → a room with a 4-letter code from ${ALPHABET}, the creator as host (${JSON.stringify(room1)})`);
  B.send({ t: 'join', code: code === 'ZZZZ' ? 'YYYY' : 'ZZZZ' });
  const bad = await B.next((m) => m.t === 'error' || m.t === 'room');
  expect(bad?.t === 'error' && bad.code === 'no_room', `join with a wrong code → error no_room (${JSON.stringify(bad)})`);
  B.send({ t: 'join', code: code.toLowerCase() });
  const rb = await B.next((m) => m.t === 'room' && m.members?.length === 2);
  const ra = await A.next((m) => m.t === 'room' && m.members?.length === 2);
  expect(!!rb && !!ra && rb.code === code && ra.members.some((m) => m.name === 'Bob'), `join (any case) → both members get the room with 2 members (${JSON.stringify(rb?.members?.map((m) => m.name))})`);
  // picks and ready travel to everyone; only the host may set up and start
  B.send({ t: 'pick', character: 'moodeng', bike: 'mtb', loadout: { slots: ['moodeng.bounce', 'pool.watergun', null], ult: 'ult.meteor' } });
  const pk = await A.next((m) => m.t === 'room' && m.members.some((x) => x.id === B.id && x.character === 'moodeng'));
  expect(!!pk, 'a member\'s pick reaches every member (room broadcast)');
  B.send({ t: 'setup', setup: { trackId: 'city', weather: null, reverse: false } });
  const nh = await B.next((m) => m.t === 'error');
  expect(nh?.code === 'not_host', `a non-host's setup → error not_host (${JSON.stringify(nh)})`);
  A.send({ t: 'setup', setup: { trackId: 'coast', weather: 'rain', reverse: false } });
  const su = await B.next((m) => m.t === 'room' && m.setup?.trackId === 'coast');
  expect(su?.setup?.weather === 'rain', 'the host\'s setup reaches every member');
  A.send({ t: 'pick', ...PICK });
  A.send({ t: 'ready', ready: true });
  const config = { trackId: 'coast', seed: 4242, note: 'opaque to the relay', online: { humans: [] } };
  A.send({ t: 'start', config, humans: [A.id, B.id] });
  const nr = await A.next((m) => m.t === 'error');
  expect(nr?.code === 'not_ready', `start before every member is ready → error not_ready (${JSON.stringify(nr)})`);
  B.send({ t: 'ready', ready: true });
  await A.next((m) => m.t === 'room' && m.members.every((x) => x.ready));
  A.send({ t: 'start', config, humans: [B.id, A.id, 999] });
  const bh = await A.next((m) => m.t === 'error');
  expect(bh?.code === 'bad_humans', `start with humans that are not exactly the members → error bad_humans (${JSON.stringify(bh)})`);
  A.send({ t: 'start', config, humans: [A.id, B.id] });
  const sa = await A.next((m) => m.t === 'start'), sb = await B.next((m) => m.t === 'start');
  expect(!!sa && !!sb && JSON.stringify(sa.config) === JSON.stringify(config) && JSON.stringify(sb.humans) === JSON.stringify([A.id, B.id]),
    `start → every member gets the host's config untouched and the slot order (${JSON.stringify(sb)})`);
  const C = client('C');
  await hello(C, 'Carol');
  C.send({ t: 'join', code });
  const st = await C.next((m) => m.t === 'error');
  expect(st?.code === 'started', `joining a room that is loading or racing → error started (${JSON.stringify(st)})`);
  C.ws.close();

  // ---- the load barrier and the tick stream
  A.send({ t: 'loaded' });
  const early = await A.next((m) => m.t === 'go' || m.t === 'tick', 300);
  expect(!early, 'no go / tick before every human has loaded');
  B.send({ t: 'loaded' });
  const ga = await A.next((m) => m.t === 'go'), gb = await B.next((m) => m.t === 'go');
  expect(!!ga && !!gb, 'every human loaded → go to everyone');
  const t0 = Date.now();
  // A holds steer right at 50/127 from now on; B taps hop 40 times, 45 ms apart (slower than the ticks)
  A.send({ t: 'in', i: [50, 255, 0, 0, 0] });
  let taps = 0;
  const tapper = (async () => {
    for (; taps < 40; taps++) {
      B.send({ t: 'in', i: [0, 255, 0, 0, 1] });
      await sleep(45);
    }
  })();
  await tapper;
  await sleep(400);
  const elapsed = (Date.now() - t0) / 1000;
  const ticksA = A.take('tick'), ticksB = B.take('tick');
  const ns = ticksA.map((m) => m.n);
  const consecutive = ns.every((n, i) => n === i);
  const rate = ticksA.length / elapsed;
  expect(consecutive && rate > 56 && rate < 64, `ticks arrive numbered 0, 1, 2 … at 60 Hz (${ticksA.length} in ${elapsed.toFixed(2)} s = ${rate.toFixed(1)}/s; consecutive ${consecutive})`);
  // compare the ticks both members have received so far (one may be a tick ahead when the inboxes are read)
  const common = Math.min(ticksA.length, ticksB.length);
  expect(ticksA.every((m) => Array.isArray(m.i) && m.i.length === 2) && common >= ticksA.length - 2
    && JSON.stringify(ticksA.slice(0, common).map((m) => m.i)) === JSON.stringify(ticksB.slice(0, common).map((m) => m.i)),
    `every tick carries one input per human slot, the same for every member (${common} ticks compared)`);
  const steerAfter = ticksA.filter((m, i) => i > 10).every((m) => m.i[0][0] === 50);
  expect(steerAfter, 'a held input stays in every tick until the human sends a new one (A steers 50)');
  const hops = ticksA.filter((m) => (m.i[1][4] & 1) !== 0).length;
  expect(hops === taps, `every edge press lands in exactly one tick: B tapped hop ${taps} times → ${hops} ticks with the hop bit`);

  // ---- hashes
  const n0 = ticksA.length + 60 - (ticksA.length % 60);
  A.send({ t: 'hash', tick: n0, h: 'aaaa' }); B.send({ t: 'hash', tick: n0, h: 'aaaa' });
  const ok1 = await A.next((m) => m.t === 'desync', 400);
  expect(!ok1, 'equal hashes → no desync');
  A.send({ t: 'hash', tick: n0 + 60, h: 'aaaa' }); B.send({ t: 'hash', tick: n0 + 60, h: 'bbbb' });
  const ds = await B.next((m) => m.t === 'desync', 1500);
  expect(ds?.tick === n0 + 60, `different hashes for one tick → desync to everyone (${JSON.stringify(ds)})`);
  const endA = await A.next((m) => m.t === 'end', 1500);
  expect(endA?.reason === 'desync', `a desync ends the race for everyone (end ${JSON.stringify(endA)})`);
  const back = await A.next((m) => m.t === 'room' && m.state === 'lobby', 1500);
  expect(!!back, 'after the race the room is back in the lobby (members kept)');

  // ---- a second race: a member leaves mid-race → `left` once, its input idle afterwards
  for (const c of [A, B]) c.send({ t: 'ready', ready: true });
  await A.next((m) => m.t === 'room' && m.members.every((x) => x.ready));
  A.send({ t: 'start', config, humans: [A.id, B.id] });
  await A.next((m) => m.t === 'start'); await B.next((m) => m.t === 'start');
  A.send({ t: 'loaded' }); B.send({ t: 'loaded' });
  await A.next((m) => m.t === 'go');
  B.send({ t: 'in', i: [-90, 255, 0, 1, 0] });
  await sleep(300);
  B.ws.close();
  await sleep(500);
  const t2 = A.take('tick');
  const leftMarks = t2.filter((m) => Array.isArray(m.left) && m.left.includes(1));
  const after = t2.slice(t2.findIndex((m) => m.left?.includes(1)) + 1);
  expect(leftMarks.length === 1 && after.length > 5 && after.every((m) => m.i[1].every((v) => v === 0)),
    `a human who leaves mid-race is marked in exactly one tick (left: [1]) and sends idle input afterwards (${leftMarks.length} marks, ${after.length} ticks after)`);
  // the last human's done ends the race (B is gone, A is the only one left)
  A.send({ t: 'done' });
  const endDone = await A.next((m) => m.t === 'end', 2000);
  expect(endDone?.reason === 'done', `every remaining human done → end (${JSON.stringify(endDone)})`);

  // ---- the load timeout: a human who never loads is dropped, the race starts without it
  const D = client('D');
  await hello(D, 'Dave');
  D.send({ t: 'join', code });
  await D.next((m) => m.t === 'room');
  for (const c of [A, D]) { c.send({ t: 'pick', ...PICK }); c.send({ t: 'ready', ready: true }); }
  await A.next((m) => m.t === 'room' && m.members.length === 2 && m.members.every((x) => x.ready));
  A.send({ t: 'start', config, humans: [A.id, D.id] });
  await A.next((m) => m.t === 'start');
  A.send({ t: 'loaded' });
  const lt = Date.now();
  const goLate = await A.next((m) => m.t === 'go', 4000);
  const firstTick = await A.next((m) => m.t === 'tick', 1000);
  expect(!!goLate && Date.now() - lt >= 1300 && firstTick?.left?.includes(1), `a human who never loads is dropped after the load timeout (go after ${Date.now() - lt} ms; tick 0 left ${JSON.stringify(firstTick?.left)})`);
  A.send({ t: 'done' });
  await A.next((m) => m.t === 'end', 3000);

  // ---- limits
  const E = client('E');
  await hello(E, 'Eve');
  for (let i = 0; i < 400; i++) E.send({ t: 'ping', at: i });
  const rl = await E.next((m) => m.t === 'error' && m.code === 'rate', 2000);
  await sleep(300);
  expect(!!rl && E.closed, `more than 120 messages a second → error rate and the connection closes (${JSON.stringify(rl)}, closed ${E.closed})`);
  const F = client('F');
  await hello(F, 'Fay');
  F.send(JSON.stringify({ t: 'pick', character: 'x'.repeat(5000), bike: 'b', loadout: { slots: [], ult: null } }));
  const big = await F.next((m) => m.t === 'error', 1500);
  expect(big?.code === 'too_big', `a message over 4 KB → error too_big (${JSON.stringify(big)})`);
  F.send('{not json');
  const bm = await F.next((m) => m.t === 'error', 1500);
  expect(bm?.code === 'bad_message', `malformed JSON → error bad_message (${JSON.stringify(bm)})`);
  const G = client('G');
  await G.open();
  G.send({ t: 'hello', v: 99, name: 'Gus' });
  const ver = await G.next((m) => m.t === 'error', 1500);
  expect(ver?.code === 'version', `a client of another protocol version → error version (${JSON.stringify(ver)})`);
  const H = client('H');
  await hello(H, 'Hal', { silent: true });
  const idle = await H.next((m) => m.t === 'error' && m.code === 'idle', 4000);
  await sleep(200);
  expect(!!idle && H.closed, `a silent client is dropped after the idle timeout (error idle, closed ${H.closed})`);
  // a full room: 4 humans max
  const R = [client('R1'), client('R2'), client('R3'), client('R4'), client('R5')];
  for (const [i, c] of R.entries()) await hello(c, `P${i}`);
  R[0].send({ t: 'create' });
  const rr = await R[0].next((m) => m.t === 'room');
  for (const c of R.slice(1)) c.send({ t: 'join', code: rr.code });
  const fullErr = await R[4].next((m) => m.t === 'error' || m.t === 'room', 2000);
  expect(fullErr?.t === 'error' && fullErr.code === 'full', `a fifth human → error full (${JSON.stringify(fullErr)})`);
  // the room dies with its last member
  for (const c of R) c.ws.close();
  await sleep(400);
  const X = client('X');
  await hello(X, 'Xen');
  X.send({ t: 'join', code: rr.code });
  const gone = await X.next((m) => m.t === 'error' || m.t === 'room', 1500);
  expect(gone?.code === 'no_room', `a room dies with its last member (${JSON.stringify(gone)})`);
  for (const c of [A, D, F, G, X]) c.ws.close();
} catch (err) {
  expect(false, `the relay test ran to the end (${err.message})`);
} finally {
  stopRelay();
}

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\nr6-relay FAILED (${failed})` : '\nr6-relay OK');
process.exit(failed ? 1 : 0);
