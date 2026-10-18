// Generic P5 splash used by KNOCK OUT (+ chains), WRECKED, BUSTED and FINISH: diagonal bands, star
// burst, ransom title slammed glyph by glyph, brush subtitle, portrait cards sliding in from the sides.
import '../css/splash.css';
import type { CharacterId } from '../../../core/types';
import { enter, envelope, exit, fadeOut, jitter, pop, reducedMotion, slam } from '../anim';
import { PortraitCard, type Mood } from '../badge';
import { el } from '../dom';
import { setRansom, type RansomScheme } from '../ransom';
import { starClip } from '../shapes';
import { ordinal } from '../place';
import type { CutIn } from './types';

export interface CardSpec { id: CharacterId; mood: Mood; name?: string; cross?: boolean }

export interface SplashSpec {
  cls: string;
  title: string;
  scheme: RansomScheme;
  dur: number;
  seed: number;
  pre?: string;
  cn?: string;
  sub?: string;
  left?: CardSpec;
  right?: CardSpec;
  place?: number;
  stamp?: boolean;
  flash?: boolean;
  tint?: boolean;
  /** Band tilt in degrees (default −9; cinematic splashes sit flatter in the lower part of the frame). */
  tilt?: number;
}

/** Portrait card with a jagged frame, offset shadow and optional name plate / red cross. */
export function card(spec: CardSpec, cls: string, parent: HTMLElement): HTMLDivElement {
  const box = el('div', `sx-card ${cls}`, parent);
  el('div', 'sx-card-sh', box);
  const inner = el('div', 'sx-card-in', box);
  inner.append(new PortraitCard(spec.id, '', [spec.mood]).node);
  if (spec.cross) el('div', 'sx-x', box);
  if (spec.name) el('div', 'sx-name', box, spec.name);
  return box;
}

/** Animate ransom glyphs: staggered slams, then a 12 fps idle jitter. */
export function animateGlyphs(glyphs: HTMLElement[], t: number, start: number, step: number): void {
  const tick = Math.floor(t * 12);
  glyphs.forEach((g, i) => {
    const ti = t - start - i * step;
    if (ti < 0) {
      g.style.opacity = '0';
      return;
    }
    g.style.opacity = '1';
    const s = slam(ti, 0.12, 2.4);
    const jx = jitter(tick, i * 2 + 1) * 1.6;
    const jy = jitter(tick, i * 2 + 2) * 1.6;
    g.style.setProperty('--rg-a', `translate(${jx.toFixed(1)}px, ${jy.toFixed(1)}px) scale(${s.toFixed(3)})`);
  });
}

export function splashCut(spec: SplashSpec): CutIn {
  const root = el('div', `ci ci-splash ${spec.cls}`);
  const flash = spec.flash ? el('div', 'sx-flash', root) : null;
  const tint = spec.tint ? el('div', 'sx-tint', root) : null;
  const band = el('div', 'sx-band', root);
  const band2 = el('div', 'sx-band2', root);
  const burst = el('div', 'sx-burst', root);
  burst.style.clipPath = starClip(20, 0.74, 0.12, spec.seed);
  const left = spec.left ? card(spec.left, 'sx-left', root) : null;
  const right = spec.right ? card(spec.right, 'sx-right', root) : null;
  const place = spec.place !== undefined ? el('div', 'sx-place', root) : null;
  if (place && spec.place !== undefined) {
    place.textContent = String(spec.place);
    el('small', '', place, ordinal(spec.place));
  }
  const preGlyphs = spec.pre ? setRansom(el('div', 'sx-pre', root), spec.pre, { seed: spec.seed + 7, scheme: 'mono' }) : [];
  const stamp = spec.stamp ? el('div', 'sx-stamp', root, spec.title) : null;
  const glyphs = stamp ? [] : setRansom(el('div', 'sx-title', root), spec.title, { seed: spec.seed, scheme: spec.scheme });
  const cn = spec.cn ? el('div', 'sx-cn', root, spec.cn) : null;
  const sub = spec.sub ? el('div', 'sx-sub', root, spec.sub) : null;
  const { dur } = spec;
  const tilt = spec.tilt ?? -9;
  return {
    root,
    dur,
    frame(t) {
      const inT = enter(t, 0.13);
      const outT = exit(t, dur, 0.18);
      const fade = fadeOut(t, dur, 0.18);
      if (flash) flash.style.opacity = reducedMotion() ? '0' : Math.max(0, 0.85 - t / 0.1).toFixed(3);
      if (tint) tint.style.opacity = envelope(t, 0, 0.1, dur - 0.2, dur).toFixed(3);
      band.style.transform = `rotate(${tilt}deg) translateX(${((1 - inT) * 2600 - outT * 2600).toFixed(0)}px)`;
      const in2 = enter(t, 0.13, 0.04);
      band2.style.transform = `rotate(5deg) translateX(${((in2 - 1) * 2600 + outT * 2600).toFixed(0)}px)`;
      const spin = reducedMotion() ? 0 : t * 14;
      burst.style.transform = `scale(${(pop(t - 0.05, 0.16) * (1 + outT * 0.3)).toFixed(3)}) rotate(${spin.toFixed(1)}deg)`;
      burst.style.opacity = fade.toFixed(3);
      const slideL = enter(t, 0.16, 0.04);
      if (left) left.style.transform = `translateX(${((slideL - 1) * 800 - outT * 900).toFixed(0)}px) rotate(-7deg)`;
      if (right) right.style.transform = `translateX(${((1 - slideL) * 800 + outT * 900).toFixed(0)}px) rotate(7deg)`;
      if (place) place.style.transform = `rotate(-8deg) scale(${slam(t - 0.08, 0.16, 2.2).toFixed(3)})`;
      animateGlyphs(preGlyphs, t, 0.04, 0.025);
      animateGlyphs(glyphs, t, 0.08, 0.03);
      if (stamp) stamp.style.transform = `translateX(-50%) rotate(${(-12 + 3 * enter(t, 0.3)).toFixed(1)}deg) scale(${slam(t - 0.1, 0.12, 2.6).toFixed(3)})`;
      if (cn) cn.style.transform = `translateX(-50%) rotate(-6deg) scale(${slam(t - 0.24, 0.14, 1.9).toFixed(3)})`;
      if (cn) cn.style.opacity = t < 0.24 ? '0' : '1';
      if (sub) sub.style.transform = `translateX(${(-50 - (1 - enter(t, 0.14, 0.32)) * 120).toFixed(1)}%) skewX(-12deg)`;
      if (sub) sub.style.opacity = t < 0.32 ? '0' : '1';
      root.style.opacity = fadeOut(t, dur, 0.12).toFixed(3);
    },
  };
}
