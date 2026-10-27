// Fallback "eyes close-up" strip for skill cut-ins (P5-style): two huge glaring eyes over the
// character's colours with speed hatching. Used when <id>_eyes.png art is missing.
import { ROSTER } from '../../data/roster';
import type { CharacterId } from '../../core/types';

const IRIS: Record<CharacterId, string> = {
  pelican: '#F5D33B', goose: '#4A3216', capybara: '#3B2A1C', cat: '#7BD148', shiba: '#5A3412',
  pigeon: '#FF8A1F', penguin: '#2A2F45', seagull: '#F2C230', sloth: '#2C2118', corgi: '#6B3B12',
  bananacat: '#3B2A1C', cryingcat: '#4A6FA5', xinxian: '#C9A227', moodeng: '#2A1F1A', pedro: '#2B2116', hamster: '#1E1612',
};

/** Brow tilt per species (degrees, + = angrier). The capybara and sloth stay serene. */
const BROW: Record<CharacterId, number> = {
  pelican: 16, goose: 24, capybara: -2, cat: 10, shiba: 6, pigeon: 12, penguin: 8, seagull: 14, sloth: -4, corgi: 14,
  bananacat: -10, cryingcat: -12, xinxian: 8, moodeng: 18, pedro: 4, hamster: -14,
};

const K = '#0B0B0F';

function oneEye(cx: number, flip: number, iris: string, brow: number, sleepy: boolean): string {
  const lid = sleepy ? `<path d="M${cx - 62} 50 Q${cx} 18 ${cx + 62} 50 L${cx + 62} 24 L${cx - 62} 24 Z" fill="${K}"/>` : '';
  const by = 22;
  const b0 = by + (flip > 0 ? brow : -brow) * 0.5;
  const b1 = by - (flip > 0 ? brow : -brow) * 0.5;
  return (
    `<path d="M${cx - 64} 54 Q${cx} 4 ${cx + 64} 54 Q${cx} 94 ${cx - 64} 54 Z" fill="#fff" stroke="${K}" stroke-width="7"/>` +
    `<circle cx="${cx + flip * 6}" cy="54" r="27" fill="${iris}" stroke="${K}" stroke-width="5"/>` +
    `<circle cx="${cx + flip * 8}" cy="54" r="13" fill="${K}"/>` +
    `<circle cx="${cx + flip * 8 - 7}" cy="44" r="6" fill="#fff"/>` +
    `<circle cx="${cx + flip * 8 + 9}" cy="62" r="2.6" fill="#fff"/>` +
    lid +
    `<path d="M${cx - 70} ${b0.toFixed(1)} L${cx + 70} ${b1.toFixed(1)}" stroke="${K}" stroke-width="13" stroke-linecap="round"/>`
  );
}

/** SVG markup of a 400×100 eyes strip for `id`. */
export function eyesSvg(id: CharacterId): string {
  const def = ROSTER[id];
  const iris = IRIS[id];
  const brow = BROW[id];
  const sleepy = id === 'capybara' || id === 'sloth';
  const hatch = Array.from({ length: 14 }, (_, i) => {
    const x = i * 31 - 20;
    return `<path d="M${x} 100 L${x + 60} 0" stroke="${K}" stroke-opacity="0.16" stroke-width="7"/>`;
  }).join('');
  const patch = id === 'sloth'
    ? `<ellipse cx="120" cy="58" rx="86" ry="36" fill="#3A2E22"/><ellipse cx="280" cy="58" rx="86" ry="36" fill="#3A2E22"/>`
    : id === 'shiba'
      ? `<rect x="40" y="26" width="140" height="58" fill="${K}"/><rect x="220" y="26" width="140" height="58" fill="${K}"/>`
      : '';
  const eyes = id === 'shiba'
    ? `<rect x="58" y="38" width="22" height="14" fill="#fff"/><rect x="238" y="38" width="22" height="14" fill="#fff"/>` +
      `<path d="M180 40 L220 40" stroke="${K}" stroke-width="10"/>`
    : oneEye(120, 1, iris, brow, sleepy) + oneEye(280, 1, iris, brow, sleepy);
  return `<svg viewBox="0 0 400 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<rect width="400" height="100" fill="${def.colors.primary}"/>${hatch}${patch}${eyes}</svg>`;
}
