// 江南水乡 WATER TOWN card art (r4): vector scene for track cards, loading weather icon, in-engine still.
// SCAFFOLD: the still borrows the coast render until tools/ui-track-stills.mjs renders track-watertown.webp.
import stillUrl from '../assets/track-coast.webp';

export const STILL_URL: string = stillUrl;

/** Vector card scene (gradient ids must start with `wt-` so trackArtSvg can make them unique per card). */
export function scene(): string {
  return '<defs><linearGradient id="wt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa3b5"/>' +
    '<stop offset="1" stop-color="#e8eef0"/></linearGradient></defs><rect width="320" height="180" fill="url(#wt-sky)"/>' +
    '<rect y="120" width="320" height="60" fill="#5d7d86"/><path d="M40 120h90v-34l-45-22-45 22z" fill="#f4f1ea" stroke="#0b0b0f" stroke-width="3"/>' +
    '<path d="M30 88l55-28 55 28" fill="none" stroke="#2b2b33" stroke-width="8"/><path d="M170 132q50-40 100 0" fill="none" stroke="#f4f1ea" stroke-width="10"/>';
}

export const WEATHER_ICON = '<svg viewBox="0 0 64 64"><path d="M16 40a14 14 0 0 1 4-27 18 18 0 0 1 34 9 10 10 0 0 1-2 18z" fill="#f4f1ea" stroke="#0b0b0f" stroke-width="4"/>' +
  '<g stroke="#e5191c" stroke-width="4" stroke-linecap="round"><path d="M22 48l-3 8M34 48l-3 8M46 48l-3 8"/></g></svg>';
