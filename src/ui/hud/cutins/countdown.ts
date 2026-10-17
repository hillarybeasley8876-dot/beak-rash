// Countdown (3-2-1-GO) and the player's skill band (diagonal strip, eyes close-up, nameEn + 中文名).
import '../css/cutins.css';
import type { CharacterId } from '../../../core/types';
import type { SkillDef } from '../../../data/skills';
import { enter, exit, fadeOut, pop, reducedMotion, slam } from '../anim';
import { eyesStrip } from '../badge';
import { el } from '../dom';
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

export function skillBand(def: SkillDef, character: CharacterId, key: string): CutIn {
  const root = el('div', 'ci ci-band');
  const strip = el('div', 'bd-strip', root);
  el('div', 'bd-lines', strip);
  const eyesHost = el('div', 'bd-eyes', strip);
  const eyes = eyesStrip(character);
  eyesHost.append(eyes);
  el('div', 'bd-key', strip, key);
  const txt = el('div', 'bd-txt', strip);
  el('div', 'bd-en', txt, def.nameEn);
  el('div', 'bd-cn', txt, def.name);
  const dur = 0.68;
  return {
    root,
    dur,
    frame(t) {
      const x = (1 - enter(t, 0.11)) * 2600 - exit(t, dur, 0.13) * 2600;
      strip.style.transform = `rotate(-7deg) translateX(${x.toFixed(0)}px)`;
      eyes.style.transform = `translateX(${(reducedMotion() ? 0 : -t * 70).toFixed(1)}px) scale(1.12)`;
      root.style.opacity = fadeOut(t, dur, 0.1).toFixed(3);
      txt.style.transform = `scale(${slam(t - 0.05, 0.14, 1.35).toFixed(3)})`;
    },
  };
}
