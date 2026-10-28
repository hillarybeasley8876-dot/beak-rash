// The wire protocol between the game client (src/net/) and the relay (relay/, Deno) — SPEC §28. JSON text frames.
// Shared by both sides, so it stays pure: no DOM, no Deno, no imports. The relay has no game logic: it keeps rooms,
// forwards the host's RaceConfig untouched, and once everyone has loaded it paces the race at TICK_RATE ticks a
// second, bundling the latest input of every human into one `tick` message.

export const PROTOCOL_VERSION = 1;
/** Ticks per second; one tick = TICK_SUBSTEPS sim substeps of 1/120 s. */
export const TICK_RATE = 60;
export const TICK_SUBSTEPS = 2;
export const TICK_DT = 1 / TICK_RATE;
export const MAX_HUMANS = 4;
/** Room codes: CODE_LENGTH letters from an alphabet without the look-alikes I O 0 1 L. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
/** Ticks between two state hashes (desync detection). */
export const HASH_EVERY = 60;
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_MESSAGES_PER_SECOND = 120;
export const IDLE_TIMEOUT_MS = 20000;
/** After `start`, how long the relay waits for every human's `loaded` before it starts without the late ones. */
export const LOAD_TIMEOUT_MS = 30000;
/** After the first human's `done`, how long the race may run before the relay ends it for everyone. */
export const FINISH_GRACE_MS = 45000;
export const NAME_MAX = 12;

/** Held controls: one bit each in TickInput[3]. */
export const HELD_BITS = { drift: 1, lookBack: 2, heavyHeld: 4 } as const;
/** Edge controls: one bit each in TickInput[4]; an edge is true for exactly one tick. */
export const EDGE_BITS = { hop: 1, attackL: 2, attackR: 4, heavy: 8, skill1: 16, skill2: 32, skill3: 64, ult: 128, bell: 256 } as const;
export type HeldKey = keyof typeof HELD_BITS;
export type EdgeKey = keyof typeof EDGE_BITS;

/** One human's input: [steer −127..127, throttle 0..255, brake 0..255, held bits, edge bits]. */
export type TickInput = [number, number, number, number, number];
export const IDLE_INPUT: Readonly<TickInput> = [0, 0, 0, 0, 0];

/** The controls a client packs (the game's Controls, structurally). */
export interface ControlsLike {
  steer: number; throttle: number; brake: number;
  drift: boolean; lookBack: boolean; heavyHeld: boolean;
  hop: boolean; attackL: boolean; attackR: boolean; heavy: boolean;
  skill1: boolean; skill2: boolean; skill3: boolean; ult: boolean; bell: boolean;
}

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : 0)));

/** Quantise controls for the wire. The sender's own rider uses the unpacked value too (never its raw input). */
export function packInput(c: ControlsLike): TickInput {
  let held = 0;
  for (const k of Object.keys(HELD_BITS) as HeldKey[]) if (c[k]) held |= HELD_BITS[k];
  let edges = 0;
  for (const k of Object.keys(EDGE_BITS) as EdgeKey[]) if (c[k]) edges |= EDGE_BITS[k];
  return [clampInt(c.steer * 127, -127, 127), clampInt(c.throttle * 255, 0, 255), clampInt(c.brake * 255, 0, 255), held, edges];
}

/** Write a wire input into `out` (all fields; edges true only when their bit is set). */
export function unpackInput(i: Readonly<TickInput>, out: ControlsLike): ControlsLike {
  out.steer = i[0] / 127;
  out.throttle = i[1] / 255;
  out.brake = i[2] / 255;
  for (const k of Object.keys(HELD_BITS) as HeldKey[]) out[k] = (i[3] & HELD_BITS[k]) !== 0;
  for (const k of Object.keys(EDGE_BITS) as EdgeKey[]) out[k] = (i[4] & EDGE_BITS[k]) !== 0;
  return out;
}

/** A well-formed TickInput (integers in range). */
export function isTickInput(x: unknown): x is TickInput {
  return Array.isArray(x) && x.length === 5 && x.every((v) => Number.isInteger(v))
    && x[0] >= -127 && x[0] <= 127 && x[1] >= 0 && x[1] <= 255 && x[2] >= 0 && x[2] <= 255
    && x[3] >= 0 && x[3] < 8 && x[4] >= 0 && x[4] < 512;
}

/** What a member rides (the lobby's pick; ids are the game's CharacterId / BikeId / skill ids). */
export interface MemberPick {
  character: string;
  bike: string;
  loadout: { slots: Array<string | null>; ult: string | null };
}

export interface Member extends MemberPick {
  /** Unique per connection for the relay's lifetime. */
  id: number;
  name: string;
  ready: boolean;
}

/** The host's race setup shown in the lobby (the RaceConfig is built from it at start). */
export interface RoomSetup {
  trackId: string;
  weather: string | null;
  reverse: boolean;
}

export type RoomState = 'lobby' | 'loading' | 'racing';

export type ErrorCode =
  | 'version' | 'bad_message' | 'too_big' | 'rate' | 'no_room' | 'full' | 'started' | 'not_host'
  | 'not_in_room' | 'not_ready' | 'bad_humans' | 'idle';

// ---- client → relay
export type ClientMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'create' }
  | { t: 'join'; code: string }
  | ({ t: 'pick' } & MemberPick)
  | { t: 'ready'; ready: boolean }
  /** host only, in the lobby */
  | { t: 'setup'; setup: RoomSetup }
  /** host only, every member ready: the full RaceConfig; `humans` = member ids in rider-slot order (slot i ↔ humans[i]) */
  | { t: 'start'; config: unknown; humans: number[] }
  /** this client has built the race and is ready for tick 0 */
  | { t: 'loaded' }
  /** the latest input; edge bits = presses since the previous `in` */
  | { t: 'in'; i: TickInput }
  /** state hash of the tick `tick` (a multiple of HASH_EVERY), after it was simulated */
  | { t: 'hash'; tick: number; h: string }
  /** this client's local race is over (results shown) */
  | { t: 'done' }
  | { t: 'leave' }
  | { t: 'ping'; at: number };

// ---- relay → client
export type RelayMsg =
  /** answer to hello: this connection's member id */
  | { t: 'welcome'; v: number; id: number }
  /** the room changed (sent to every member) */
  | { t: 'room'; code: string; host: number; members: Member[]; setup: RoomSetup | null; state: RoomState }
  /** the host started: the RaceConfig as the host sent it and the rider-slot order */
  | { t: 'start'; config: unknown; humans: number[] }
  /** every human has loaded (or the load timeout passed): tick 0 follows */
  | { t: 'go' }
  /** one tick: i[slot] for every human slot; `left` = the slots whose human left right before this tick */
  | { t: 'tick'; n: number; i: TickInput[]; left?: number[] }
  /** the hashes of tick `tick` differ between clients: the race is over */
  | { t: 'desync'; tick: number }
  /** the race is over for everyone (all done, every human left, or the finish grace ran out): back to the lobby */
  | { t: 'end'; reason: 'done' | 'grace' | 'empty' | 'desync' }
  | { t: 'error'; code: ErrorCode; msg: string }
  | { t: 'pong'; at: number; now: number };

/** A room code in canonical form (upper case), or null if it cannot be one. */
export function normaliseCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}
