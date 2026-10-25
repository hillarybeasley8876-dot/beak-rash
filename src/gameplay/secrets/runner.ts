// The easter eggs of SPEC §21: 小黄鸭 ducks, the SVG easel, the goose poem, the lazy sloth and the pelican god.
// The module is a per-session module (core loads it like the STYLE chains): it places its props in the world,
// watches the bus and the input, and records every first find in the profile.
import { Vector3 } from 'three';
import type { AppContext, Session } from '../../core/contracts';
import type { GameEvents } from '../../core/events-map';
import { hashString } from '../../core/rng';
import type { RiderId, Vec3Like } from '../../core/types';
import { SECRET_LINES } from '../../data/secret-lines';
import { seededRange } from './placement';
import { SecretProps } from './props';
import { duckCount, recordSecret } from './records';
import { DUCK, DUCK_IDS, EASEL, GOOSE, GOD, SLOTH } from './tuning';

export interface SecretEntry {
  id: string;
  kind: string;
  s: number;
  x: number;
  obstacleId?: number;
}

export interface SecretsDebug {
  list(): SecretEntry[];
  forceGod(): void;
  godPlanned(): boolean;
}

interface GodState {
  planned: boolean;
  start: number;
  active: boolean;
  found: boolean;
  t: number;
  s: number;
  x: number;
}

/** The pelican god only shows up on these tracks (SPEC §21 #7). */
const godTracks = (track: string): boolean => track === 'coast' || track === 'mountain';

/** Is the god planned for this race? 1 race in 15, from the race seed (SPEC §21 #7). */
export function godPlanned(track: string, seed: number): boolean {
  if (!godTracks(track)) return false;
  return hashString(`pelican-god|${track}|${seed}`) % GOD.odds === 0;
}

/** When (seconds after GO) the god drifts across the sky. */
function godStart(track: string, seed: number): number {
  return seededRange(`pelican-god|${track}|${seed}|t`, GOD.minDelay, GOD.maxDelay);
}

export class SecretsRunner {
  private session: Session | null = null;
  private props: SecretProps | null = null;
  private offs: Array<() => void> = [];
  private god: GodState = { planned: false, start: 0, active: false, found: false, t: 0, s: 0, x: 0 };
  private taps: number[] = [];
  private idle = 0;
  private slothFound = false;
  private gooseFound = false;
  private slothBoostIn = -1;
  private planned = false;
  private forceNext = false;
  private tmp = new Vector3();
  private readonly debug: SecretsDebug;

  constructor(private readonly app: AppContext) {
    this.debug = {
      list: () => this.list(),
      forceGod: () => this.forceGod(),
      godPlanned: () => this.plannedNow(),
    };
    this.expose();
  }

  // ------------------------------------------------------------ session
  attach(session: Session | null): void {
    this.detach();
    this.session = session;
    if (!session) return;
    this.expose();
    this.planned = godPlanned(session.config.trackId, session.config.seed);
    this.god = {
      planned: this.planned, start: godStart(session.config.trackId, session.config.seed),
      active: false, found: false, t: 0, s: 0, x: 0,
    };
    if (this.forceNext) {
      this.forceNext = false;
      this.god.planned = true;
      this.god.start = 0;
    }
    this.props = new SecretProps(session);
    this.props.place();
    this.offs = this.listen();
  }

  private detach(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.props?.remove();
    this.props = null;
    this.session = null;
    this.taps = [];
    this.idle = 0;
    this.slothFound = false;
    this.gooseFound = false;
    this.slothBoostIn = -1;
    this.god = { planned: false, start: 0, active: false, found: false, t: 0, s: 0, x: 0 };
    this.hide();
  }

  dispose(): void {
    this.detach();
    this.hide();
  }

  private listen(): Array<() => void> {
    const bus = this.app.bus;
    return [
      bus.on('combat:obstacleHit', (e) => this.onObstacleHit(e)),
      bus.on('police:bribe', (e) => this.onBribe(e)),
      this.app.input.onAction((action) => { if (action === 'bell') this.onBell(); }),
    ];
  }

  // ------------------------------------------------------------ per frame
  update(dtSim: number): void {
    const session = this.session;
    if (!session) return;
    this.updateDuck(dtSim);
    this.updateEasel(dtSim);
    this.updateGod(dtSim);
    if (session.phase === 'racing') this.updateIdle(dtSim);
  }

  /** The duck bobs on its spot; the player rides within reach of it and it is found. */
  private updateDuck(dt: number): void {
    const duck = this.props?.duck;
    const session = this.session;
    if (!duck || !session) return;
    duck.t += dt;
    duck.group.position.y = duck.base.y + Math.sin(duck.t * DUCK.bobRate) * DUCK.bobAmp;
    duck.group.rotation.y = duck.yaw + Math.sin(duck.t * DUCK.bobRate * 0.7) * 0.3;
    if (duck.found || session.phase !== 'racing') return;
    const p = session.player;
    if (Math.hypot(p.s - duck.spot.s, p.x - duck.spot.x) <= DUCK.findRadius) this.findDuck();
  }

  /** The easel spins after a thrown weapon hit it. */
  private updateEasel(dt: number): void {
    const easel = this.props?.easel;
    if (!easel || !easel.spinning) return;
    easel.spin += dt * EASEL.spin;
    easel.group.rotation.y = easel.yaw + easel.spin;
  }

  /** The god drifts across the sky for 12 s when its seeded moment comes. */
  private updateGod(dt: number): void {
    const session = this.session;
    const god = this.god;
    if (!session) return;
    if (!god.active) {
      if (god.planned && !god.found && session.phase === 'racing' && session.time >= god.start) this.showGod();
      return;
    }
    god.t += dt;
    const k = god.t / GOD.duration;
    if (k >= 1) {
      this.hideGod();
      return;
    }
    const p = session.player;
    const lateral = -GOD.spread + 2 * GOD.spread * k;
    const pos = session.track.toWorld(p.s + GOD.ahead, lateral, GOD.height, this.tmp);
    god.s = p.s + GOD.ahead;
    god.x = lateral;
    const group = this.props?.god;
    if (group) group.position.copy(pos);
  }

  /** 8 s without pedalling after GO: the sloth stops too (SPEC §21 #6). */
  private updateIdle(dt: number): void {
    const session = this.session;
    if (!session) return;
    if (this.slothBoostIn > 0) {
      this.slothBoostIn -= dt;
      if (this.slothBoostIn <= 0) this.floorIt();
    }
    if (this.slothFound) return;
    const player = session.player;
    const throttle = session.controls.get(player.id)?.throttle ?? 0;
    const idle = throttle <= 0.01 && player.speed < SLOTH.speed;
    this.idle = idle ? this.idle + dt : 0;
    if (this.idle < SLOTH.idle) return;
    const sloth = session.riders.find((r) => r.character === 'sloth' && r.mode !== 'finished');
    if (!sloth) {
      this.idle = 0;   // no sloth in this race: the egg stays hidden
      return;
    }
    this.slothFound = true;
    this.idle = 0;
    this.find('sloth', sloth.id, this.worldOf(sloth));
    sloth.statuses.push({ id: 'slow', time: SLOTH.stop, strength: SLOTH.slow, source: player.id });
    this.app.bus.emit('taunt', { riderId: sloth.id, text: SECRET_LINES.sloth, character: 'sloth' });
    this.slothBoostIn = SLOTH.stop;
  }

  /** …and then the sloth floors it with 闪电. */
  private floorIt(): void {
    const session = this.session;
    if (!session) return;
    const sloth = session.riders.find((r) => r.character === 'sloth');
    if (!sloth) return;
    sloth.boostTime = SLOTH.boost;
    sloth.boostPower = SLOTH.boostPower;
  }

  // ------------------------------------------------------------ events
  /** A THROWN weapon on the easel finds it; a melee hit does nothing (SPEC §21 #4). */
  private onObstacleHit(e: GameEvents['combat:obstacleHit']): void {
    const easel = this.props?.easel;
    const session = this.session;
    if (!easel || !session || easel.found) return;
    if (e.obstacleId !== easel.obstacle.id || !e.thrown) return;
    if (e.attacker !== session.player.id) return;
    easel.found = true;
    easel.spinning = true;
    this.find(easel.id, session.player.id, easel.group.position);
    session.player.coins += EASEL.coins;
    this.app.ui.toast(SECRET_LINES.svg, 'meme');
    this.app.audio.sfx('ui.coin');
  }

  /** 「V我50」: an accepted bribe of the player is an egg too (SPEC §21 #3). */
  private onBribe(e: GameEvents['police:bribe']): void {
    const session = this.session;
    if (!session || !e.accepted || e.riderId !== session.player.id) return;
    this.find('bribe', e.riderId, null);
  }

  /** Every raw bell press: three of them near the goose recite the poem, one under the god is a prayer. */
  private onBell(): void {
    const session = this.session;
    if (!session) return;
    const now = session.time;
    this.taps = this.taps.filter((t) => now - t <= GOOSE.window);
    this.taps.push(now);
    this.checkGod();
    if (this.taps.length < GOOSE.presses) return;
    this.taps = [];
    this.checkGoose();
  }

  /** The goose within 8 m goes berserk and recites (SPEC §21 #5). */
  private checkGoose(): void {
    const session = this.session;
    if (!session || this.gooseFound) return;
    const goose = session.riders.find((r) => r.character === 'goose' && r.mode !== 'finished');
    if (!goose) return;
    const player = session.player;
    if (Math.hypot(goose.s - player.s, goose.x - player.x) > GOOSE.range) return;
    this.gooseFound = true;
    this.find('goose_poem', goose.id, this.worldOf(goose));
    goose.statuses.push({ id: 'angry', time: GOOSE.berserk, strength: 1, source: player.id });
    goose.boostTime = GOOSE.berserk;
    goose.boostPower = GOOSE.boostPower;
    this.app.bus.emit('taunt', { riderId: goose.id, text: SECRET_LINES.goose, character: 'goose' });
  }

  /** A bell under the cloud pelican: 心诚则灵 (SPEC §21 #7). */
  private checkGod(): void {
    const session = this.session;
    if (!session || !this.god.active || this.god.found) return;
    this.god.found = true;
    this.find('pelican_god', session.player.id, this.worldOf(session.player));
    session.player.coins += GOD.coins;
    this.app.ui.toast(SECRET_LINES.god, 'meme');
    this.app.audio.sfx('ui.coin');
  }

  // ------------------------------------------------------------ finds
  private findDuck(): void {
    const duck = this.props?.duck;
    const session = this.session;
    if (!duck || !session) return;
    duck.found = true;
    this.find(duck.id, session.player.id, { x: duck.base.x, y: duck.base.y, z: duck.base.z });
    this.app.audio.sfx(DUCK.quack);
    const n = duckCount(this.app);
    this.app.ui.toast(SECRET_LINES.duck(n), 'meme');
    if (n >= DUCK_IDS.length) this.app.ui.toast(SECRET_LINES.duckAll, 'meme');
  }

  /** Record the egg in the profile and announce it (SPEC §21). */
  private find(id: string, riderId: RiderId | null, pos: Vec3Like | null): void {
    const first = recordSecret(this.app, id);
    this.app.bus.emit('secret:found', { id, riderId, pos, first });
  }

  private worldOf(rider: { s: number; x: number }): Vec3Like | null {
    const session = this.session;
    if (!session) return null;
    const p = session.track.toWorld(rider.s, rider.x, 0, this.tmp);
    return { x: p.x, y: p.y, z: p.z };
  }

  // ------------------------------------------------------------ the god
  private showGod(): void {
    const props = this.props;
    if (!props) return;
    props.showGod();
    this.god.active = true;
    this.god.t = 0;
  }

  private hideGod(): void {
    this.props?.hideGod();
    this.god.active = false;
  }

  // ------------------------------------------------------------ debug
  private list(): SecretEntry[] {
    const out: SecretEntry[] = [];
    const duck = this.props?.duck;
    if (duck) out.push({ id: duck.id, kind: 'duck', s: duck.spot.s, x: duck.spot.x });
    const easel = this.props?.easel;
    if (easel) out.push({ id: easel.id, kind: 'svg', s: easel.spot.s, x: easel.spot.x, obstacleId: easel.obstacle.id });
    if (this.god.active) out.push({ id: 'pelican_god', kind: 'god', s: this.god.s, x: this.god.x });
    return out;
  }

  /** Force the pelican god into this race (tests). */
  private forceGod(): void {
    this.planned = true;
    const session = this.session;
    if (!session) {
      this.forceNext = true;
      return;
    }
    this.god.planned = true;
    this.god.start = session.time;
    this.showGod();
  }

  /** Is the god planned for this race? (before the race starts: from the URL params) */
  private plannedNow(): boolean {
    if (this.session) return this.planned;
    const track = this.app.params.get('race') ?? this.app.params.get('track') ?? '';
    const seed = Number(this.app.params.get('seed'));
    return godPlanned(track, Number.isFinite(seed) ? seed : 0);
  }

  private expose(): void {
    const br = typeof window === 'undefined' ? undefined : (window as unknown as { __br?: { secrets?: SecretsDebug } }).__br;
    if (br) br.secrets = this.debug;
  }

  private hide(): void {
    const br = typeof window === 'undefined' ? undefined : (window as unknown as { __br?: { secrets?: SecretsDebug } }).__br;
    if (br && br.secrets === this.debug) delete br.secrets;
  }
}
