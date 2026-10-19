// Countdown (3-2-1-GO) and the player's skill band (tilted top strip, eyes close-up, nameEn + 中文名).
import '../css/cutins.css';
import type { CharacterId } from '../../../core/types';
import type { SkillDef } from '../../../data/skills';
import { enter, exit, fadeOut, pop, reducedMotion, slam } from '../anim';
import { eyesStrip } from '../badge';
import { el } from '../dom';
import { keyGlyphs, type HudKey } from '../glyphs';
import { starClip } from '../shapes';
import type { CutIn } from './types';

const CN_NUM = ['冲！', '一', '二', '三'];

export function countdownCut(n: number): CutIn {
  const go = n <= 0;
  const root = el('div', `ci ci-cd${go ? ' go' : ''}`);
  const slash = el('div', 'cd-slash', root);
  const burst2 = el('div', 'cd-burst2', root);
  burst2.style.clipPath = starClip(18, 0.8, 0.06, 11 + n);
  const burst = el('div', 'cd-burst', root);
  burst.style.clipPath = starClip(14, 0.7, 0.1, 3 + n);
  const num = el('div', 'cd-num', root, go ? 'GO!' : String(n));
  const cn = el('div', 'cd-cn', root, CN_NUM[Math.max(0, Math.min(3, n))] ?? '');
  const dur = go ? 1.0 : 0.92;
  const tilt = go ? -8 : n % 2 ? -10 : 8;
  return {
    root,
    dur,
    frame(t) {
      const out = exit(t, dur, 0.16);
      const p = pop(t, 0.14, 2);
      const spin = reducedMotion() ? 0 : t * 40;
      burst.style.transform = `scale(${(0.35 + 0.65 * p + out * 0.4).toFixed(3)}) rotate(${spin.toFixed(1)}deg)`;
      burst2.style.transform = `scale(${(0.3 + 0.7 * p + out * 0.5).toFixed(3)}) rotate(${(-spin * 0.6).toFixed(1)}deg)`;
      slash.style.transform = `rotate(${tilt * 0.6}deg) scaleX(${enter(t, 0.1).toFixed(3)})`;
      num.style.transform = `rotate(${(tilt * 0.7).toFixed(1)}deg) scale(${(slam(t, 0.16, 1.8) * (1 + out * 0.3)).toFixed(3)})`;
      cn.style.transform = `translateX(-50%) rotate(${-tilt * 0.4}deg) scale(${slam(t - 0.06, 0.14, 1.6).toFixed(3)})`;
      root.style.opacity = fadeOut(t, dur, 0.16).toFixed(3);
    },
  };
}

/** The player's skill band (top strip, clear of the road; css/cutins.css). `thin()` slims it further for
 *  skills whose projectile is in flight (combat's projectile:spawn in the same tick). */
export interface BandCut extends CutIn {
  readonly skillId: string;
  thin(): void;
}

/** s on screen (acceptance r1: ≤ 0.45 s), slide-in and slide-out. */
const BAND_DUR = 0.45;
const BAND_IN = 0.09;
const BAND_OUT = 0.1;
const BAND_SWEEP = 2400;

export function skillBand(def: SkillDef, character: CharacterId, key: HudKey): BandCut {
  const root = el('div', 'ci ci-band');
  const strip = el('div', 'bd-strip', root);
  el('div', 'bd-lines', strip);
  const eyesHost = el('div', 'bd-eyes', strip);
  const eyes = eyesStrip(character);
  eyesHost.append(eyes);
  keyGlyphs(el('div', 'bd-key', strip), key);
  const txt = el('div', 'bd-txt', strip);
  el('div', 'bd-en', txt, def.nameEn);
  el('div', 'bd-cn', txt, def.name);
  return {
    root,
    dur: BAND_DUR,
    skillId: def.id,
    thin() {
      root.classList.add('is-thin');
    },
    frame(t) {
      // In from the right, out to the left.
      const x = (1 - enter(t, BAND_IN)) * BAND_SWEEP - exit(t, BAND_DUR, BAND_OUT) * BAND_SWEEP;
      strip.style.transform = `rotate(-2deg) translateX(${x.toFixed(0)}px)`;
      eyes.style.transform = `translateX(${(reducedMotion() ? 0 : -t * 70).toFixed(1)}px) scale(1.12)`;
      root.style.opacity = fadeOut(t, BAND_DUR, BAND_OUT).toFixed(3);
      txt.style.transform = `scale(${slam(t - 0.04, 0.12, 1.3).toFixed(3)})`;
    },
  };
}
