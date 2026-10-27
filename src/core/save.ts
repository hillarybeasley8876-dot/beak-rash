// Persistent profile in localStorage. Corrupt or old saves fall back to defaults field by field
// (core/save-sanitize.ts): unknown bike ids, quality names and bad numbers never reach the game.
import { BIKES } from '../data/bikes';
import { sanitizeSave } from './save-sanitize';
import type { BikeId, CharacterId, Quality, SkillLoadout } from './types';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  quality: Quality;
  shake: number;        // 0..1 camera shake strength
  autoPedal: boolean;
  slowmo: 'full' | 'short' | 'off';
  duckRider: boolean;   // the rubber duck rides on the handlebar (unlocked by finding every duck, SPEC §21)
}

export interface SaveData {
  version: 1;
  coins: number;                       // 小鱼干
  ownedBikes: BikeId[];
  bike: BikeId;
  career: { unlocked: number; best: Record<string, number> };
  settings: Settings;
  stats: {
    races: number; wins: number; kos: number; wrecked: number; busted: number; distance: number;
    bestStyle: number; tricks: number; bribes: number;
  };
  achievements: string[];
  /** r4 (SPEC §18): grudge 0..100 per rival species, updated by the race unit at race end. */
  rivalry: Partial<Record<CharacterId, number>>;
  /** r4 (SPEC §21): ids of found easter eggs (gameplay/secrets) and unlocked extras ('llm' bike, …). */
  secrets: string[];
  unlocks: string[];
  /** r6 (SPEC §23): the character the player races as (any racer). */
  character: CharacterId;
  /** r6 (SPEC §24): the player's skill loadout per character (absent = the character's default kit). */
  loadouts: Partial<Record<CharacterId, SkillLoadout>>;
  /** r6 (SPEC §24): 盲盒 — roll a random loadout every race instead of the saved one. */
  blindBox: boolean;
}

const KEY = 'beak-rash.save.v1';

export const defaultSave = (): SaveData => ({
  version: 1,
  coins: 300,
  ownedBikes: ['roadbike'],
  bike: 'roadbike',
  career: { unlocked: 1, best: {} },
  settings: { master: 0.9, music: 0.7, sfx: 0.9, voice: 0.9, quality: 'high', shake: 1, autoPedal: false, slowmo: 'full', duckRider: false },
  stats: { races: 0, wins: 0, kos: 0, wrecked: 0, busted: 0, distance: 0, bestStyle: 0, tricks: 0, bribes: 0 },
  achievements: [],
  rivalry: {},
  secrets: [],
  unlocks: [],
  character: 'pelican',
  loadouts: {},
  blindBox: false,
});

export class SaveStore {
  data: SaveData;
  private listeners = new Set<(d: SaveData) => void>();

  constructor(private storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.data = this.load();
  }

  update(mutate: (d: SaveData) => void): void {
    mutate(this.data);
    this.persist();
    for (const fn of Array.from(this.listeners)) fn(this.data);
  }

  onChange(fn: (d: SaveData) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    this.data = defaultSave();
    this.persist();
  }

  private load(): SaveData {
    const base = defaultSave();
    if (!this.storage) return base;
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return base;
      const fixed: string[] = [];
      const data = sanitizeSave(JSON.parse(raw) as unknown, base, Object.keys(BIKES) as BikeId[], fixed);
      if (fixed.length) console.warn(`[save] repaired invalid fields: ${fixed.join(', ')}`);
      return data;
    } catch (err) {
      console.warn('[save] unreadable save, starting fresh', err);
      return base;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[save] could not persist', err);
    }
  }
}
