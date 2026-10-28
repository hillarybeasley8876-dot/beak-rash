// The race clock of one room: a drift-corrected 60 Hz tick loop (SPEC §28). The relay has no game logic — it only
// paces the race, remembers the last input of every human and compares the hashes the clients report.
import { TICK_RATE, type RelayMsg, type TickInput } from '../src/net/protocol.ts';

export type EndReason = 'done' | 'grace' | 'empty' | 'desync';

/** What the race needs from the room that owns it. */
export interface RaceRoom {
  /** the room's code (the log line of the race) */
  readonly code: string;
  /** deliver a message to every member still connected */
  broadcast(msg: RelayMsg): void;
  /** the race is over: the room goes back to the lobby */
  finish(reason: EndReason): void;
}

export interface RaceOptions {
  /** how long the relay waits for every human's `loaded` before it starts without the late ones */
  loadMs: number;
  /** how long the race may run after the first human is done */
  graceMs: number;
  /** one line of the relay log */
  log: (line: string) => void;
}

/** The relay keeps the last few hashed ticks (a late report still finds its tick). */
const HASH_MEMORY = 8;
/** The gap between two ticks, in ms. */
const TICK_MS = 1000 / TICK_RATE;

/** One rider slot: the human that rides it and the last input that human sent. */
interface Slot {
  readonly memberId: number;
  steer: number;
  throttle: number;
  brake: number;
  held: number;
  /** the OR of the edge bits of every `in` since the previous tick */
  edges: number;
  loaded: boolean;
  done: boolean;
  /** the human left: the slot sends idle input from now on */
  left: boolean;
}

/** The hashes reported for one tick, until they are compared. */
interface HashTick {
  readonly values: Map<number, string>;
  resolved: boolean;
}

export class Race {
  private readonly slots: Slot[] = [];
  private readonly slotOf = new Map<number, number>();
  private readonly hashes = new Map<number, HashTick>();
  private tick = 0;
  private started = false;
  private ended = false;
  private startAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  /** the slots marked in the next tick (a human left / was dropped) */
  private pendingLeft: number[] = [];
  private graceStarted = false;

  constructor(
    humans: number[],
    private readonly room: RaceRoom,
    private readonly opts: RaceOptions,
  ) {
    for (const memberId of humans) {
      this.slotOf.set(memberId, this.slots.length);
      this.slots.push({
        memberId, steer: 0, throttle: 0, brake: 0, held: 0, edges: 0,
        loaded: false, done: false, left: false,
      });
    }
  }

  /** The humans in slot order (slot i ↔ humans[i]). */
  get humans(): number[] {
    return this.slots.map((s) => s.memberId);
  }

  /** The load barrier: the relay waits for every human's `loaded` before the race starts. */
  armLoadTimeout(): void {
    this.loadTimer = setTimeout(() => this.begin(), this.opts.loadMs);
  }

  /** A human says it built the race and is ready for tick 0. */
  markLoaded(memberId: number): void {
    const idx = this.slotOf.get(memberId);
    if (idx === undefined) return;
    const slot = this.slots[idx];
    if (slot.left || slot.loaded) return;
    slot.loaded = true;
    if (this.slots.every((s) => s.loaded || s.left)) this.begin();
  }

  /** The latest input of a human; the edges are kept until the next tick picks them up. */
  input(memberId: number, i: TickInput): void {
    const idx = this.slotOf.get(memberId);
    if (idx === undefined) return;
    const slot = this.slots[idx];
    if (slot.left) return;
    slot.steer = i[0];
    slot.throttle = i[1];
    slot.brake = i[2];
    slot.held = i[3];
    slot.edges |= i[4];
  }

  /** A human reports the hash of a tick; when every active human has reported it, they are compared. */
  hash(memberId: number, tick: number, h: string): void {
    const idx = this.slotOf.get(memberId);
    if (idx === undefined) return;
    if (this.slots[idx].left) return;
    let entry = this.hashes.get(tick);
    if (!entry) {
      entry = { values: new Map<number, string>(), resolved: false };
      this.hashes.set(tick, entry);
    }
    if (entry.resolved) return;
    entry.values.set(memberId, h);
    const active = this.slots.filter((s) => !s.left);
    if (active.length === 0 || entry.values.size < active.length) return;
    entry.resolved = true;
    const first = entry.values.values().next().value;
    for (const v of entry.values.values()) {
      if (v !== first) {
        this.room.broadcast({ t: 'desync', tick });
        this.finish('desync');
        return;
      }
    }
    this.pruneHashes();
  }

  /** A human's local race is over. */
  markDone(memberId: number): void {
    const idx = this.slotOf.get(memberId);
    if (idx === undefined) return;
    const slot = this.slots[idx];
    if (slot.done) return;
    slot.done = true;
    if (!this.graceStarted) {
      this.graceStarted = true;
      this.graceTimer = setTimeout(() => this.finish('grace'), this.opts.graceMs);
    }
    const active = this.slots.filter((s) => !s.left);
    if (active.length > 0 && active.every((s) => s.done)) this.finish('done');
  }

  /** A human left the room: its slot sends idle input and the next tick marks it. */
  memberLeft(memberId: number): void {
    const idx = this.slotOf.get(memberId);
    if (idx === undefined) return;
    const slot = this.slots[idx];
    if (slot.left) return;
    slot.left = true;
    slot.steer = 0;
    slot.throttle = 0;
    slot.brake = 0;
    slot.held = 0;
    slot.edges = 0;
    this.pendingLeft.push(idx);
    if (this.started && this.slots.every((s) => s.left)) this.finish('empty');
  }

  /** The race is over; nothing else happens in this room until the next start. */
  finish(reason: EndReason): void {
    if (this.ended) return;
    this.ended = true;
    this.stopTimers();
    this.room.broadcast({ t: 'end', reason });
    this.room.finish(reason);
  }

  /** The room died with its last member: the race stops without a message. */
  dispose(): void {
    this.ended = true;
    this.stopTimers();
  }

  // ---- the clock

  private begin(): void {
    if (this.started || this.ended) return;
    this.started = true;
    this.clearLoadTimer();
    // the humans that did not load in time are dropped: they are marked in tick 0
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.loaded || slot.left) continue;
      slot.left = true;
      slot.steer = 0;
      slot.throttle = 0;
      slot.brake = 0;
      slot.held = 0;
      this.pendingLeft.push(i);
    }
    this.room.broadcast({ t: 'go' });
    this.opts.log(`room ${this.room.code} go`);
    this.startAt = performance.now();
    this.schedule();
  }

  /** One timer: it emits every tick that is due, so a late timer emits two in a row and never skips a number. */
  private schedule(): void {
    if (this.ended) return;
    const now = performance.now();
    while (this.startAt + this.tick * TICK_MS <= now) this.emitTick();
    const next = this.startAt + this.tick * TICK_MS;
    this.timer = setTimeout(() => this.schedule(), Math.max(0, next - performance.now()));
  }

  private emitTick(): void {
    const inputs: TickInput[] = [];
    for (const slot of this.slots) {
      const edges = slot.edges;
      slot.edges = 0;
      inputs.push([slot.steer, slot.throttle, slot.brake, slot.held, edges]);
    }
    const msg: RelayMsg = { t: 'tick', n: this.tick, i: inputs };
    if (this.pendingLeft.length > 0) {
      msg.left = this.pendingLeft;
      this.pendingLeft = [];
    }
    this.room.broadcast(msg);
    this.tick += 1;
  }

  // ---- the timers

  private pruneHashes(): void {
    if (this.hashes.size <= HASH_MEMORY) return;
    const keys = [...this.hashes.keys()].sort((a, b) => a - b);
    for (const k of keys.slice(0, keys.length - HASH_MEMORY)) this.hashes.delete(k);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer === null) return;
    clearTimeout(this.loadTimer);
    this.loadTimer = null;
  }

  private stopTimers(): void {
    this.clearLoadTimer();
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.graceTimer !== null) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }
}
