// The r4 race HUD (SPEC §14–§19): every r4 mechanic gets a HUD reaction — the wanted stars and the
// police warnings, the air-trick card, the STYLE meter, the throw hint and the parry, the 宿敌 / 围剿
// rival marks and the track-event banners. Pure presentation: it reads the bus and the session only.
import type { Session } from '../../../core/contracts';
import type { EventBus } from '../../../core/events';
import type { GameEvents } from '../../../core/events-map';
import type { CharacterId, RiderId, WeaponId } from '../../../core/types';
import { R4_HUD as S } from '../../../data/strings';
import type { Cluster } from '../cluster';
import type { CutinLayer } from '../cutins/layer';
import type { WorldOverlay } from '../world/overlay';
import type { Projector } from '../world/project';
import { R4Banner } from './banner';
import { BatonWarn, WantedBadge } from './police';
import { ParryPop, TrickPop } from './pops';
import { StyleMeter } from './style';
import '../css/r4.css';

/** The throw hint is shown once per profile (SPEC §15). */
const THROW_KEY = 'beak-rash.hint.throw';
/** Weapons the player can throw: everything but bare wings and the police's baton. */
const THROWABLE: ReadonlySet<WeaponId> = new Set<WeaponId>(['saltfish', 'baguette', 'pan', 'leek', 'umbrella', 'selfie', 'slipper', 'keyboard']);

export interface R4Deps {
  session(): Session | null;
  world: WorldOverlay;
  cutins: CutinLayer;
  cluster(): Cluster | null;
}

/** localStorage may be blocked (private mode): the hint then shows every time. */
function hintSeen(): boolean {
  try {
    return localStorage.getItem(THROW_KEY) !== null;
  } catch (err) {
    console.warn('[ui-hud] cannot read the throw hint flag', err);
    return false;
  }
}

function rememberHint(): void {
  try {
    localStorage.setItem(THROW_KEY, '1');
  } catch (err) {
    console.warn('[ui-hud] cannot remember the throw hint', err);
  }
}

export class R4Hud {
  private wanted: WantedBadge;
  private baton: BatonWarn;
  private banner: R4Banner;
  private style: StyleMeter;
  private trick: TrickPop;
  private parry: ParryPop;
  private offs: Array<() => void> = [];
  /** The rival holding the biggest grudge (SPEC §18). */
  private nemesisId: RiderId | null = null;
  /** The allies of the current 围剿 (SPEC §18). */
  private allies = new Set<RiderId>();
  /** The 宿敌 card waits for the intro flyover to be over. */
  private pendingCard: { character: CharacterId; grudge: number } | null = null;

  constructor(bus: EventBus<GameEvents>, private deps: R4Deps, corner: HTMLElement, popHost: HTMLElement, stage: HTMLElement) {
    this.wanted = new WantedBadge(corner);
    this.style = new StyleMeter(corner);
    this.banner = new R4Banner(stage);
    this.baton = new BatonWarn(popHost);
    this.trick = new TrickPop(popHost);
    this.parry = new ParryPop(popHost);
    this.wire(bus);
  }

  /** Bus → HUD routing: every handler is presentation-only and tolerant of a missing session. */
  private wire(bus: EventBus<GameEvents>): void {
    const me = (id: RiderId | null): boolean => id !== null && this.deps.session()?.player.id === id;
    const offs = this.offs;
    offs.push(bus.on('police:wanted', (e) => {
      if (me(e.riderId)) this.wanted.set(e.level);
    }));
    offs.push(bus.on('police:windup', (e) => {
      if (me(e.riderId)) this.baton.show(e.obstacleId, e.pos, e.time);
    }));
    offs.push(bus.on('police:roadblock', (e) => {
      if (!me(e.riderId)) return;
      this.banner.show({ en: S.roadblock.en, cn: S.roadblock.cn });
    }));
    offs.push(bus.on('police:down', () => this.deps.cutins.policeDown()));
    offs.push(bus.on('police:hurt', (e) => this.deps.world.onPoliceHurt(e)));
    offs.push(bus.on('police:bribe', (e) => {
      if (!me(e.riderId)) return;
      if (e.accepted) this.deps.cutins.note(`bribe:${e.obstacleId}`, S.bribeOk, `V我${e.amount} −${e.amount}`);
      else this.deps.cutins.note(`bribe:${e.obstacleId}`, S.bribeNo.en, S.bribeNo.cn);
    }));
    offs.push(bus.on('rider:trick', (e) => {
      if (me(e.riderId)) this.trickShow(e);
    }));
    offs.push(bus.on('style:chain', (e) => {
      if (me(e.riderId)) this.style.chain(e);
    }));
    offs.push(bus.on('style:bank', (e) => {
      if (me(e.riderId)) this.style.bank(e);
    }));
    offs.push(bus.on('combat:weaponPick', (e) => {
      if (me(e.riderId)) this.weaponPick(e);
    }));
    offs.push(bus.on('combat:weaponDrop', (e) => {
      if (me(e.riderId)) this.deps.cluster()?.weapon.clearPicked();
    }));
    offs.push(bus.on('combat:weaponBreak', (e) => {
      if (me(e.riderId)) this.deps.cluster()?.weapon.clearPicked();
    }));
    offs.push(bus.on('combat:parry', (e) => {
      if (me(e.riderId)) this.parry.showParry();
    }));
    offs.push(bus.on('race:nemesis', (e) => this.nemesis(e)));
    offs.push(bus.on('race:nemesisDown', (e) => this.nemesisDown(e)));
    offs.push(bus.on('race:alliance', (e) => this.alliance(e)));
    offs.push(bus.on('race:event', (e) => this.trackEvent(e)));
  }

  /** The trick card: the trick's name and its points (a red FAIL stamp on a botched one). */
  private trickShow(e: GameEvents['rider:trick']): void {
    if (e.phase === 'fail') {
      this.trick.show({ cls: 'brh-trick', en: S.trickFail.en, cn: S.trickFail.cn, fail: true, life: 1.2 });
      return;
    }
    if (e.phase !== 'land') return;
    const def = S.trick[e.kind];
    const count = e.count > 1 ? ` ×${e.count}` : '';
    this.trick.show({ cls: 'brh-trick', en: def.en, cn: def.cn, points: `+${e.points}${count}` });
  }

  /** The first weapon of a profile teaches the throw; the slot also names the weapon's trait. */
  private weaponPick(e: GameEvents['combat:weaponPick']): void {
    this.deps.cluster()?.weapon.setPicked(e.weapon);
    if (!THROWABLE.has(e.weapon) || hintSeen()) return;
    rememberHint();
    this.deps.cutins.hint('throw', S.throw.en, S.throw.hold, 'heavy', S.throw.cn);
  }

  /** The nemesis: a red 宿敌 card and a 宿敌 badge on that rider's name tag. */
  private nemesis(e: GameEvents['race:nemesis']): void {
    this.nemesisId = e.riderId;
    this.deps.world.setTagMark(e.riderId, 'nemesis');
    const s = this.deps.session();
    if (s && s.phase === 'intro') this.pendingCard = { character: e.character, grudge: e.grudge };
    else this.deps.cutins.nemesis(e.character, e.grudge);
  }

  private nemesisDown(e: GameEvents['race:nemesisDown']): void {
    if (this.nemesisId !== e.riderId) return;
    this.nemesisId = null;
    this.deps.world.setTagMark(e.riderId, '');
  }

  /** The alliance: 围剿！ with the members' portraits and a chain link on their name tags. */
  private alliance(e: GameEvents['race:alliance']): void {
    if (e.phase === 'form') {
      for (const m of this.allies) this.deps.world.setTagMark(m, '');
      this.allies = new Set(e.members);
      for (const m of e.members) this.deps.world.setTagMark(m, 'ally');
      const s = this.deps.session();
      const faces = e.members
        .map((id) => s?.rider(id)?.character)
        .filter((c): c is CharacterId => c !== undefined);
      this.banner.show({ en: S.alliance.en, cn: S.alliance.cn, faces, tone: 'ally' });
      return;
    }
    for (const m of this.allies) this.deps.world.setTagMark(m, '');
    for (const m of e.members) this.deps.world.setTagMark(m, '');
    this.allies.clear();
    if (e.reason === 'betrayal') this.banner.show({ en: S.betrayal.en, cn: S.betrayal.cn });
  }

  /** A track event warns the player: a diagonal banner over the road. */
  private trackEvent(e: GameEvents['race:event']): void {
    if (e.phase !== 'warn') return;
    const s = S.event[e.kind];
    if (!s.cn) return;
    this.banner.show({ en: s.en, cn: s.cn });
  }

  /** A new race: every r4 reaction starts from scratch. */
  attach(): void {
    this.banner.clear();
    this.wanted.set(0);
    this.style.clear();
    this.baton.clear();
    this.trick.clear();
    this.parry.clear();
    this.nemesisId = null;
    this.allies.clear();
    this.pendingCard = null;
  }

  update(dt: number, k: number, proj: Projector): void {
    const s = this.deps.session();
    this.wanted.update(dt);
    this.style.update(dt);
    this.banner.update(dt);
    if (!s) return;
    this.baton.update(s, proj, k, dt);
    this.trick.update(s, proj, k, dt);
    this.parry.update(s, proj, k, dt);
    if (this.pendingCard && s.phase !== 'intro') {
      const card = this.pendingCard;
      this.pendingCard = null;
      this.deps.cutins.nemesis(card.character, card.grudge);
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
