// The room of this client (SPEC §28): what the relay says about the lobby (the members, the host, the setup,
// the state) and the commands the lobby sends. The relay is the only truth about the room — the client never
// guesses a member's state.
import { buildOnlineConfig } from './config';
import type { NetMember, NetRoom } from '../core/contracts';
import type { ClientMsg, Member, MemberPick, RoomSetup } from './protocol';

/** The setup a room has before the host picks one. */
const DEFAULT_SETUP: RoomSetup = { trackId: 'coast', weather: null, reverse: false };

export class RoomState {
  /** The lobby as the last `room` message said it is (null when this client is in no room). */
  current: NetRoom | null = null;
  /** This client's member id (the relay's `welcome`). */
  you = 0;

  constructor(private readonly send: (msg: ClientMsg) => void) {}

  /** The relay told us who we are. */
  setYou(id: number): void {
    this.you = id;
    if (this.current) this.current.you = id;
  }

  /** The relay's lobby. */
  apply(msg: { code: string; host: number; members: Member[]; setup: RoomSetup | null; state: NetRoom['state'] }): void {
    const members: NetMember[] = msg.members.map((m) => ({
      id: m.id,
      name: m.name,
      ready: m.ready,
      character: m.character,
      bike: m.bike,
      loadout: { slots: m.loadout.slots.slice(), ult: m.loadout.ult },
    }));
    this.current = {
      code: msg.code,
      host: msg.host,
      you: this.you,
      members,
      setup: msg.setup,
      state: msg.state,
    };
  }

  /** This client is in no room any more. */
  clear(): void {
    this.current = null;
  }

  /** The members in join order — the slot order of the race. */
  get members(): readonly NetMember[] {
    return this.current?.members ?? [];
  }

  /** Is this client the host? */
  get isHost(): boolean {
    return !!this.current && this.current.host === this.you;
  }

  /** Is every member ready? */
  get allReady(): boolean {
    const members = this.members;
    return members.length > 0 && members.every((m) => m.ready);
  }

  // ---- the commands of the lobby
  /** Open a new room (this client becomes its host). */
  create(): void {
    this.send({ t: 'create' });
  }

  /** Join a room by its code. */
  join(code: string): void {
    this.send({ t: 'join', code });
  }

  /** What this member rides. */
  pick(p: MemberPick): void {
    this.send({ t: 'pick', ...p });
  }

  /** This member is (not) ready any more. */
  ready(on: boolean): void {
    this.send({ t: 'ready', ready: on });
  }

  /** The host picks the track, the weather and the direction. */
  setup(s: RoomSetup): void {
    this.send({ t: 'setup', setup: s });
  }

  /** Leave the room (the relay forgets the member). */
  leave(): void {
    this.send({ t: 'leave' });
  }

  /**
   * The host starts the race: it builds the config (config.ts) and the relay forwards it to every member.
   * The rider slots are the members in join order — the relay's ticks use that order.
   */
  start(): void {
    const room = this.current;
    if (!room) {
      console.warn('[net] there is no room to start');
      return;
    }
    if (!this.isHost) {
      console.warn('[net] only the host starts the race');
      return;
    }
    if (!this.allReady) {
      console.warn('[net] not every member is ready');
      return;
    }
    const config = buildOnlineConfig(room.code, room.members, room.setup ?? DEFAULT_SETUP);
    this.send({ t: 'start', config, humans: room.members.map((m) => m.id) });
  }
}
