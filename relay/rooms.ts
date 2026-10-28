// The rooms of the relay: the code book, the members and the lobby (SPEC §28). The relay has no game logic — a
// room keeps who is in it, what they ride and whether they are ready, and hands the race over to race.ts.
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_HUMANS,
  normaliseCode,
  type ErrorCode,
  type Member,
  type MemberPick,
  type RelayMsg,
  type RoomSetup,
  type RoomState,
  type TickInput,
} from '../src/net/protocol.ts';
import { Race, type EndReason } from './race.ts';

/** One line of the relay log. */
export type Log = (line: string) => void;

/** A connected client of the relay. */
export interface Peer {
  /** unique for the relay's lifetime */
  readonly id: number;
  name: string;
  send(msg: RelayMsg): void;
}

export interface RelayOptions {
  /** how long the relay waits for every human's `loaded` before it starts without the late ones */
  loadMs: number;
  /** how long the race may run after the first human is done */
  graceMs: number;
}

/** A member of a room. */
export interface MemberEntry {
  readonly peer: Peer;
  pick: MemberPick;
  ready: boolean;
  /** the join order: the oldest member inherits the host */
  readonly seq: number;
}

const emptyPick = (): MemberPick => ({ character: '', bike: '', loadout: { slots: [], ult: null } });

export class Room {
  state: RoomState = 'lobby';
  setup: RoomSetup | null = null;
  hostId: number | null = null;
  readonly members = new Map<number, MemberEntry>();
  race: Race | null = null;
  private seq = 0;

  constructor(
    readonly code: string,
    private readonly opts: RelayOptions,
    private readonly log: Log,
  ) {}

  /** A member joins the room (the host is the first one). */
  add(peer: Peer): void {
    this.seq += 1;
    this.members.set(peer.id, { peer, pick: emptyPick(), ready: false, seq: this.seq });
    if (this.hostId === null) this.hostId = peer.id;
  }

  /** A member leaves: the host's role passes to the oldest remaining member. */
  remove(peerId: number): void {
    if (!this.members.delete(peerId)) return;
    if (this.hostId === peerId) this.hostId = this.oldestId();
    this.race?.memberLeft(peerId);
  }

  /**
   * The room changed: every member gets the new lobby.
   *
   * The members are written from the newest to the oldest: a client reads its sockets in the order it connected
   * them, so writing the newest member first keeps the streams of one tick in step — no client is ever a tick
   * ahead of another member.
   */
  broadcast(msg: RelayMsg): void {
    const members = [...this.members.values()];
    for (let i = members.length - 1; i >= 0; i--) members[i].peer.send(msg);
  }

  /** The lobby as the members see it. */
  roomMsg(): RelayMsg {
    const members: Member[] = [];
    for (const m of this.members.values()) {
      members.push({
        id: m.peer.id,
        name: m.peer.name,
        character: m.pick.character,
        bike: m.pick.bike,
        loadout: m.pick.loadout,
        ready: m.ready,
      });
    }
    return {
      t: 'room',
      code: this.code,
      host: this.hostId ?? 0,
      members,
      setup: this.setup,
      state: this.state,
    };
  }

  /** What a member rides. */
  setPick(peerId: number, pick: MemberPick): void {
    const m = this.members.get(peerId);
    if (!m) return;
    m.pick = pick;
    this.log(`room ${this.code} pick (${m.peer.name})`);
    this.broadcast(this.roomMsg());
  }

  /** A member is ready (or not any more). */
  setReady(peerId: number, ready: boolean): void {
    const m = this.members.get(peerId);
    if (!m) return;
    m.ready = ready;
    this.broadcast(this.roomMsg());
  }

  /** The host picks the track, the weather and the direction. */
  setSetup(peerId: number, setup: RoomSetup): void {
    this.setup = setup;
    this.log(`room ${this.code} setup (${setup.trackId})`);
    this.broadcast(this.roomMsg());
  }

  /** The host starts the race: every member must be ready and the humans must be the members. */
  start(peerId: number, config: unknown, humans: number[]): ErrorCode | null {
    if (this.state !== 'lobby') return 'started';
    if (this.hostId !== peerId) return 'not_host';
    for (const m of this.members.values()) if (!m.ready) return 'not_ready';
    if (!this.humansMatch(humans)) return 'bad_humans';
    this.state = 'loading';
    this.race = new Race(humans.slice(), this, {
      loadMs: this.opts.loadMs,
      graceMs: this.opts.graceMs,
      log: this.log,
    });
    this.log(`room ${this.code} started (humans ${humans.join(',')})`);
    this.broadcast({ t: 'start', config, humans });
    this.race.armLoadTimeout();
    return null;
  }

  /** A human built the race and is ready for tick 0. */
  loaded(peerId: number): void {
    this.race?.markLoaded(peerId);
  }

  /** The latest input of a human. */
  input(peerId: number, i: TickInput): void {
    this.race?.input(peerId, i);
  }

  /** The hash of a tick, as the human simulated it. */
  hash(peerId: number, tick: number, h: string): void {
    this.race?.hash(peerId, tick, h);
  }

  /** A human's local race is over. */
  done(peerId: number): void {
    this.race?.markDone(peerId);
  }

  /** The race is over: the room goes back to the lobby and everybody is ready again (no). */
  finish(reason: EndReason): void {
    this.race?.dispose();
    this.race = null;
    this.state = 'lobby';
    for (const m of this.members.values()) m.ready = false;
    this.log(`room ${this.code} ended (${reason})`);
    this.broadcast(this.roomMsg());
  }

  /** The humans of the start must be exactly the members, each of them once. */
  private humansMatch(humans: number[]): boolean {
    if (humans.length !== this.members.size) return false;
    const seen = new Set<number>();
    for (const h of humans) {
      if (seen.has(h) || !this.members.has(h)) return false;
      seen.add(h);
    }
    return true;
  }

  private oldestId(): number | null {
    let oldest: MemberEntry | null = null;
    for (const m of this.members.values()) {
      if (!oldest || m.seq < oldest.seq) oldest = m;
    }
    return oldest ? oldest.peer.id : null;
  }
}

/** The rooms of the relay: the codes in use and where every member is. */
export class Hub {
  private readonly rooms = new Map<string, Room>();
  private readonly where = new Map<number, string>();

  constructor(
    private readonly opts: RelayOptions,
    private readonly log: Log,
  ) {}

  /** A new room with a fresh code; the creator is its host. */
  create(peer: Peer): void {
    this.leave(peer.id);
    const code = this.freshCode();
    const room = new Room(code, this.opts, this.log);
    this.rooms.set(code, room);
    room.add(peer);
    this.where.set(peer.id, code);
    this.log(`room ${code} created (${peer.name})`);
    room.broadcast(room.roomMsg());
  }

  /** A member joins a room by code (any case). */
  join(peer: Peer, rawCode: string): ErrorCode | null {
    const code = normaliseCode(rawCode);
    const room = code === null ? undefined : this.rooms.get(code);
    if (!room) return 'no_room';
    if (room.state !== 'lobby') return 'started';
    if (room.members.size >= MAX_HUMANS) return 'full';
    this.leave(peer.id);
    room.add(peer);
    this.where.set(peer.id, room.code);
    this.log(`room ${room.code} joined (${peer.name})`);
    room.broadcast(room.roomMsg());
    return null;
  }

  /** A member leaves its room; the room dies with its last member. */
  leave(peerId: number): void {
    const code = this.where.get(peerId);
    if (code === undefined) return;
    this.where.delete(peerId);
    const room = this.rooms.get(code);
    if (!room) return;
    room.remove(peerId);
    if (room.members.size === 0) {
      this.rooms.delete(code);
      this.log(`room ${code} closed`);
      return;
    }
    room.broadcast(room.roomMsg());
  }

  /** The room a member is in. */
  roomOf(peerId: number): Room | null {
    const code = this.where.get(peerId);
    if (code === undefined) return null;
    return this.rooms.get(code) ?? null;
  }

  /** A code that is not in use. */
  private freshCode(): string {
    for (;;) {
      const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
      let code = '';
      for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (!this.rooms.has(code)) return code;
    }
  }
}
