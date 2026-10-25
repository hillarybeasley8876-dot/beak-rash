// 戈壁公路 GOBI HIGHWAY card art (r4): vector scene for track cards, loading weather icon, in-engine still.
// The card shows the gobi in one glance: a hot sky, the straight road, a wind turbine, a camel and the mesas.
import stillUrl from '../assets/track-gobi.webp';

export const STILL_URL: string = stillUrl;

/** Vector card scene (gradient ids must start with `gb-` so trackArtSvg can make them unique per card). */
export function scene(): string {
  return `<defs><linearGradient id="gb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7fd6"/>
    <stop offset=".62" stop-color="#dfe7ee"/><stop offset="1" stop-color="#f4e2bd"/></linearGradient>
    <linearGradient id="gb-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a7f6d"/><stop offset="1" stop-color="#5f5648"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#gb-sky)"/>
  <circle cx="318" cy="54" r="30" fill="#fff4b8" stroke="#0b0b0f" stroke-width="5"/>
  <path d="M0 150 C 60 128, 150 132, 210 146 C 280 162, 340 140, 400 128 V260 H0 Z" fill="#e7cb8c" stroke="#0b0b0f" stroke-width="5"/>
  <path d="M0 186 C 90 168, 210 172, 400 158 V260 H0 Z" fill="#f4e2ae" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M104 260 C 150 214, 196 186, 250 172 L 268 178 C 224 194, 190 220, 168 260 Z" fill="url(#gb-road)" stroke="#0b0b0f" stroke-width="5"/>
  <path d="M150 248 l16 -14 M186 216 l20 -10 M222 194 l18 -6" stroke="#ffe600" stroke-width="4" stroke-linecap="round"/>
  <path d="M60 168 l14 -34 h6 l14 34 Z" fill="#c08d5e" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <path d="M74 134 h6 v-8 h-6 Z" fill="#c08d5e" stroke="#0b0b0f" stroke-width="3"/>
  <path d="M330 176 l18 -42 h7 l18 42 Z" fill="#d9a86b" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <path d="M262 150 v-56" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round"/>
  <circle cx="262" cy="90" r="5" fill="#8d97a3" stroke="#0b0b0f" stroke-width="3"/>
  <path d="M262 90 l-3 -26 M262 90 l22 13 M262 90 l-19 17" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"/>
  <path d="M36 196 q10 -9 22 -4 l6 3 q-2 5 -8 5 l-4 6 q-6 1 -6 -4 q-8 1 -10 -6 Z" fill="#c8965a" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <path d="M30 196 l-4 8 M40 200 l-2 8 M50 200 l2 8 M58 198 l4 7" stroke="#8e6437" stroke-width="4" stroke-linecap="round"/>
  <path d="M12 120 h44 l6 8 h-56 Z" fill="#e5191c" stroke="#0b0b0f" stroke-width="4" transform="rotate(-8 34 124)"/>
  <path d="M18 122 h30" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
}

/** Loading-screen weather icon: a hot sun over the wind (风沙 4 级). */
export const WEATHER_ICON = '<svg viewBox="0 0 64 64"><circle cx="26" cy="24" r="12" fill="#ffe600" stroke="#0b0b0f" stroke-width="4"/>' +
  '<g stroke="#0b0b0f" stroke-width="4" stroke-linecap="round"><path d="M26 4v6M26 38v6M6 24h6M40 24h6M12 10l4 4M36 34l4 4M40 10l-4 4M16 34l-4 4"/></g>' +
  '<g stroke="#0b0b0f" stroke-width="4" stroke-linecap="round"><path d="M6 50h24M14 58h30M22 44h18"/></g></svg>';
