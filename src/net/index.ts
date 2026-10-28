// The net unit (SPEC §28): the relay connection, the room, the host's start and the lockstep driver of an
// online race. This file is the NetSystem the core talks to; the socket is client.ts, the lobby room.ts, the
// host's race config config.ts and the tick driver lockstep.ts.
import { RelayClient, relayUrl } from './client';
import { RoomState } from './room';
import { Lockstep } from './lockstep';
import { parseStartConfig } from './config';
import { installNetDebug } from './debug';
import type { AppContext, NetRoom, NetState, NetSystem, Session } from '../core/contracts';
import type { MemberPick, RelayMsg, RoomSetup } from './protocol';

export function createNet(app: AppContext): NetSystem {
  const listeners = new Set<() => void>();
  let state: NetState = 'offline';
  let message = '';
  let ping: number | null = null;
  let you = 0;
  /** A race of this room is on the wire (the relay's start arrived, the race did not end yet). */
  let racing = false;
  /** The race was built and the relay knows it (the load barrier). */
  let loaded = false;

  const client = new RelayClient({
    onMessage: (m) => relay(m),
    onState: (s, m) => {
      state = s;
      message = m;
      notify();
    },
    onPing: (ms) => {
      ping = ms;
      notify();
    },
  });
  const room = new RoomState((m) => client.send(m));
  const currentSession = sessionOf(app);
  const lock = new Lockstep(app, (m) => client.send(m), currentSession);

  /** The debug surface (window.__br.net) — it appears with the debug API. */
  const install = (): void => {
    installNetDebug({
      hashes: () => lock.hashList,
      ticks: () => lock.ticks,
      queued: () => lock.queued,
    });
  };

  /** Tell the lobby (and the HUD) that something changed. */
  function notify(): void {
    install();
    for (const fn of Array.from(listeners)) fn();
  }

  /** A message from the relay. */
  function relay(m: RelayMsg): void {
    switch (m.t) {
      case 'welcome':
        you = m.id;
        room.setYou(m.id);
        break;
      case 'room':
        if (state === 'error') {
          state = 'online';
          message = '';
        }
        room.apply(m);
        notify();
        break;
      case 'start':
        startRace(m);
        break;
      case 'go':
        // The relay starts the clock: the ticks follow, the client only runs them.
        break;
      case 'tick':
        lock.onTick(m);
        break;
      case 'desync':
        desync(m.tick);
        break;
      case 'end':
        endRace();
        break;
      default:
        break;
    }
  }

  /** The host started: this client takes its slot and builds the very same race. */
  function startRace(m: Extract<RelayMsg, { t: 'start' }>): void {
    const config = parseStartConfig(m.config);
    if (!config) {
      fail('房间的比赛配置坏了');
      return;
    }
    const slot = m.humans.indexOf(you);
    if (slot < 0 || config.online.humans[slot]?.member !== you) {
      fail('你不在这场比赛的名单里');
      return;
    }
    config.online.local = slot;
    lock.begin();
    racing = true;
    loaded = false;
    app.bus.emit('flow:startRace', { config });
  }

  /** The clients disagree: the race is over. */
  function desync(tick: number): void {
    console.error('[net] the clients disagree at tick', tick);
    racing = false;
    app.ui.toast('联机不同步，比赛结束', 'warn');
    app.bus.emit('flow:quitRace', {});
  }

  /** The relay ended the race: the room goes back to the lobby. */
  function endRace(): void {
    racing = false;
    loaded = false;
    lock.stop();
    const session = currentSession();
    if (session?.config.online && session.phase !== 'finished') app.bus.emit('flow:quitRace', {});
  }

  /** Something went wrong: the player reads the line. */
  function fail(text: string): void {
    message = text;
    state = 'error';
    notify();
  }

  /** Leave the room (and the race) and disconnect. */
  function leave(): void {
    racing = false;          // our own quit is not a foreign one (the bus handler below)
    const session = currentSession();
    if (session?.config.online) app.bus.emit('flow:quitRace', {});
    room.leave();
    client.close();
    lock.stop();
    room.clear();
    loaded = false;
    state = 'offline';
    message = '';
    ping = null;
    notify();
  }

  // The race's load barrier: the relay starts when every human built the race.
  app.bus.on('flow:screen', ({ screen }) => {
    if (screen === 'race' && racing && !loaded) {
      loaded = true;
      client.send({ t: 'loaded' });
    }
  });
  // The local race is over: the relay waits for it before it ends the race for everyone.
  app.bus.on('race:end', () => {
    if (!racing) return;
    racing = false;
    client.send({ t: 'done' });
  });
  // The race was quit from the game (the pause menu): this human leaves the race, the relay marks its slot
  // and the other clients hand the bike to an AI.
  app.bus.on('flow:quitRace', () => {
    if (!racing) return;
    racing = false;
    loaded = false;
    lock.stop();
    room.leave();
    room.clear();
    notify();
  });

  const net: NetSystem = {
    get state(): NetState {
      return state;
    },
    get message(): string {
      return message;
    },
    get ping(): number | null {
      return ping;
    },
    get room(): NetRoom | null {
      return room.current;
    },
    onChange(fn: () => void): () => void {
      listeners.add(fn);
      return (): void => {
        listeners.delete(fn);
      };
    },
    connect(name: string): Promise<boolean> {
      return client.connect(name, relayUrl(app));
    },
    createRoom(): void {
      room.create();
    },
    joinRoom(code: string): void {
      room.join(code);
    },
    pick(p: MemberPick): void {
      room.pick(p);
    },
    ready(on: boolean): void {
      room.ready(on);
    },
    setup(s: RoomSetup): void {
      room.setup(s);
    },
    start(): void {
      room.start();
    },
    leave(): void {
      leave();
    },
    frame(dtReal: number): number {
      const ran = lock.frame(dtReal);
      install();
      return ran;
    },
  };
  install();
  return net;
}

/**
 * The session of the running race. The AppContext has no session field (the core owns the session), so the net
 * unit takes the handle the core hands it: `app.ui.attach(session)` is called with the session when a race
 * starts and with null when it ends. If the core grows an `AppContext.session`, that one is used instead.
 */
function sessionOf(app: AppContext): () => Session | null {
  let current: Session | null = null;
  const ui = app.ui;
  if (typeof ui.attach === 'function') {
    const attach = ui.attach.bind(ui);
    ui.attach = (s: Session | null): void => {
      current = s;
      attach(s);
    };
  }
  return (): Session | null => {
    const own = (app as unknown as { session?: Session | null }).session;
    if (own) return own;
    if (current) return current;
    const br = (window as unknown as { __br?: { session?: () => Session | null } }).__br;
    return br?.session?.() ?? null;
  };
}
