// The socket to the relay (SPEC §28): the WebSocket, the hello/welcome handshake, the ping and the Chinese
// error lines. One connection per client — the room (room.ts) and the race (lockstep.ts) live above it.
import { PROTOCOL_VERSION, type ClientMsg, type RelayMsg } from './protocol';
import type { AppContext, NetState } from '../core/contracts';

/** The relay's default port (the relay's own default). */
const DEFAULT_RELAY_PORT = 8790;
/** How often the client pings the relay (ms) — it also keeps the relay's idle timer happy. */
const PING_MS = 2000;
/** How long one try may take before it counts as failed (ms). */
const CONNECT_TIMEOUT_MS = 4000;
/** How long to wait between two tries while the free host wakes (ms). */
const RETRY_MS = 2500;
/** How long the client waits out a sleeping relay before it gives up (ms). */
const WAIT_MS = 90000;
/** How often the waiting line counts up its seconds (ms). */
const WAIT_TICK_MS = 1000;

/** The Chinese line of a relay error — the player reads these, never the code. */
export function errorText(code: string): string {
  switch (code) {
    case 'version': return '服务器版本不一样，请更新游戏';
    case 'no_room': return '房间不存在';
    case 'full': return '房间满了';
    case 'started': return '比赛已经开始';
    case 'not_host': return '只有房主能做这件事';
    case 'not_in_room': return '你不在任何房间里';
    case 'not_ready': return '还有人没有准备好';
    case 'bad_humans': return '参赛名单不对';
    case 'bad_message': return '消息格式不对';
    case 'too_big': return '消息太大了';
    case 'rate': return '消息发得太快了';
    case 'idle': return '太久没有消息，连接被断开了';
    default: return '联机服务器出了点问题';
  }
}

/** What the client tells the unit above it. */
export interface ClientHooks {
  /** A message from the relay (the welcome and the pong are handled inside the client). */
  onMessage(msg: RelayMsg): void;
  /** The connection state changed. */
  onState(state: NetState, message: string): void;
  /** The round trip to the relay (ms). */
  onPing(ms: number): void;
}

/** The relay's url: ?relay=…, the build's VITE_RELAY_URL, else the relay beside the game server. */
export function relayUrl(app: AppContext): string {
  const param = app.params.get('relay');
  if (param) return param;
  const env: unknown = import.meta.env.VITE_RELAY_URL;
  if (typeof env === 'string' && env) return env;
  return `ws://${location.hostname}:${DEFAULT_RELAY_PORT}/ws`;
}

/** How long to wait for a sleeping relay: ?relayWait=<ms> (the tests), else the default. */
export function relayWaitMs(app: AppContext): number {
  const param = Number(app.params.get('relayWait'));
  return Number.isFinite(param) && param > 0 ? param : WAIT_MS;
}

/** The host's HTTP root behind a relay url (ws→http, wss→https) — '' when the url is not one. */
export function httpRoot(url: string): string {
  const m = /^(wss?):\/\/([^/?#]+)/.exec(url);
  if (!m) return '';
  return `${m[1] === 'wss' ? 'https' : 'http'}://${m[2]}/`;
}

/** The line while the free host wakes: it tells the player why it takes so long. */
function waitText(waitedMs: number): string {
  return `联机服务器唤醒中……第一次大约要一分钟（已等 ${Math.floor(waitedMs / 1000)} 秒）`;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  /** Every socket gets a number; the events of an old socket are ignored. */
  private gen = 0;
  private pingTimer: number | null = null;
  private connectTimer: number | null = null;
  private retryTimer: number | null = null;
  private waitTimer: number | null = null;
  private tickTimer: number | null = null;
  private pending: ((ok: boolean) => void) | null = null;
  private pingSentAt = 0;
  private connected = false;
  /** The handshake of the current wait: who we are and where we are going. */
  private name = '';
  private url = '';
  private waitMs = WAIT_MS;
  private waitStart = 0;
  /** The host was poked over HTTP once for this wait (a free host needs exactly one). */
  private woken = false;

  constructor(private readonly hooks: ClientHooks) {}

  /** Is the socket open? */
  get open(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** Open the socket and shake hands, retrying while the free host wakes; false when the wait runs out. */
  connect(name: string, url: string, waitMs = WAIT_MS): Promise<boolean> {
    if (this.open) return Promise.resolve(true);
    this.cancelWait();          // an older wait stops at once (its promise answers false)
    this.closeSocket();
    this.name = name;
    this.url = url;
    this.waitMs = waitMs > 0 ? waitMs : WAIT_MS;
    this.waitStart = Date.now();
    this.woken = false;
    this.hooks.onState('connecting', '连接联机服务器…');
    const p = new Promise<boolean>((resolve) => {
      this.pending = resolve;
    });
    this.waitTimer = window.setTimeout(() => this.giveUp(), this.waitMs);
    this.tickTimer = window.setInterval(() => this.sayWaiting(), WAIT_TICK_MS);
    this.openSocket();
    return p;
  }

  /** Send a message to the relay (dropped when the socket is not open). */
  send(msg: ClientMsg): void {
    if (!this.open) {
      console.warn('[net] the message was dropped, the relay is not connected:', msg.t);
      return;
    }
    try {
      this.ws?.send(JSON.stringify(msg));
    } catch (err) {
      console.error('[net] sending to the relay failed', err);
    }
  }

  /** Close the socket (the unit decides what happens to the room). */
  close(): void {
    this.cancelWait();
    this.closeSocket();
    this.connected = false;
  }

  /** One try: a fresh socket, the hello when it opens, the timeout when it does not. */
  private openSocket(): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      console.warn('[net] the relay url is broken', err);
      this.tryFailed();
      return;
    }
    this.ws = ws;
    const gen = this.gen;
    this.connectTimer = window.setTimeout(() => this.tryFailed(), CONNECT_TIMEOUT_MS);
    ws.onopen = (): void => {
      if (gen !== this.gen) return;
      this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name });
    };
    ws.onmessage = (ev: MessageEvent): void => {
      if (gen !== this.gen) return;
      this.receive(ev.data);
    };
    ws.onerror = (): void => {
      if (gen !== this.gen) return;
      this.tryFailed();
    };
    ws.onclose = (): void => {
      if (gen !== this.gen) return;
      this.closed();
    };
  }

  /** Drop the socket: its events are ignored from now on. */
  private closeSocket(): void {
    this.gen++;
    this.clearTryTimer();
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch (err) {
      console.error('[net] closing the socket failed', err);
    }
  }

  private clearTryTimer(): void {
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  /** Every timer of the current wait (and of the ping) is off. */
  private clearWaitTimers(): void {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.waitTimer !== null) {
      window.clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private clearPingTimer(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearTryTimer();
    this.clearWaitTimers();
    this.clearPingTimer();
  }

  /** A try failed (error, close or no open in time): the next one follows in a moment. */
  private tryFailed(): void {
    if (this.connected) return;      // a connected socket drops through closed()
    this.closeSocket();
    this.retry();
  }

  /** The host is asleep or gone: poke it once, say so, and try again until the wait runs out. */
  private retry(): void {
    if (!this.pending) return;
    if (!this.woken) {
      this.woken = true;
      this.poke();
    }
    this.sayWaiting();
    if (Date.now() - this.waitStart >= this.waitMs) {
      this.giveUp();
      return;
    }
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.openSocket();
    }, RETRY_MS);
  }

  /** The HTTP root of a sleeping free host wakes it; the answer (and any error) is ignored. */
  private poke(): void {
    const root = httpRoot(this.url);
    if (!root) return;
    fetch(root, { mode: 'no-cors', cache: 'no-store' }).catch((err: unknown) => {
      console.debug('[net] the wake ping got no answer', err);
    });
  }

  /** The waiting line counts up, so the screen shows that something is still happening. */
  private sayWaiting(): void {
    if (!this.pending) return;
    this.hooks.onState('connecting', waitText(Date.now() - this.waitStart));
  }

  /** The wait ran out: the player is told, the promise answers false. */
  private giveUp(): void {
    this.clearTimers();
    this.closeSocket();
    this.hooks.onState('error', '连接不上联机服务器，稍后再试');
    this.resolveConnect(false);
  }

  /** The player left (or connected again) while waiting: the tries stop at once. */
  private cancelWait(): void {
    if (!this.pending) return;
    this.clearTimers();
    this.resolveConnect(false);
    this.hooks.onState('offline', '');
  }

  /** The socket is gone. */
  private closed(): void {
    this.clearTryTimer();
    const wasConnected = this.connected;
    this.connected = false;
    this.ws = null;
    if (!wasConnected) {
      this.retry();     // it closed before the welcome: the next try follows
      return;
    }
    this.clearTimers();
    this.hooks.onState('offline', '服务器断开了');
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') {
      console.warn('[net] the relay sent a binary frame');
      return;
    }
    let msg: RelayMsg;
    try {
      msg = JSON.parse(data) as RelayMsg;
    } catch (err) {
      console.error('[net] the relay sent a broken frame', err);
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') {
      console.warn('[net] the relay sent an unknown frame');
      return;
    }
    if (msg.t === 'welcome') {
      this.clearTryTimer();
      this.clearWaitTimers();
      this.connected = true;
      this.hooks.onState('online', '');
      this.resolveConnect(true);
      this.startPing();
      this.hooks.onMessage(msg);   // the unit above needs the member id
      return;
    }
    if (msg.t === 'pong') {
      this.hooks.onPing(Math.max(0, Date.now() - this.pingSentAt));
      return;
    }
    if (msg.t === 'error') {
      // The relay answered, so it is awake: its no is final (a wrong version is never retried).
      if (!this.connected) {
        this.clearTryTimer();
        this.clearWaitTimers();
      }
      this.hooks.onState('error', errorText(msg.code));
      if (!this.connected) this.resolveConnect(false);
      return;
    }
    this.hooks.onMessage(msg);
  }

  private resolveConnect(ok: boolean): void {
    const resolve = this.pending;
    if (!resolve) return;
    this.pending = null;
    resolve(ok);
  }

  /** The ping keeps the relay's idle timer happy and measures the round trip. */
  private startPing(): void {
    if (this.pingTimer !== null) return;
    this.pingTimer = window.setInterval(() => {
      this.pingSentAt = Date.now();
      this.send({ t: 'ping', at: this.pingSentAt });
    }, PING_MS);
  }
}
