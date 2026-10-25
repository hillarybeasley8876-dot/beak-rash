// Player-anchored pops: the air-trick card (SPEC §16) and the parry hit (SPEC §15). Both slam in over
// the rider's head and drift up; off screen the card is kept inside the frame.
import { Vector3 } from 'three';
import { clamp } from '../../../core/math';
import type { Session } from '../../../core/contracts';
import { R4_HUD as S } from '../../../data/strings';
import { fadeOut, pop } from '../anim';
import { el, w, type W } from '../dom';
import { newPoint, type Projector } from '../world/project';

export interface PopSpec {
  /** The class of the card (".brh-trick" / ".brh-parry"). */
  cls: string;
  en: string;
  cn: string;
  /** The points line under the name ("" = none). */
  points?: string;
  /** Red card (a failed trick). */
  fail?: boolean;
  life?: number;
}

const LIFE = 1.5;

export class PlayerPop {
  readonly root: HTMLDivElement;
  private en: W;
  private cn: W;
  private pts: W;
  private t = 0;
  private life = 0;
  private pt = newPoint();
  private v = new Vector3();

  constructor(parent: HTMLElement, cls: string) {
    this.root = el('div', cls, parent);
    const inner = el('div', `${cls}-in`, this.root);
    this.en = w(el('span', `${cls}-en`, inner));
    this.cn = w(el('span', `${cls}-cn`, inner));
    this.pts = w(el('span', `${cls}-pts`, inner));
    w(this.root).show(false);
  }

  show(spec: PopSpec): void {
    this.root.className = `${spec.cls}${spec.fail ? ' fail' : ''}`;
    this.en.text(spec.en);
    this.cn.text(spec.cn);
    this.pts.text(spec.points ?? '');
    this.pts.show((spec.points ?? '') !== '');
    this.t = 0;
    this.life = spec.life ?? LIFE;
    w(this.root).show(true);
  }

  /** Drop the card (a new race). */
  clear(): void {
    this.life = 0;
    w(this.root).show(false);
  }

  update(session: Session, proj: Projector, k: number, dt: number): void {
    if (this.life <= 0) return;
    this.t += dt;
    if (this.t >= this.life) {
      this.life = 0;
      w(this.root).show(false);
      return;
    }
    proj.project(proj.riderHead(session, session.player, 0.9, this.v), this.pt);
    const cx = proj.width / 2;
    const x = clamp(this.pt.onScreen ? this.pt.x : cx, 130 * k, proj.width - 130 * k);
    const y = clamp((this.pt.onScreen ? this.pt.y : proj.height * 0.55) - 140 * k, 120 * k, proj.height - 230 * k);
    const s = k * pop(this.t, 0.18, 2.2);
    this.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`;
    this.root.style.opacity = fadeOut(this.t, this.life, 0.3).toFixed(3);
  }
}

/** The trick card: 360° / 后空翻 / 前空翻 / 超人 and the points it scored (a red FAIL stamp on a botched one). */
export class TrickPop extends PlayerPop {
  constructor(parent: HTMLElement) {
    super(parent, 'brh-trick');
  }
}

/** The parry hit: a big 当！ next to the player. */
export class ParryPop extends PlayerPop {
  constructor(parent: HTMLElement) {
    super(parent, 'brh-parry');
  }

  /** `weapon` = the pan that parried (only the pan has the trait). */
  showParry(): void {
    this.show({ cls: 'brh-parry', en: S.parry.en, cn: S.parry.cn, life: 1.2 });
  }
}
