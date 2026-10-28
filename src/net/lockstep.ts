// The lockstep driver of an online race (SPEC §28): the local input goes out, the relay's ticks come in, and
// the race only moves on those ticks. The sim is deterministic, so every client that applies the same ticks
// ends in the same state — the hashes every HASH_EVERY ticks prove it to the relay.
import { HASH_EVERY, TICK_DT, packInput, unpackInput, type ClientMsg, type TickInput } from './protocol';
import { emptyControls } from '../core/types';
import type { AppContext, Session } from '../core/contracts';
import type { Controls, RiderId } from '../core/types';

/** The input goes out at most this often (ms) — a hair under 1/60 s, so a 60 Hz client sends every frame. */
const INPUT_MIN_MS = 15.5;
/** With nothing new to say, the input is repeated at least this often (ms) — the relay's idle timer. */
const INPUT_IDLE_MS = 100;
/** A queue deeper than this means the client fell behind: it runs extra ticks to catch up. */
const CATCHUP_DEPTH = 4;
/** The most ticks one frame may run. */
const MAX_TICKS = 8;
/** How many hashes the debug surface keeps. */
const HASH_LIST = 64;

/** One tick of the relay: the input of every human slot. */
export interface TickMessage {
  t: 'tick';
  n: number;
  i: TickInput[];
  left?: number[];
}

export class Lockstep {
  private queue: TickMessage[] = [];
  private acc = 0;
  private count = 0;
  private hashes: Array<{ tick: number; h: string }> = [];
  private lastSent: TickInput = [0, 0, 0, 0, 0];
  private lastSentAt = -Infinity;
  private edges = 0;
  private pool: Controls[] = [];
  private readonly scratch: Controls = emptyControls();

  constructor(
    private readonly app: AppContext,
    private readonly send: (msg: ClientMsg) => void,
    private readonly session: () => Session | null,
  ) {}

  /** A new race: nothing is queued, nothing is hashed, no input was sent. */
  begin(): void {
    this.queue = [];
    this.acc = 0;
    this.count = 0;
    this.hashes = [];
    this.pool = [];
    this.edges = 0;
    this.lastSent = [0, 0, 0, 0, 0];
    this.lastSentAt = -Infinity;
  }

  /** The race is over: the ticks that come in now are dropped. */
  stop(): void {
    this.queue = [];
  }

  /** A tick from the relay. */
  onTick(msg: TickMessage): void {
    this.queue.push(msg);
  }

  /** The ticks that ran. */
  get ticks(): number {
    return this.count;
  }

  /** The ticks that wait for their turn. */
  get queued(): number {
    return this.queue.length;
  }

  /** The state hashes this client reported. */
  get hashList(): Array<{ tick: number; h: string }> {
    return this.hashes.map((h) => ({ ...h }));
  }

  /**
   * One frame of an online race: the local input goes out, the ticks that arrived run. The race follows the
   * relay's clock: it never runs faster than the real time and it waits when the ticks are late.
   */
  frame(dtReal: number): number {
    const session = this.session();
    if (!session) return 0;
    this.sendInput();
    this.acc += dtReal;
    if (this.queue.length === 0) {
      // The relay is late: the race waits for it — at most one tick of time is banked.
      this.acc = Math.min(this.acc, TICK_DT);
      return 0;
    }
    let want = Math.floor(this.acc / TICK_DT);
    if (want < 0) want = 0;
    let run = Math.min(want, this.queue.length);
    if (this.queue.length > CATCHUP_DEPTH) run = Math.min(MAX_TICKS, this.queue.length);
    this.acc = Math.max(0, this.acc - run * TICK_DT);
    for (let i = 0; i < run; i++) {
      const msg = this.queue.shift();
      if (!msg) break;
      this.runTick(session, msg);
    }
    return run;
  }

  /** One tick: the input of every human goes into its rider's controls, then the sim steps. */
  private runTick(session: Session, msg: TickMessage): void {
    const slots = msg.i.length;
    if (this.pool.length !== slots) {
      this.pool = [];
      for (let i = 0; i < slots; i++) this.pool.push(emptyControls());
    }
    for (let s = 0; s < slots; s++) {
      const input = msg.i[s];
      const c = this.pool[s] as Controls;
      if (input) unpackInput(input, c);
      else Object.assign(c, emptyControls());
    }
    session.tick(this.pool, (msg.left ?? []) as RiderId[]);
    this.count += 1;
    if (msg.n % HASH_EVERY === 0) {
      const h = session.hash();
      this.hashes.push({ tick: msg.n, h });
      if (this.hashes.length > HASH_LIST) this.hashes.shift();
      this.send({ t: 'hash', tick: msg.n, h });
    }
  }

  /**
   * The local input goes out: at most ~60 a second, when it changed or an edge is pending — and at least every
   * 100 ms, so the relay's idle timer never fires. An edge (a skill press) is sent exactly once.
   */
  private sendInput(): void {
    const now = performance.now();
    const since = now - this.lastSentAt;
    if (since < INPUT_MIN_MS) return;
    this.app.input.peek(this.scratch);
    const packed = packInput(this.scratch);
    this.edges |= packed[4];                 // the edge presses since the last send
    const changed = packed[0] !== this.lastSent[0] || packed[1] !== this.lastSent[1]
      || packed[2] !== this.lastSent[2] || packed[3] !== this.lastSent[3];
    if (this.edges === 0 && !changed && since < INPUT_IDLE_MS) return;
    const edges = this.edges;
    this.edges = 0;
    this.lastSent[0] = packed[0];
    this.lastSent[1] = packed[1];
    this.lastSent[2] = packed[2];
    this.lastSent[3] = packed[3];
    this.lastSent[4] = edges;
    this.lastSentAt = now;
    this.send({ t: 'in', i: [this.lastSent[0], this.lastSent[1], this.lastSent[2], this.lastSent[3], edges] });
    this.app.input.consumeEdges();
  }
}
