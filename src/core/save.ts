// Persistent profile in localStorage. Corrupt or old saves fall back to defaults field by field
// (core/save-sanitize.ts): unknown bike ids, quality names and bad numbers never reach the game.
import { BIKES } from '../data/bikes';
import { sanitizeSave } from './save-sanitize';
import type { BikeId, Quality } from './types';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  quality: Quality;
  shake: number;        // 0..1 camera shake strength
  autoPedal: boolean;
  slowmo: 'full' | 'short' | 'off';
}

export interface SaveData {
  version: 1;
  coins: number;                       // 小鱼干
  ownedBikes: BikeId[];
  bike: BikeId;
  career: { unlocked: number; best: Record<string, number> };
  settings: Settings;
  stats: { races: number; wins: number; kos: number; wrecked: number; busted: number; distance: number };
  achievements: string[];
}

const KEY = 'beak-rash.save.v1';

export const defaultSave = (): SaveData => ({
  version: 1,
  coins: 300,
  ownedBikes: ['roadbike'],
  bike: 'roadbike',
  career: { unlocked: 1, best: {} },
  settings: { master: 0.9, music: 0.7, sfx: 0.9, voice: 0.9, quality: 'high', shake: 1, autoPedal: false, slowmo: 'full' },
  stats: { races: 0, wins: 0, kos: 0, wrecked: 0, busted: 0, distance: 0 },
  achievements: [],
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
