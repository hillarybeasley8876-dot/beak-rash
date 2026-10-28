// The socket to the relay (SPEC §28): the WebSocket, the hello/welcome handshake, the ping and the Chinese
// error lines. One connection per client — the room (room.ts) and the race (lockstep.ts) live above it.
import { PROTOCOL_VERSION, type ClientMsg, type RelayMsg } from './protocol';
import type { AppContext, NetState } from '../core/contracts';

/** The relay's default port (the relay's own default). */
const DEFAULT_RELAY_PORT = 8790;
/** How often the client pings the relay (ms) — it also keeps the relay's idle timer happy. */
const PING_MS = 2000;
/** How long a connection may take before it counts as failed (ms). */
const CONNECT_TIMEOUT_MS = 8000;

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

export class RelayClient {
  private ws: WebSocket | null = null;
  /** Every socket gets a number; the events of an old socket are ignored. */
  private gen = 0;
  private pingTimer: number | null = null;
  private connectTimer: number | null = null;
  private pending: ((ok: boolean) => void) | null = null;
  private pingSentAt = 0;
  private connected = false;
  private failed = false;

  constructor(private readonly hooks: ClientHooks) {}

  /** Is the socket open? */
  get open(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** Open the socket and shake hands; false when the relay is out of reach. */
  connect(name: string, url: string): Promise<boolean> {
    if (this.open) return Promise.resolve(true);
    this.closeSocket();
    this.failed = false;
    this.hooks.onState('connecting', '连接联机服务器…');
    return new Promise<boolean>((resolve) => {
      this.pending = resolve;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error('[net] the relay url is broken', err);
        this.pending = null;
        this.hooks.onState('error', '连接不上联机服务器');
        resolve(false);
        return;
      }
      this.ws = ws;
      const gen = this.gen;
      this.connectTimer = window.setTimeout(() => this.failConnect(), CONNECT_TIMEOUT_MS);
      ws.onopen = (): void => {
        if (gen !== this.gen) return;
        this.send({ t: 'hello', v: PROTOCOL_VERSION, name });
      };
      ws.onmessage = (ev: MessageEvent): void => {
        if (gen !== this.gen) return;
        this.receive(ev.data);
      };
      ws.onerror = (): void => {
        if (gen !== this.gen) return;
        this.failConnect();
      };
      ws.onclose = (): void => {
        if (gen !== this.gen) return;
        this.closed();
      };
    });
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
    this.closeSocket();
    this.connected = false;
  }

  /** Drop the socket: its events are ignored from now on. */
  private closeSocket(): void {
    this.gen++;
    this.clearTimers();
    this.pending = null;
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch (err) {
      console.error('[net] closing the socket failed', err);
    }
  }

  private clearTimers(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  /** The handshake failed (or timed out): the caller is told at once. */
  private failConnect(): void {
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    const resolve = this.pending;
    if (!resolve) return;
    this.pending = null;
    this.failed = true;
    this.hooks.onState('error', '连接不上联机服务器');
    resolve(false);
  }

  /** The socket is gone. */
  private closed(): void {
    this.clearTimers();
    this.ws = null;
    const wasConnected = this.connected;
    this.connected = false;
    const resolve = this.pending;
    this.pending = null;
    if (this.failed) {
      this.failed = false;
      resolve?.(false);
      return;
    }
    resolve?.(false);
    this.hooks.onState('offline', wasConnected ? '服务器断开了' : '连接不上联机服务器');
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
