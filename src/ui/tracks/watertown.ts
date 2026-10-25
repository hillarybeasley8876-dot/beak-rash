// 江南水乡 WATER TOWN card art (r4): vector scene for track cards, the drizzle weather icon and the
// in-engine still of the town.
import stillUrl from '../assets/track-watertown.webp';

export const STILL_URL: string = stillUrl;

/**
 * Vector card scene (400×260, flat sticker style). Gradient ids must start with `wt-` so
 * trackArtSvg can make them unique per card.
 */
export function scene(): string {
  return `<defs><linearGradient id="wt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa2b1"/>
  <stop offset="1" stop-color="#dde5e8"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#wt-sky)"/>
  <g stroke="#c3d1da" stroke-width="3" stroke-linecap="round" opacity=".85">
  <path d="M28 14l-12 34M86 2l-12 34M146 22l-12 34M206 0l-12 34M266 18l-12 34M326 4l-12 34M382 20l-12 34M62 54l-12 34M182 52l-12 34M302 50l-12 34"/></g>
  <rect x="14" y="92" width="70" height="54" fill="#f4f1e8" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M4 92h90l-12-22H16z" fill="#3c4149" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <rect x="98" y="80" width="56" height="66" fill="#f8f5ed" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M88 80h76l-12-24h-52z" fill="#2f343b" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <rect x="168" y="100" width="62" height="46" fill="#f2efe4" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M158 100h82l-12-20h-58z" fill="#3c4149" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <rect x="250" y="88" width="56" height="58" fill="#f6f2e7" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M240 88h76l-12-22h-52z" fill="#33383f" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <rect x="320" y="102" width="66" height="44" fill="#f1eee3" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M310 102h86l-12-20h-62z" fill="#3c4149" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <g fill="#2b3138" stroke="#0b0b0f" stroke-width="3">
  <rect x="36" y="112" width="16" height="20"/><rect x="60" y="112" width="16" height="20"/>
  <rect x="116" y="96" width="18" height="22"/><rect x="188" y="116" width="18" height="20"/>
  <rect x="270" y="104" width="18" height="22"/><rect x="342" y="116" width="18" height="20"/></g>
  <rect x="0" y="146" width="400" height="62" fill="#7fa39b" stroke="#0b0b0f" stroke-width="4"/>
  <g stroke="#a9c4bd" stroke-width="3" stroke-linecap="round" opacity=".9">
  <path d="M24 168q12-7 24 0M64 186q12-7 24 0M276 162q12-7 24 0M330 182q12-7 24 0"/></g>
  <path d="M100 208C118 138 232 138 250 208Z" fill="#d5cdb9" stroke="#0b0b0f" stroke-width="5" stroke-linejoin="round"/>
  <path d="M132 208c6-42 76-42 82 0Z" fill="#7fa39b" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <path d="M100 208h150v10H100z" fill="#b9b1a0" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M30 190q165 34 330 2" fill="none" stroke="#0b0b0f" stroke-width="3"/>
  <circle cx="96" cy="203" r="10" fill="#e5191c" stroke="#0b0b0f" stroke-width="3"/>
  <circle cx="188" cy="208" r="10" fill="#e5191c" stroke="#0b0b0f" stroke-width="3"/>
  <circle cx="280" cy="200" r="10" fill="#e5191c" stroke="#0b0b0f" stroke-width="3"/>
  <path d="M30 186h58l-9 12H39z" fill="#4a3a2c" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <path d="M42 186a17 17 0 0 1 34 0z" fill="#1b1c20" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M356 206v-32" stroke="#7a5233" stroke-width="6" stroke-linecap="round"/>
  <path d="M320 176q2-32 36-32t36 32q-16 10-36 5-20 5-36-5z" fill="#6f9c46" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>
  <g stroke="#5f8a3c" stroke-width="3" stroke-linecap="round"><path d="M326 178v24M340 182v22M356 184v20M372 182v22M386 178v24"/></g>
  <path d="M0 260C70 232 150 220 200 214c50 6 130 22 200 46Z" fill="#5b5d61" stroke="#0b0b0f" stroke-width="4"/>
  <path d="M120 246q80-16 160-4" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
}

/** The loading-screen weather icon: a drizzle over a canal town. */
export const WEATHER_ICON = '<svg viewBox="0 0 64 64"><path d="M16 38a13 13 0 0 1 4-25 17 17 0 0 1 32 9 10 10 0 0 1-2 16z" fill="#eef2f3" stroke="#0b0b0f" stroke-width="4"/>' +
  '<g stroke="#2f7fc1" stroke-width="4" stroke-linecap="round"><path d="M22 48l-3 8M34 48l-3 8M46 48l-3 8"/></g>' +
  '<path d="M40 22h16" stroke="#e5191c" stroke-width="4" stroke-linecap="round"/></svg>';
