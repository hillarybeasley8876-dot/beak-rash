// Weather stickers (SPEC §20): a small P5 glyph per weather, used by the quick-race picker, the career
// cells and the loading card. The markup is our own constant — the same trick as the track weather icons.
import type { Weather } from '../../core/types';
import { WEATHER_CN, WEATHER_RANDOM_CN } from '../copy';
import { h, svg } from '../p5';

/** The picker's extra entry: the race rolls one of the track's own weathers. */
export type WeatherValue = 'random' | Weather;

/** One sticker per weather: flat shapes, ink outline, P5 red / yellow / paper. */
export const WEATHER_GLYPH: Record<Weather, string> = {
  clear: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" fill="#ffe600" stroke="#0b0b0f" stroke-width="3"/>' +
    '<g stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><path d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l3.5 3.5M22.5 22.5L26 26M26 6l-3.5 3.5M9.5 22.5L6 26"/></g></svg>',
  rain: '<svg viewBox="0 0 32 32"><path d="M7 17a5 5 0 0 1 .8-9.9A7 7 0 0 1 21 6.6 5.6 5.6 0 0 1 22 17.6z" fill="#ffffff" stroke="#0b0b0f" stroke-width="3" stroke-linejoin="round"/>' +
    '<g stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><path d="M10 21l-2 6M16 21l-2 6M22 21l-2 6"/></g></svg>',
  snow: '<svg viewBox="0 0 32 32"><g stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><path d="M16 3v26M4 9.5l24 13M28 9.5l-24 13"/></g>' +
    '<g stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><path d="M16 3l-3.5 4M16 3l3.5 4M16 29l-3.5-4M16 29l3.5-4"/></g></svg>',
  fog: '<svg viewBox="0 0 32 32"><path d="M8 15a5 5 0 0 1 .8-9.9A7 7 0 0 1 21 4.6 5.6 5.6 0 0 1 22 15.6z" fill="#c9c9d1" stroke="#0b0b0f" stroke-width="3" stroke-linejoin="round"/>' +
    '<g stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><path d="M5 21h22M9 27h14"/></g></svg>',
  dusk: '<svg viewBox="0 0 32 32"><circle cx="16" cy="21" r="8" fill="#e5191c" stroke="#0b0b0f" stroke-width="3"/>' +
    '<path d="M3 21h26" stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"/>' +
    '<g stroke="#0b0b0f" stroke-width="3" stroke-linecap="round"><path d="M16 4v5M7 8l3 3M25 8l-3 3"/></g></svg>',
};

/** The picker's extra entry (随机): a die — the race rolls one of the track's weathers. */
export const RANDOM_GLYPH = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#ffffff" stroke="#0b0b0f" stroke-width="3"/>' +
  '<circle cx="11" cy="11" r="2.6" fill="#e5191c"/><circle cx="21" cy="11" r="2.6" fill="#0b0b0f"/><circle cx="16" cy="16" r="2.6" fill="#e5191c"/>' +
  '<circle cx="11" cy="21" r="2.6" fill="#0b0b0f"/><circle cx="21" cy="21" r="2.6" fill="#e5191c"/></svg>';

/** The weather sticker: a glyph + its name (随机 rolls one of the track's weathers). */
export function weatherChip(value: WeatherValue): HTMLSpanElement {
  const random = value === 'random';
  const glyph = random ? RANDOM_GLYPH : WEATHER_GLYPH[value];
  const name = random ? WEATHER_RANDOM_CN : WEATHER_CN[value];
  return h('span', { class: 'br-wx' }, svg(glyph, 'br-wx-glyph'), h('b', { text: name }));
}
