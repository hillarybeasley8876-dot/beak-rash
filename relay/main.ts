#!/usr/bin/env -S deno run --allow-net
// The relay for online rooms (SPEC §28): the code book, the load barrier and the 60 Hz tick stream that bundles
// every human's input. The relay has no game logic — the host's RaceConfig is forwarded untouched and every
// client simulates the race itself.
import {
  FINISH_GRACE_MS,
  IDLE_TIMEOUT_MS,
  LOAD_TIMEOUT_MS,
  MAX_MESSAGE_BYTES,
  MAX_MESSAGES_PER_SECOND,
  NAME_MAX,
  PROTOCOL_VERSION,
  isTickInput,
  type ErrorCode,
  type MemberPick,
  type RelayMsg,
  type RoomSetup,
} from '../src/net/protocol.ts';
import { Hub, type Peer } from './rooms.ts';

interface Flags {
  port: number;
  idleMs: number;
  loadMs: number;
  graceMs: number;
}

const log = (line: string): void => {
  console.log(`${new Date().toISOString()} ${line}`);
};

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The flags of the relay: `--port`, `--idle-ms`, `--load-ms`, `--grace-ms`. */
/** The port a host gives the relay through the environment (Render, Fly, …: PORT); run with --allow-env=PORT. */
function envPort(): number | undefined {
  try {
    const v = Number(Deno.env.get('PORT'));
    return Number.isInteger(v) && v > 0 ? v : undefined;
  } catch {
    return undefined;   // no --allow-env: the flag or the default
  }
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {
    port: envPort() ?? 8790,
    idleMs: IDLE_TIMEOUT_MS,
    loadMs: LOAD_TIMEOUT_MS,
    graceMs: FINISH_GRACE_MS,
  };
  const num = (i: number): number | undefined => {
    const v = Number(args[i]);
    return Number.isFinite(v) ? v : undefined;
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--port') {
      const v = num(++i);
      if (v !== undefined) flags.port = v;
    } else if (flag === '--idle-ms') {
      const v = num(++i);
      if (v !== undefined) flags.idleMs = v;
    } else if (flag === '--load-ms') {
      const v = num(++i);
      if (v !== undefined) flags.loadMs = v;
    } else if (flag === '--grace-ms') {
      const v = num(++i);
      if (v !== undefined) flags.graceMs = v;
    }
  }
  return flags;
}

/** The name of a member: trimmed to NAME_MAX, empty becomes the rider's name. */
function normaliseName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length === 0) return '骑手';
  return name.slice(0, NAME_MAX);
}

/** One connection of the relay. */
class Conn implements Peer {
  readonly id: number;
  name = '';
  /** the client said hello */
  greeted = false;
  private closing = false;
  private gone = false;
  /** the timestamps of the messages of the last second (the sliding rate window) */
  private readonly rate: number[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    id: number,
    private readonly ws: WebSocket,
    private readonly idleMs: number,
  ) {
    this.id = id;
  }

  send(msg: RelayMsg): void {
    if (this.gone) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      log(`conn ${this.id}: send failed (${errText(err)})`);
    }
  }

  /** A complaint that keeps the connection. */
  error(code: ErrorCode, msg: string): void {
    this.send({ t: 'error', code, msg });
  }

  /** A complaint that ends the connection. */
  errorAndClose(code: ErrorCode, msg: string): void {
    if (this.closing) return;
    this.closing = true;
    this.error(code, msg);
    setTimeout(() => this.close(), 25);
  }

  close(): void {
    if (this.gone) return;
    this.gone = true;
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    try {
      this.ws.close();
    } catch {
      // the socket is already gone
    }
  }

  /** Any message keeps the connection alive. */
  touch(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.errorAndClose('idle', 'no message for too long');
    }, this.idleMs);
  }

  /** The sliding window: at most MAX_MESSAGES_PER_SECOND messages a second. */
  overRate(now: number): boolean {
    while (this.rate.length > 0 && now - this.rate[0] >= 1000) this.rate.shift();
    if (this.rate.length >= MAX_MESSAGES_PER_SECOND) return true;
    this.rate.push(now);
    return false;
  }

  get closingDown(): boolean {
    return this.closing || this.gone;
  }
}
// ---- the messages

const encoder = new TextEncoder();

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** What a member rides: the character's and the bike's id plus the three skills and the ult. */
function parsePick(m: Record<string, unknown>): MemberPick | null {
  if (typeof m.character !== 'string' || typeof m.bike !== 'string') return null;
  const loadout = asRecord(m.loadout);
  if (!loadout) return null;
  const raw = Array.isArray(loadout.slots) ? loadout.slots : [];
  const slots: Array<string | null> = raw.map((s) => (typeof s === 'string' ? s : null));
  const ult = typeof loadout.ult === 'string' ? loadout.ult : null;
  return { character: m.character, bike: m.bike, loadout: { slots, ult } };
}

/** The host's race setup: the track, the weather (or none) and the direction. */
function parseSetup(m: Record<string, unknown>): RoomSetup | null {
  const setup = asRecord(m.setup);
  if (!setup) return null;
  if (typeof setup.trackId !== 'string') return null;
  if (typeof setup.reverse !== 'boolean') return null;
  let weather: string | null = null;
  if (setup.weather !== null && setup.weather !== undefined) {
    if (typeof setup.weather !== 'string') return null;
    weather = setup.weather;
  }
  return { trackId: setup.trackId, weather, reverse: setup.reverse };
}

/** One message from a client. */
function handle(conn: Conn, raw: string, hub: Hub): void {
  if (conn.closingDown) return;
  conn.touch();
  if (conn.overRate(Date.now())) {
    conn.errorAndClose('rate', 'too many messages');
    return;
  }
  if (encoder.encode(raw).length > MAX_MESSAGE_BYTES) {
    conn.error('too_big', 'the message is too big');
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    conn.error('bad_message', 'malformed json');
    return;
  }
  const m = asRecord(parsed);
  if (!m) {
    conn.error('bad_message', 'not a message');
    return;
  }
  const t = m.t;
  if (typeof t !== 'string') {
    conn.error('bad_message', 'no message type');
    return;
  }
  if (!conn.greeted) {
    if (t !== 'hello') {
      conn.errorAndClose('bad_message', 'hello first');
      return;
    }
    if (typeof m.v !== 'number' || m.v !== PROTOCOL_VERSION) {
      conn.errorAndClose('version', 'another protocol version');
      return;
    }
    conn.name = normaliseName(m.name);
    conn.greeted = true;
    conn.send({ t: 'welcome', v: PROTOCOL_VERSION, id: conn.id });
    return;
  }
  dispatch(conn, t, m, hub);
}

/** A message of a client that said hello. */
function dispatch(conn: Conn, t: string, m: Record<string, unknown>, hub: Hub): void {
  if (t === 'ping') {
    const at = typeof m.at === 'number' ? m.at : 0;
    conn.send({ t: 'pong', at, now: Date.now() });
    return;
  }
  if (t === 'create') {
    hub.create(conn);
    return;
  }
  if (t === 'join') {
    const code = typeof m.code === 'string' ? m.code : '';
    const err = hub.join(conn, code);
    if (err) conn.error(err, 'cannot join that room');
    return;
  }
  if (t === 'leave') {
    hub.leave(conn.id);
    return;
  }
  const room = hub.roomOf(conn.id);
  if (!room) {
    conn.error('not_in_room', 'you are not in a room');
    return;
  }
  if (t === 'pick') {
    const pick = parsePick(m);
    if (!pick) {
      conn.error('bad_message', 'bad pick');
      return;
    }
    room.setPick(conn.id, pick);
    return;
  }
  if (t === 'ready') {
    if (typeof m.ready !== 'boolean') {
      conn.error('bad_message', 'bad ready');
      return;
    }
    room.setReady(conn.id, m.ready);
    return;
  }
  if (t === 'setup') {
    if (room.hostId !== conn.id) {
      conn.error('not_host', 'only the host sets the race up');
      return;
    }
    const setup = parseSetup(m);
    if (!setup) {
      conn.error('bad_message', 'bad setup');
      return;
    }
    room.setSetup(conn.id, setup);
    return;
  }
  if (t === 'start') {
    if (!Array.isArray(m.humans) || !m.humans.every((h) => typeof h === 'number')) {
      conn.error('bad_message', 'bad humans');
      return;
    }
    const err = room.start(conn.id, m.config, m.humans as number[]);
    if (err) conn.error(err, 'cannot start');
    return;
  }
  if (t === 'loaded') {
    room.loaded(conn.id);
    return;
  }
  if (t === 'in') {
    if (!isTickInput(m.i)) {
      conn.error('bad_message', 'bad input');
      return;
    }
    room.input(conn.id, m.i);
    return;
  }
  if (t === 'hash') {
    if (typeof m.tick !== 'number' || !Number.isInteger(m.tick) || typeof m.h !== 'string') {
      conn.error('bad_message', 'bad hash');
      return;
    }
    room.hash(conn.id, m.tick, m.h);
    return;
  }
  if (t === 'done') {
    room.done(conn.id);
    return;
  }
  conn.error('bad_message', `unknown message '${t}'`);
}
// ---- the server

const flags = parseFlags(Deno.args);
const hub = new Hub({ loadMs: flags.loadMs, graceMs: flags.graceMs }, log);
const conns = new Map<number, Conn>();
let nextId = 1;

Deno.serve({ port: flags.port, hostname: '0.0.0.0' }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/') {
    return new Response('beak-rash relay ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (url.pathname !== '/ws') return new Response('not found', { status: 404 });
  let socket: WebSocket;
  let response: Response;
  try {
    ({ socket, response } = Deno.upgradeWebSocket(req));
  } catch (err) {
    log(`upgrade refused (${errText(err)})`);
    return new Response('expected a websocket upgrade', { status: 400 });
  }
  const conn = new Conn(nextId++, socket, flags.idleMs);
  conns.set(conn.id, conn);
  socket.onopen = () => {
    log(`conn ${conn.id} open`);
    conn.touch();
  };
  socket.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      try {
        handle(conn, ev.data, hub);
      } catch (err) {
        log(`conn ${conn.id}: ${errText(err)}`);
        conn.error('bad_message', 'the message could not be read');
      }
    } else {
      conn.error('bad_message', 'the protocol is json text');
    }
  };
  const gone = () => {
    conns.delete(conn.id);
    hub.leave(conn.id);
    log(`conn ${conn.id} closed`);
  };
  socket.onclose = gone;
  socket.onerror = gone;
  return response;
});

log(`relay listening on 0.0.0.0:${flags.port}`);

