// What flies off each character when hit or knocked out: feathers for birds, fur for mammals.
import type { CharacterId } from '../../core/types';

export interface BodyBits { kind: 'feathers' | 'fur'; color: string; color2: string }

const BITS: Record<CharacterId, BodyBits> = {
  pelican: { kind: 'feathers', color: '#ffffff', color2: '#c9ced6' },
  goose: { kind: 'feathers', color: '#ffffff', color2: '#e8e4dc' },
  pigeon: { kind: 'feathers', color: '#a3acb8', color2: '#4fc59a' },
  penguin: { kind: 'feathers', color: '#2a2a33', color2: '#ffffff' },
  seagull: { kind: 'feathers', color: '#ffffff', color2: '#b8c0c8' },
  capybara: { kind: 'fur', color: '#a8754a', color2: '#7a5233' },
  cat: { kind: 'fur', color: '#f2a03d', color2: '#fff4e0' },
  shiba: { kind: 'fur', color: '#e0a458', color2: '#fff1d6' },
  sloth: { kind: 'fur', color: '#8a6a4a', color2: '#c8b090' },
  corgi: { kind: 'fur', color: '#e8892f', color2: '#ffffff' },
};

export function bodyBits(c: CharacterId): BodyBits {
  return BITS[c];
}
