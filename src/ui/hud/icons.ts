// Tiny bold SVG icons for the weapon slot (48×48, thick ink outline, flat colours).
import type { WeaponId } from '../../core/types';

const K = '#0B0B0F';

const ICONS: Record<WeaponId, string> = {
  none:
    `<path d="M6 30 C10 14 24 8 42 8 C36 14 34 18 36 22 C30 22 28 26 30 30 C24 30 22 34 24 38 C16 38 10 36 6 30 Z" fill="#E9E6DF"/>` +
    `<path d="M30 30 C34 31 38 30 42 28 M24 38 C28 39 32 38 36 36" fill="none"/>`,
  saltfish:
    `<path d="M4 24 C12 12 30 12 38 22 L46 14 L44 24 L46 34 L38 26 C30 36 12 36 4 24 Z" fill="#C9D3DA"/>` +
    `<circle cx="13" cy="22" r="2.5" fill="${K}" stroke="none"/><path d="M20 18 L24 30 M27 18 L30 29" fill="none" stroke-width="2.5"/>`,
  baguette:
    `<path d="M8 40 C4 36 6 30 12 26 L34 8 C40 4 46 8 44 14 L22 38 C18 43 12 44 8 40 Z" fill="#E3A44E"/>` +
    `<path d="M16 30 L22 34 M23 24 L29 28 M30 17 L36 21" fill="none" stroke-width="2.5"/>`,
  pan:
    `<circle cx="20" cy="22" r="15" fill="#3B3B44"/><circle cx="20" cy="22" r="9" fill="#5B5B66" stroke="none"/>` +
    `<path d="M31 32 L45 45" stroke-width="7"/><path d="M31 32 L45 45" stroke="#8A5A2B" stroke-width="3"/>`,
  leek:
    `<path d="M10 44 L26 22" stroke="#F1F6E9" stroke-width="9"/><path d="M10 44 L26 22" fill="none" stroke-width="2" />` +
    `<path d="M24 24 C26 12 32 6 40 4 C36 10 34 16 34 22 C38 18 42 16 46 16 C40 22 34 28 28 28 Z" fill="#3FA34D"/>`,
  umbrella:
    `<path d="M4 22 C6 8 42 8 44 22 C38 18 32 18 24 22 C16 18 10 18 4 22 Z" fill="#E5191C"/>` +
    `<path d="M24 22 L24 40 C24 46 16 46 16 40" fill="none" stroke-width="4"/>`,
  selfie:
    `<path d="M8 44 L34 14" stroke-width="5"/><rect x="30" y="4" width="14" height="20" rx="3" fill="#2E8BFF" transform="rotate(40 37 14)"/>` +
    `<circle cx="38" cy="12" r="2.5" fill="#fff" stroke="none"/>`,
  slipper:
    `<path d="M10 40 C2 36 4 20 12 12 C18 6 28 6 34 12 L44 30 C46 36 42 42 36 42 Z" fill="#FF7FB0"/>` +
    `<path d="M12 22 C18 16 28 16 34 22" fill="none" stroke-width="6"/><path d="M12 22 C18 16 28 16 34 22" fill="none" stroke="#2EC4B6" stroke-width="3"/>`,
  keyboard:
    `<rect x="3" y="14" width="42" height="22" rx="3" fill="#2B2B33"/>` +
    `<path d="M8 20 h4 M15 20 h4 M22 20 h4 M29 20 h4 M36 20 h4 M10 26 h4 M17 26 h4 M24 26 h4 M31 26 h4 M14 31 h20" stroke="#5BE37D" stroke-width="3"/>`,
};

export function weaponIcon(id: WeaponId): string {
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g stroke="${K}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${ICONS[id]}</g></svg>`;
}
