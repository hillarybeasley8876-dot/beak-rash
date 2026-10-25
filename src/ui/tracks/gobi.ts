// 戈壁公路 GOBI HIGHWAY card art (r4): vector scene for track cards, loading weather icon, in-engine still.
// SCAFFOLD: the still borrows the coast render until tools/ui-track-stills.mjs renders track-gobi.webp.
import stillUrl from '../assets/track-coast.webp';

export const STILL_URL: string = stillUrl;

/** Vector card scene (gradient ids must start with `gb-` so trackArtSvg can make them unique per card). */
export function scene(): string {
  return '<defs><linearGradient id="gb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a74d6"/>' +
    '<stop offset="1" stop-color="#f3e6cf"/></linearGradient></defs><rect width="320" height="180" fill="url(#gb-sky)"/>' +
    '<path d="M0 130q80-40 160 0t160 0v50H0z" fill="#e2b46e" stroke="#0b0b0f" stroke-width="3"/>' +
    '<path d="M240 70v60M240 70l-18 -10M240 70l18 -10M240 70v-20" stroke="#f4f1ea" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M150 180l10-50h4l10 50z" fill="#3a3a42"/>';
}

export const WEATHER_ICON = '<svg viewBox="0 0 64 64"><circle cx="32" cy="26" r="12" fill="#e5191c" stroke="#0b0b0f" stroke-width="4"/>' +
  '<g stroke="#0b0b0f" stroke-width="4" stroke-linecap="round"><path d="M8 46h30M20 54h36M14 38h10"/></g></svg>';
