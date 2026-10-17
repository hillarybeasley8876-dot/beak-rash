// Code-drawn sticker art (SVG markup) used when generated portraits/art are missing, plus icons.
// All markup is built from constants and roster colours only.
import type { CharacterId } from '../../core/types';
import { ROSTER } from '../../data/roster';

const INK = '#0b0b0f';
const SW = 'stroke="#0b0b0f" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"';

/** Hero pelican bust facing right: S-neck, HUGE beak + gular pouch, red helmet + goggles. 300×260. */
export function pelicanSvg(opts: { mood?: 'main' | 'smug' | 'hurt' } = {}): string {
  const mood = opts.mood ?? 'main';
  const eye = mood === 'hurt'
    ? '<path d="M131 74 l18 18 M149 74 l-18 18" stroke="#0b0b0f" stroke-width="6" stroke-linecap="round"/>'
    : `<ellipse cx="140" cy="84" rx="12" ry="13" fill="#fff" stroke="#0b0b0f" stroke-width="4"/>
  <circle cx="${mood === 'smug' ? 145 : 143}" cy="${mood === 'smug' ? 89 : 86}" r="6.5" fill="${INK}"/><circle cx="${mood === 'smug' ? 147 : 145.5}" cy="${mood === 'smug' ? 86.5 : 83}" r="2.3" fill="#fff"/>`;
  const lid = mood === 'smug' ? '<path d="M127 80 Q140 70 153 80 L153 85 Q140 79 127 85 Z" fill="#f4f1ea" stroke="#0b0b0f" stroke-width="3.5"/>' : '';
  const brow = mood === 'hurt' ? '<path d="M126 64 L 152 70" stroke="#0b0b0f" stroke-width="5" stroke-linecap="round"/>'
    : '<path d="M126 70 L 156 64" stroke="#0b0b0f" stroke-width="6" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 300 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M0 262 C 2 202, 44 172, 104 178 C 152 182, 184 216, 190 262 Z" fill="#f4f1ea" ${SW}/>
  <path d="M8 262 C 22 216, 70 198, 114 208 C 94 222, 86 242, 90 262 Z" fill="#c9ccd3" ${SW}/>
  <path d="M20 262 l12 -30 l12 30 M48 262 l12 -24 l12 24" fill="${INK}"/>
  <path d="M106 192 C 70 150, 142 142, 122 102" fill="none" stroke="${INK}" stroke-width="52" stroke-linecap="round"/>
  <path d="M106 192 C 70 150, 142 142, 122 102" fill="none" stroke="#f4f1ea" stroke-width="40" stroke-linecap="round"/>
  <path d="M152 100 C 200 104, 250 110, 282 114 C 264 172, 192 190, 158 132 Z" fill="#ff9a6a" ${SW}/>
  <path d="M170 128 C 196 150, 236 146, 262 124" fill="none" stroke="#e0703f" stroke-width="5" stroke-linecap="round"/>
  <path d="M148 74 C 200 76, 262 88, 290 104 Q 300 112 290 120 L 280 113 C 240 106, 196 102, 150 102 Z" fill="#f5b324" ${SW}/>
  <path d="M278 100 Q 302 104 294 124 L 281 113 Z" fill="#e5191c" stroke="#0b0b0f" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M170 88 C 210 90, 246 96, 272 104" fill="none" stroke="#d68a12" stroke-width="4" stroke-linecap="round"/>
  <circle cx="128" cy="84" r="34" fill="#f4f1ea" ${SW}/>
  <path d="M96 76 l-18 -6 l12 12 l-16 6 l20 2" fill="#f4f1ea" ${SW}/>
  ${eye}${lid}${brow}
  <path d="M92 76 C 92 34, 162 26, 168 70 C 150 62, 112 64, 92 76 Z" fill="#e5191c" ${SW}/>
  <path d="M110 42 C 124 34, 140 34, 150 40 L 146 52 C 136 47, 124 47, 114 52 Z" fill="#fff"/>
  <rect x="140" y="44" width="30" height="18" rx="8" fill="#7fd6ff" stroke="#0b0b0f" stroke-width="4.5"/>
  <path d="M146 49 l8 0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

type Shape = 'bird' | 'cat' | 'dog' | 'capy' | 'sloth';
const SHAPES: Record<CharacterId, Shape> = {
  pelican: 'bird', goose: 'bird', pigeon: 'bird', penguin: 'bird', seagull: 'bird',
  cat: 'cat', shiba: 'dog', corgi: 'dog', capybara: 'capy', sloth: 'sloth',
};

/** Species head sticker (front view) in roster colours. 200×200. */
export function headSvg(id: CharacterId): string {
  if (id === 'pelican') return pelicanHeadSvg();
  const c = ROSTER[id].colors;
  const shape = SHAPES[id];
  const eyes = `<circle cx="78" cy="98" r="12" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="122" cy="98" r="12" fill="#fff" stroke="${INK}" stroke-width="4"/>
    <circle cx="80" cy="100" r="5" fill="${INK}"/><circle cx="124" cy="100" r="5" fill="${INK}"/>`;
  let extra = '';
  let head = `<circle cx="100" cy="108" r="64" fill="${c.primary}" ${SW}/>`;
  if (shape === 'bird') {
    const beak = id === 'goose' ? '#ff8a00' : id === 'penguin' || id === 'seagull' ? '#ffcc00' : '#3a3a40';
    extra = `<path d="M84 122 L 100 ${id === 'goose' ? 160 : 150} L 116 122 Z" fill="${beak}" ${SW}/>`;
    if (id === 'goose') extra += '<path d="M62 80 l30 10 M138 80 l-30 10" stroke="#0b0b0f" stroke-width="7"/>';
    if (id === 'seagull') extra += '<circle cx="104" cy="140" r="5" fill="#e5191c"/>';
    if (id === 'pigeon') head += '<path d="M48 140 Q100 196 152 140 L 160 176 Q100 210 40 176 Z" fill="#3fbf8f" stroke="#0b0b0f" stroke-width="5"/>';
  } else if (shape === 'cat') {
    head = `<path d="M44 74 L 52 22 L 86 52 Z M156 74 L 148 22 L 114 52 Z" fill="${c.primary}" ${SW}/>` + head;
    extra = '<path d="M90 128 q10 8 20 0 M100 128 v10" fill="none" stroke="#0b0b0f" stroke-width="4"/>';
  } else if (shape === 'dog') {
    const big = id === 'corgi';
    head = `<path d="M${big ? 36 : 50} 84 L ${big ? 40 : 58} ${big ? 6 : 34} L ${big ? 92 : 86} 54 Z M${big ? 164 : 150} 84 L ${big ? 160 : 142} ${big ? 6 : 34} L ${big ? 108 : 114} 54 Z" fill="${c.primary}" ${SW}/>` + head;
    extra = `<ellipse cx="100" cy="136" rx="34" ry="24" fill="${c.secondary}" stroke="${INK}" stroke-width="4"/><ellipse cx="100" cy="126" rx="10" ry="7" fill="${INK}"/>`;
    if (id === 'shiba') extra += '<path d="M56 86 h88 v18 h-36 v-8 h-16 v8 h-36 Z" fill="#0b0b0f"/>';
  } else if (shape === 'capy') {
    head = `<rect x="38" y="52" width="124" height="116" rx="44" fill="${c.primary}" ${SW}/><circle cx="100" cy="40" r="18" fill="#ffb000" ${SW}/>`;
    extra = `<rect x="68" y="122" width="64" height="36" rx="16" fill="${c.secondary}" stroke="${INK}" stroke-width="4"/>`;
  } else {
    extra = `<ellipse cx="76" cy="100" rx="20" ry="14" fill="${c.accent}" transform="rotate(-20 76 100)"/><ellipse cx="124" cy="100" rx="20" ry="14" fill="${c.accent}" transform="rotate(20 124 100)"/>
      <path d="M80 138 q20 14 40 0" fill="none" stroke="#0b0b0f" stroke-width="5"/>`;
  }
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${head}${shape === 'sloth' ? '' : eyes}${extra}${shape === 'sloth' ? eyes.replace(/r="12"/g, 'r="6"').replace(/r="5"/g, 'r="3"') : ''}</svg>`;
}

/** 小鱼干 coin icon (dried fish, side view). 120×60. */
export function fishSvg(): string {
  return `<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 30 C 30 4, 74 4, 92 26 L 114 8 L 108 30 L 114 52 L 92 34 C 74 56, 30 56, 8 30 Z" fill="#f2b33d" ${SW}/>
  <path d="M40 18 q6 12 0 24 M54 16 q6 14 0 28 M68 18 q5 12 0 24" fill="none" stroke="#a8641c" stroke-width="4"/>
  <circle cx="24" cy="27" r="5" fill="${INK}"/><circle cx="25.5" cy="25.5" r="1.6" fill="#fff"/>
</svg>`;
}

/** Side-view pelican on a bicycle (loading-bar runner). 160×120; `.br-wheel` groups spin via CSS. */
export function riderIconSvg(): string {
  const wheel = (cx: number): string =>
    `<g class="br-wheel" style="transform-origin:${cx}px 92px"><circle cx="${cx}" cy="92" r="22" fill="none" stroke="#0b0b0f" stroke-width="7"/>
    <path d="M${cx - 18} 92 h36 M${cx} 74 v36" stroke="#0b0b0f" stroke-width="3"/></g>`;
  return `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${wheel(34)}${wheel(122)}
  <path d="M34 92 L 70 92 L 108 58 L 62 58 Z M70 92 L 58 50 M108 58 L 122 92 M104 46 L 108 58" fill="none" stroke="#e5191c" stroke-width="7" stroke-linejoin="round"/>
  <path d="M48 52 C 46 30, 76 20, 96 30 C 100 44, 84 56, 56 56 Z" fill="#f4f1ea" ${SW}/>
  <path d="M90 34 C 94 18, 98 10, 106 8" fill="none" stroke="#0b0b0f" stroke-width="18" stroke-linecap="round"/>
  <path d="M90 34 C 94 18, 98 10, 106 8" fill="none" stroke="#f4f1ea" stroke-width="11" stroke-linecap="round"/>
  <circle cx="108" cy="10" r="10" fill="#f4f1ea" ${SW}/>
  <path d="M100 2 C 104 -6, 118 -4, 118 6 Z" fill="#e5191c" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M114 8 L 156 16 L 116 20 Z" fill="#f5b324" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <path d="M118 20 L 150 18 Q 136 34 118 24 Z" fill="#ff9a6a" stroke="#0b0b0f" stroke-width="3"/>
  <path d="M60 56 L 66 76 L 74 78" fill="none" stroke="#f59a23" stroke-width="5" stroke-linecap="round"/>
</svg>`;
}

/** Pelican head badge (front-ish): helmet, two eyes, HUGE beak + pouch. 200×200. */
function pelicanHeadSvg(): string {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="86" cy="94" r="58" fill="#f4f1ea" ${SW}/>
  <path d="M98 128 C 130 132, 160 144, 186 156 C 172 198, 116 200, 100 148 Z" fill="#ff9a6a" ${SW}/>
  <path d="M92 108 C 128 108, 170 122, 190 142 Q 198 152 190 158 L 182 152 C 156 140, 124 132, 92 130 Z" fill="#f5b324" ${SW}/>
  <path d="M182 140 Q 202 146 194 166 L 182 154 Z" fill="#e5191c" stroke="#0b0b0f" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="64" cy="98" rx="13" ry="14" fill="#fff" stroke="#0b0b0f" stroke-width="4.5"/><ellipse cx="104" cy="96" rx="13" ry="14" fill="#fff" stroke="#0b0b0f" stroke-width="4.5"/>
  <circle cx="68" cy="100" r="6" fill="${INK}"/><circle cx="108" cy="98" r="6" fill="${INK}"/>
  <path d="M30 82 C 32 22, 140 18, 144 80 C 118 64, 58 64, 30 82 Z" fill="#e5191c" ${SW}/>
  <path d="M68 36 C 82 30, 98 30, 110 36 L 106 48 C 96 44, 84 44, 74 48 Z" fill="#fff"/>
</svg>`;
}
