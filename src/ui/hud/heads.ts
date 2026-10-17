// Fallback SVG head portraits per species (used when generated portrait art is missing): small,
// bold, outlined cartoon heads in a 100×100 box, facing right. Static strings, built once per use.
import type { CharacterId } from '../../core/types';

const K = '#0B0B0F';
const eye = (cx: number, cy: number, r = 6, look = 1.6): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>` +
  `<circle cx="${cx + look}" cy="${cy + 0.4}" r="${r * 0.52}" fill="${K}" stroke="none"/>` +
  `<circle cx="${cx + look + r * 0.22}" cy="${cy - r * 0.22}" r="${r * 0.18}" fill="#fff" stroke="none"/>`;

const HEADS: Record<CharacterId, string> = {
  pelican:
    `<path d="M20 100 C16 84 28 74 28 62 L48 62 C48 76 38 86 42 100 Z" fill="#F4F1EA"/>` +
    `<ellipse cx="42" cy="50" rx="23" ry="21" fill="#F4F1EA"/>` +
    `<path d="M52 58 C60 82 84 82 95 62 L60 54 Z" fill="#F28C6B"/>` +
    `<path d="M55 41 L95 52 L97 59 L57 56 Z" fill="#F7B32B"/>` +
    `<path d="M90 50 L99 54 L96 61 L91 57 Z" fill="#E5191C"/>` +
    `<path d="M18 46 C18 22 62 16 67 42 Z" fill="#E5191C"/>` +
    `<path d="M30 29 L34 41 M42 24 L44 39 M53 26 L54 39" stroke-width="3"/>` +
    `<ellipse cx="57" cy="39" rx="8" ry="5.5" fill="#9AD8FF"/>` +
    eye(48, 52, 6) + `<path d="M40 45 L56 48" stroke-width="3.5"/>`,
  goose:
    `<path d="M26 100 C24 80 30 66 32 50 L50 50 C50 68 46 82 50 100 Z" fill="#FFFFFF"/>` +
    `<ellipse cx="42" cy="40" rx="20" ry="18" fill="#FFFFFF"/>` +
    `<path d="M58 34 L90 42 L88 52 L58 50 Z" fill="#FF8A00"/>` +
    `<path d="M84 41 L91 43 L89 50 L84 49 Z" fill="${K}"/>` +
    `<path d="M24 60 L52 56 L56 66 L26 70 Z" fill="#E5191C"/>` +
    `<path d="M50 64 L62 74 L52 72 Z" fill="#E5191C"/>` +
    eye(46, 38, 6, 1.4) + `<path d="M36 28 L54 33" stroke-width="5"/>`,
  capybara:
    `<rect x="14" y="30" width="72" height="58" rx="24" fill="#A8754A"/>` +
    `<rect x="46" y="48" width="42" height="36" rx="16" fill="#7A5233"/>` +
    `<circle cx="22" cy="32" r="7" fill="#7A5233"/><circle cx="44" cy="28" r="7" fill="#7A5233"/>` +
    `<path d="M30 50 C34 54 40 54 44 50" fill="none" stroke-width="4"/>` +
    `<path d="M30 47 L44 47" stroke-width="3"/>` +
    `<circle cx="74" cy="60" r="2.4" fill="${K}"/><circle cx="82" cy="60" r="2.4" fill="${K}"/>` +
    `<circle cx="40" cy="16" r="12" fill="#FFB000"/>` +
    `<path d="M40 4 C46 0 52 2 54 6 C48 8 44 8 40 4 Z" fill="#3FA34D"/>`,
  cat:
    `<path d="M16 40 L20 8 L42 26 Z" fill="#F2A03D"/><path d="M84 40 L80 8 L58 26 Z" fill="#F2A03D"/>` +
    `<path d="M21 30 L23 16 L33 25 Z M79 30 L77 16 L67 25 Z" fill="#FFB7A8" stroke="none"/>` +
    `<ellipse cx="50" cy="56" rx="38" ry="34" fill="#F2A03D"/>` +
    `<path d="M42 24 L44 34 M50 22 L50 34 M58 24 L56 34" stroke-width="4"/>` +
    `<ellipse cx="50" cy="72" rx="20" ry="13" fill="#FFF4E0"/>` +
    eye(36, 52, 7, 1) + eye(62, 52, 7, 1) +
    `<path d="M36 72 C44 82 56 82 64 72" fill="${K}"/><path d="M47 66 L53 66 L50 70 Z" fill="#D9534F"/>`,
  shiba:
    `<path d="M14 44 L22 8 L44 30 Z" fill="#E8A35C"/><path d="M86 44 L78 8 L56 30 Z" fill="#E8A35C"/>` +
    `<ellipse cx="50" cy="56" rx="38" ry="34" fill="#E8A35C"/>` +
    `<path d="M20 64 C26 88 74 88 80 64 C70 72 30 72 20 64 Z" fill="#FFF7EA"/>` +
    `<ellipse cx="50" cy="70" rx="7" ry="5" fill="${K}"/>` +
    `<path d="M18 44 L46 44 L46 54 L42 54 L42 58 L22 58 L22 54 L18 54 Z" fill="${K}"/>` +
    `<path d="M54 44 L82 44 L82 54 L78 54 L78 58 L58 58 L58 54 L54 54 Z" fill="${K}"/>` +
    `<path d="M46 47 L54 47" stroke-width="4"/>` +
    `<rect x="24" y="46" width="5" height="4" fill="#fff" stroke="none"/><rect x="60" y="46" width="5" height="4" fill="#fff" stroke="none"/>`,
  pigeon:
    `<path d="M24 100 C20 82 28 70 30 60 L58 60 C60 74 56 88 60 100 Z" fill="#8E98A8"/>` +
    `<path d="M28 66 C40 74 50 74 60 66 L60 80 C50 88 38 88 26 80 Z" fill="#3FBF8F"/>` +
    `<path d="M28 78 C40 86 50 86 60 78 L60 88 C48 94 38 94 27 88 Z" fill="#8B5CC8"/>` +
    `<circle cx="44" cy="44" r="24" fill="#8E98A8"/>` +
    `<path d="M66 40 L84 46 L66 52 Z" fill="#5D6B80"/><ellipse cx="66" cy="40" rx="5" ry="3" fill="#F1F1F1"/>` +
    `<circle cx="52" cy="40" r="7" fill="#FF8A1F"/><circle cx="53" cy="40" r="3.2" fill="${K}" stroke="none"/>`,
  penguin:
    `<ellipse cx="50" cy="54" rx="38" ry="38" fill="#1D1F2B"/>` +
    `<path d="M50 34 C38 22 18 34 22 54 C26 76 40 84 50 84 C60 84 74 76 78 54 C82 34 62 22 50 34 Z" fill="#FFFFFF"/>` +
    eye(38, 50, 6, 1) + eye(62, 50, 6, 1) +
    `<path d="M42 60 L58 60 L50 72 Z" fill="#FFCC00"/>` +
    `<ellipse cx="30" cy="66" rx="5" ry="3" fill="#FF9EB0" stroke="none"/><ellipse cx="70" cy="66" rx="5" ry="3" fill="#FF9EB0" stroke="none"/>`,
  seagull:
    `<path d="M14 100 C10 80 22 66 30 60 L56 62 C58 78 52 90 56 100 Z" fill="#9AA4B2"/>` +
    `<ellipse cx="44" cy="46" rx="26" ry="23" fill="#F4F6F8"/>` +
    `<path d="M64 42 L94 48 L92 56 L64 54 Z" fill="#FFD23F"/><circle cx="84" cy="53" r="2.6" fill="#E5191C" stroke="none"/>` +
    `<path d="M74 52 L98 74" stroke="#F7C948" stroke-width="7"/><path d="M74 52 L98 74" stroke="${K}" stroke-width="1.5"/>` +
    `<ellipse cx="52" cy="40" rx="7" ry="5" fill="#fff"/><circle cx="57" cy="40" r="2.8" fill="${K}" stroke="none"/>` +
    `<path d="M44 33 L60 36" stroke-width="3.5"/>`,
  sloth:
    `<ellipse cx="50" cy="52" rx="40" ry="38" fill="#9C8466"/>` +
    `<path d="M14 44 L8 38 M18 30 L12 22 M86 44 L92 38 M82 30 L88 22" stroke-width="4"/>` +
    `<ellipse cx="50" cy="58" rx="30" ry="26" fill="#D9C8A9"/>` +
    `<path d="M24 50 C28 40 42 42 44 54 C40 62 28 60 24 50 Z" fill="#3A2E22"/>` +
    `<path d="M56 54 C58 42 72 40 76 50 C72 60 60 62 56 54 Z" fill="#3A2E22"/>` +
    `<path d="M30 52 C33 50 37 50 40 52 M60 52 C63 50 67 50 70 52" stroke="#fff" stroke-width="3" fill="none"/>` +
    `<ellipse cx="50" cy="62" rx="6" ry="4" fill="${K}"/>` +
    `<path d="M36 70 C44 78 56 78 64 70" fill="none" stroke-width="4"/>`,
  corgi:
    `<path d="M10 52 L18 4 L44 34 Z" fill="#E89A4F"/><path d="M90 52 L82 4 L56 34 Z" fill="#E89A4F"/>` +
    `<path d="M17 40 L21 14 L36 32 Z M83 40 L79 14 L64 32 Z" fill="#FFC9B0" stroke="none"/>` +
    `<ellipse cx="50" cy="60" rx="36" ry="30" fill="#E89A4F"/>` +
    `<path d="M50 36 C42 50 22 64 30 80 C40 92 60 92 70 80 C78 64 58 50 50 36 Z" fill="#FFFFFF"/>` +
    `<ellipse cx="50" cy="70" rx="6" ry="4.5" fill="${K}"/>` +
    eye(36, 56, 5.5, 1) + eye(64, 56, 5.5, 1) +
    `<path d="M20 34 C22 18 78 18 80 34 Z" fill="#1F4FD1"/><path d="M14 36 L86 36 L82 42 L18 42 Z" fill="${K}"/>` +
    `<circle cx="50" cy="27" r="5" fill="#FFE600"/>`,
};

/** Full SVG markup for a species head. */
export function headSvg(id: CharacterId): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g stroke="${K}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${HEADS[id]}</g></svg>`;
}
