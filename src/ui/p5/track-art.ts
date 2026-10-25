// Code-drawn track scenes for track cards (flat sticker style, thick ink). 400×260 viewBox.
import type { TrackId } from '../../core/types';
import * as gobi from '../tracks/gobi';
import * as watertown from '../tracks/watertown';

const INK = '#0b0b0f';

function coast(): string {
  return `<defs><linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fc6e8"/><stop offset="1" stop-color="#c9f3ff"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#cs-sky)"/>
  <circle cx="318" cy="62" r="34" fill="#fff4b8" stroke="${INK}" stroke-width="5"/>
  <path d="M0 132 H400 V200 H0 Z" fill="#1fb5c9" stroke="${INK}" stroke-width="5"/>
  <path d="M20 150 q14 -8 28 0 M90 166 q14 -8 28 0 M170 148 q14 -8 28 0 M250 170 q14 -8 28 0 M330 152 q14 -8 28 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M232 134 l18 -30 l18 30 Z" fill="#fff" stroke="${INK}" stroke-width="4"/><path d="M250 104 v30" stroke="${INK}" stroke-width="3"/>
  <path d="M0 196 C 120 180, 260 186, 400 200 V260 H0 Z" fill="#f6e3b4" stroke="${INK}" stroke-width="5"/>
  <path d="M120 260 C 170 220, 230 206, 330 198 L 352 202 C 270 214, 220 232, 196 260 Z" fill="#3a3a44" stroke="${INK}" stroke-width="5"/>
  <path d="M176 248 l14 -12 M216 224 l18 -9 M262 210 l20 -5" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M60 96 h22 l4 100 h-30 Z" fill="#fff" stroke="${INK}" stroke-width="5"/>
  <path d="M58 120 h28 v18 h-28 Z M57 158 h30 v18 h-30 Z" fill="#e5191c" stroke="${INK}" stroke-width="4"/>
  <path d="M54 96 h34 l-6 -16 h-22 Z" fill="#e5191c" stroke="${INK}" stroke-width="5"/>
  <path d="M362 204 C 360 170, 354 140, 346 112" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M362 204 C 360 170, 354 140, 346 112" fill="none" stroke="#a8754a" stroke-width="6" stroke-linecap="round"/>
  <path d="M346 112 q-30 -6 -44 14 q24 -6 44 -14 q-10 -26 -36 -30 q22 12 36 30 q16 -24 44 -22 q-26 4 -44 22 q34 0 44 22 q-22 -16 -44 -22" fill="#2fa84f" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
}

function city(): string {
  const towers: string[] = [];
  const xs = [10, 62, 118, 176, 236, 290, 344];
  const hs = [120, 170, 96, 196, 140, 182, 110];
  const neon = ['#ff2bd6', '#2be8ff', '#ffe600'];
  xs.forEach((x, i) => {
    const hgt = hs[i] ?? 120;
    towers.push(`<rect x="${x}" y="${200 - hgt}" width="50" height="${hgt}" fill="#241c4a" stroke="${INK}" stroke-width="4"/>`);
    for (let r = 0; r < Math.floor(hgt / 26); r++) {
      for (let c = 0; c < 3; c++) {
        if ((r * 7 + c * 3 + i) % 4 === 0) continue;
        towers.push(`<rect x="${x + 7 + c * 14}" y="${200 - hgt + 10 + r * 26}" width="8" height="12" fill="${neon[(r + c + i) % 3]}" opacity=".9"/>`);
      }
    }
  });
  return `<defs><linearGradient id="ct-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140b33"/><stop offset="1" stop-color="#4b1d6e"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#ct-sky)"/>
  <circle cx="62" cy="44" r="20" fill="#fff4d6" stroke="${INK}" stroke-width="4"/>
  ${towers.join('')}
  <rect x="180" y="30" width="44" height="22" fill="#e5191c" stroke="${INK}" stroke-width="4" transform="rotate(-8 202 41)"/>
  <path d="M0 200 H400 V260 H0 Z" fill="#1a1a26" stroke="${INK}" stroke-width="5"/>
  <path d="M0 214 H400" stroke="#ff2bd6" stroke-width="3" opacity=".7"/>
  <path d="M40 240 h50 M150 240 h50 M260 240 h50 M370 240 h30" stroke="#fff" stroke-width="5"/>
  <path d="M60 206 v40 M200 206 v46 M330 206 v38" stroke="#2be8ff" stroke-width="6" opacity=".35"/>`;
}

function mountain(): string {
  return `<defs><linearGradient id="mt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset=".6" stop-color="#ffc46b"/><stop offset="1" stop-color="#ffe2a8"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#mt-sky)"/>
  <circle cx="230" cy="128" r="54" fill="#fff1c7" stroke="${INK}" stroke-width="5"/>
  <path d="M0 150 L 60 96 L 120 140 L 190 80 L 260 136 L 330 92 L 400 140 V260 H0 Z" fill="#7a4e9e" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M0 190 L 80 140 L 150 182 L 240 130 L 320 176 L 400 150 V260 H0 Z" fill="#4b2f73" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M232 132 l-24 0 l24 -22 l24 22 Z M220 132 h24 v12 h-24 Z M214 118 l18 -16 l18 16 Z" fill="#e5191c" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M0 260 C 60 230, 200 236, 210 214 C 220 196, 140 198, 150 182 L 170 182 C 166 192, 250 196, 236 222 C 224 246, 120 248, 96 260 Z" fill="#3a3a44" stroke="${INK}" stroke-width="5"/>
  <path d="M40 252 l20 -6 M120 236 l22 -2 M196 214 l10 -10" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M300 240 l16 -44 l16 44 Z M330 246 l14 -36 l14 36 Z M276 248 l12 -30 l12 30 Z" fill="#1d4a3a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
}

const SCENES: Record<TrackId, () => string> = { coast, city, mountain, watertown: watertown.scene, gobi: gobi.scene };
let serial = 0;

/** Each call gets unique gradient ids so several cards of one track can share a page. */
export function trackArtSvg(id: TrackId): string {
  const n = ++serial;
  const body = SCENES[id]().replace(/(cs|ct|mt|wt|gb)-sky/g, `$1-sky${n}`);
  return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}
