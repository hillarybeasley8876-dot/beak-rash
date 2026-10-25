// Concrete splashes: KNOCK OUT (+ DOUBLE/TRIPLE… chains), WRECKED, BUSTED, FINISH, and SHOWTIME.
import { ROSTER } from '../../../data/roster';
import type { CharacterId, CrashCause } from '../../../core/types';
import { enter, exit, fadeOut, reducedMotion, slam } from '../anim';
import { eyesStrip } from '../badge';
import { el } from '../dom';
import { fmtTime } from '../place';
import { setRansom } from '../ransom';
import { animateGlyphs, card, splashCut } from './splash';
import type { CutIn } from './types';

const CHAIN_EN = ['', '', 'DOUBLE', 'TRIPLE', 'QUADRA', 'PENTA'];
const CHAIN_CN = ['击倒！', '击倒！', '双杀！', '三杀！', '四杀！', '五杀！'];
const PLACE_CN = ['', '第一名！', '第二名！', '第三名！', '第四名', '第五名', '第六名', '第七名', '第八名'];
const CRASH_CN: Record<CrashCause, string> = {
  ko: '被打下车了……', traffic: '撞车了……', wall: '亲吻护栏……', water: '下海喂鱼了……',
  obstacle: '人仰车翻……', skill: '中招翻车……', police: '被柯基警官拦下……',
};

let seed = 1;
const nextSeed = (): number => (seed = (seed * 16807) % 2147483647);

/** Over a KO cinematic (`cine`) the band sits flat in the lower 40 % of the frame (the HUD is hidden and the
 *  tumbling victim owns the centre); without one it crosses the middle, clear of the corner modules. */
const cineLayout = (cine: boolean): { cls: string; tilt: number } => (cine ? { cls: ' ci-cine', tilt: -5 } : { cls: '', tilt: -9 });

export function koSplash(chain: number, attacker: CharacterId | null, victim: CharacterId, cine: boolean): CutIn {
  const c = Math.max(1, chain);
  const lay = cineLayout(cine);
  const cut = splashCut({
    cls: `ci-ko${lay.cls}`, title: 'KNOCK OUT!', scheme: 'mix', dur: c > 1 ? 1.05 : 0.95, seed: nextSeed(), tilt: lay.tilt,
    pre: c > 1 ? CHAIN_EN[Math.min(c, 5)] ?? 'ULTRA' : undefined,
    cn: CHAIN_CN[Math.min(c, 5)] ?? '超神！', flash: true,
    left: attacker ? { id: attacker, mood: 'smug', name: ROSTER[attacker].name } : undefined,
    right: { id: victim, mood: 'hurt', name: ROSTER[victim].name, cross: true },
  });
  return { ...cut, cine };
}

export function wreckedSplash(player: CharacterId, cause: CrashCause, by: CharacterId | null, cine: boolean): CutIn {
  const lay = cineLayout(cine);
  const cut = splashCut({
    cls: `ci-wrecked${lay.cls}`, title: 'WRECKED', scheme: 'hot', dur: 0.9, seed: nextSeed(), tint: !cine, tilt: lay.tilt,
    cn: CRASH_CN[cause], sub: by ? `by ${ROSTER[by].name}` : undefined,
    right: { id: player, mood: 'hurt', cross: false },
  });
  return { ...cut, cine };
}

/** `hold` = seconds of the ticket stop (the whole penalty: nothing is added to the race time). */
export function bustedSplash(fine: number, hold: number): CutIn {
  return splashCut({
    cls: 'ci-busted', title: 'BUSTED!', scheme: 'mono', dur: 1.1, seed: nextSeed(), stamp: true, flash: true,
    cn: '被抓了！', sub: `罚款 ${fine} 小鱼干 · 靠边 ${hold} 秒`,
    left: { id: 'corgi', mood: 'smug', name: ROSTER.corgi.name },
  });
}

export function finishSplash(player: CharacterId, place: number, time: number): CutIn {
  return splashCut({
    cls: 'ci-finish', title: 'FINISH!', scheme: place === 1 ? 'hot' : 'mix', dur: 1.6, seed: nextSeed(),
    place, cn: PLACE_CN[place] ?? `第${place}名`, sub: `TIME ${fmtTime(time)}`, flash: place === 1,
    left: { id: player, mood: place <= 3 ? 'smug' : 'hurt' },
  });
}

export function showtimeCut(hero: CharacterId, nameCn: string): CutIn {
  const root = el('div', 'ci ci-showtime');
  const bg = el('div', 'st-bg', root);
  const rays = el('div', 'st-rays', root);
  const eyesBox = el('div', 'st-eyes', root);
  const eyes = eyesStrip(hero);
  eyesBox.append(eyes);
  const band = el('div', 'st-band', root);
  const hero3 = card({ id: hero, mood: 'smug' }, 'st-hero', root);
  const glyphs = setRansom(el('div', 'st-title', root), 'SHOWTIME!', { seed: nextSeed(), scheme: 'mix', tilt: 9 });
  const cn = el('div', 'st-cn', root, nameCn);
  const dur = 1.0;
  return {
    root,
    dur,
    frame(t) {
      const wipe = enter(t, 0.12);
      const out = exit(t, dur, 0.2);
      const fade = fadeOut(t, dur, 0.2);
      // Diagonal wipe in from the right, out to the left.
      const a = (1 - wipe) * 140;
      const b = out * 140;
      bg.style.clipPath = `polygon(${(a - 20 + b).toFixed(1)}% 0, 140% 0, 140% 100%, ${(a - 40 + b).toFixed(1)}% 100%)`;
      bg.style.opacity = '0.94';
      const still = reducedMotion();
      rays.style.transform = `rotate(${(still ? 0 : t * 18).toFixed(1)}deg)`;
      rays.style.opacity = (wipe * fade).toFixed(3);
      eyesBox.style.transform = `rotate(-4deg) translateX(${((1 - wipe) * -2400 + out * 2400).toFixed(0)}px)`;
      eyes.style.transform = `translateX(${(still ? 0 : t * 90).toFixed(1)}px) scale(1.1)`;
      band.style.transform = `rotate(-8deg) translateX(${((1 - enter(t, 0.12, 0.05)) * 2600 - out * 2600).toFixed(0)}px)`;
      hero3.style.transform = `translateX(${((1 - enter(t, 0.18, 0.08)) * -900 - out * 1000).toFixed(0)}px) rotate(-6deg)`;
      animateGlyphs(glyphs, t, 0.14, 0.035);
      cn.style.opacity = t < 0.4 ? '0' : fade.toFixed(3);
      cn.style.transform = `rotate(-5deg) scale(${slam(t - 0.4, 0.14, 1.8).toFixed(3)})`;
      root.style.opacity = fadeOut(t, dur, 0.1).toFixed(3);
    },
  };
}
