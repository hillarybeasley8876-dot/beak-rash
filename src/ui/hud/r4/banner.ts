// The r4 diagonal warning banner (SPEC §14 / §18 / §19): a red/white tape band under the progress
// strip that shouts one line — 前方设卡！ (roadblock), 围剿！ (alliance) or a track-event warning.
import type { CharacterId } from '../../../core/types';
import { enter, exit, fadeOut, slam } from '../anim';
import { badge } from '../badge';
import { el } from '../dom';

export interface BannerSpec {
  /** The English kicker (Anton). */
  en: string;
  /** The Chinese line (the loud one). */
  cn: string;
  /** Members' portraits, shown at the left of the band (the alliance). */
  faces?: CharacterId[];
  /** 'warn' = red/white hazard tape, 'ally' = ink/yellow tape. */
  tone?: 'warn' | 'ally';
  /** Seconds the banner stays up. */
  life?: number;
}

const LIFE = 2.4;
/** A banner waits at most this long (s) behind a cut-in before it shows over it anyway. */
const MAX_WAIT = 2.5;

interface Live { root: HTMLDivElement; t: number; life: number; wait: number }

export class R4Banner {
  private live: Live | null = null;

  /** `busy`: a splash, the skill band or a cinematic owns the screen — the banner waits (hidden, clock stopped). */
  constructor(private host: HTMLElement, private busy: () => boolean = () => false) {}

  /** Show a banner now: the one on stage leaves at once (the newest warning is the one that matters). */
  show(spec: BannerSpec): void {
    this.clear();
    const root = el('div', `rb ${spec.tone === 'ally' ? 'alt' : ''}`.trim(), this.host);
    el('div', 'rb-band', root);
    const text = el('div', 'rb-text', root);
    el('b', '', text, spec.en);
    el('i', '', text, spec.cn);
    if (spec.faces?.length) {
      const faces = el('div', 'rb-faces', root);
      for (const c of spec.faces) faces.append(badge(c));
    }
    const life = spec.life ?? LIFE;
    this.live = { root, t: 0, life, wait: 0 };
    this.frame(this.live, 0);
    if (this.busy()) root.style.visibility = 'hidden';
  }

  clear(): void {
    this.live?.root.remove();
    this.live = null;
  }

  update(dt: number): void {
    const l = this.live;
    if (!l) return;
    // Behind a cut-in the banner would pile on top of it: wait (hidden, its clock frozen) until the screen is free.
    if (l.t === 0 && l.wait < MAX_WAIT && this.busy()) {
      l.wait += dt;
      l.root.style.visibility = 'hidden';
      return;
    }
    l.root.style.visibility = '';
    l.t += dt;
    if (l.t >= l.life) {
      this.clear();
      return;
    }
    this.frame(l, l.t);
  }

  /** The band slashes in from the left and leaves to the right; the lettering slams on top of it. */
  private frame(l: Live, t: number): void {
    const inT = enter(t, 0.15);
    const outT = exit(t, l.life, 0.22);
    const band = l.root.firstElementChild as HTMLElement;
    band.style.transform = `translateX(${((1 - inT) * -2600 + outT * 2600).toFixed(0)}px) skewX(-14deg)`;
    const text = l.root.children[1] as HTMLElement;
    text.style.transform = `skewX(-14deg) scale(${slam(t - 0.06, 0.16, 1.5).toFixed(3)})`;
    text.style.opacity = t < 0.06 ? '0' : '1';
    l.root.style.opacity = fadeOut(t, l.life, 0.2).toFixed(3);
    const faces = l.root.querySelector('.rb-faces') as HTMLElement | null;
    if (faces) faces.style.transform = `translateX(${((1 - enter(t, 0.16, 0.08)) * -220).toFixed(0)}px)`;
  }
}
