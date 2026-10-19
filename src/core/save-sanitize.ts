// Field-by-field validation of a stored profile. Wrong types, unknown ids and out-of-range numbers fall
// back to the defaults, so a stale bike id or quality name can never block a race or disable a unit.
// Pure (type-only imports): tools/test-core-save.mjs runs it under plain Node.
import type { SaveData, Settings } from './save';
import type { BikeId, Quality } from './types';

export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];
const SLOWMO: readonly Settings['slowmo'][] = ['full', 'short', 'off'];
const MAX_COINS = 1e9;

type Loose = Record<string, unknown>;

const isRecord = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

export const isOneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  typeof v === 'string' && (options as readonly string[]).includes(v);

export const isQuality = (v: unknown): v is Quality => isOneOf(v, QUALITIES);

/** Reads fields of one stored object; every present-but-invalid value is recorded in `fixed`. */
class Fields {
  readonly raw: Loose;
  readonly path: string;
  readonly fixed: string[];

  constructor(raw: Loose, path: string, fixed: string[]) {
    this.raw = raw;
    this.path = path;
    this.fixed = fixed;
  }

  static of(raw: unknown, path: string, fixed: string[]): Fields {
    if (raw !== undefined && !isRecord(raw)) fixed.push(path);
    return new Fields(isRecord(raw) ? raw : {}, path, fixed);
  }

  private reject<T>(key: string, fallback: T): T {
    if (this.raw[key] !== undefined) this.fixed.push(`${this.path}${key}`);
    return fallback;
  }

  num(key: string, fallback: number, min: number, max: number, round = false): number {
    const v = this.raw[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return this.reject(key, fallback);
    const out = Math.min(max, Math.max(min, round ? Math.round(v) : v));
    if (out !== v) this.fixed.push(`${this.path}${key}`);
    return out;
  }

  bool(key: string, fallback: boolean): boolean {
    const v = this.raw[key];
    return typeof v === 'boolean' ? v : this.reject(key, fallback);
  }

  pick<T extends string>(key: string, options: readonly T[], fallback: T): T {
    const v = this.raw[key];
    return isOneOf(v, options) ? v : this.reject(key, fallback);
  }

  strings(key: string): string[] {
    const v = this.raw[key];
    if (!Array.isArray(v)) return this.reject(key, []);
    const out = [...new Set(v.filter((s): s is string => typeof s === 'string'))];
    if (out.length !== v.length) this.fixed.push(`${this.path}${key}`);
    return out;
  }
}

function settingsOf(f: Fields, base: Settings): Settings {
  const unit = (key: 'master' | 'music' | 'sfx' | 'voice' | 'shake'): number => f.num(key, base[key], 0, 1);
  return {
    master: unit('master'), music: unit('music'), sfx: unit('sfx'), voice: unit('voice'),
    quality: f.pick('quality', QUALITIES, base.quality),
    shake: unit('shake'),
    autoPedal: f.bool('autoPedal', base.autoPedal),
    slowmo: f.pick('slowmo', SLOWMO, base.slowmo),
  };
}

function careerOf(f: Fields, base: SaveData['career']): SaveData['career'] {
  const bestFields = Fields.of(f.raw.best, `${f.path}best.`, f.fixed);
  const best: Record<string, number> = {};
  for (const [key, place] of Object.entries(bestFields.raw)) {
    if (typeof place === 'number' && Number.isFinite(place) && place >= 1) best[key] = Math.min(99, Math.round(place));
    else f.fixed.push(`${bestFields.path}${key}`);
  }
  return { unlocked: f.num('unlocked', base.unlocked, 1, 99, true), best };
}

function statsOf(f: Fields, base: SaveData['stats']): SaveData['stats'] {
  const out = { ...base };
  for (const key of Object.keys(base) as Array<keyof SaveData['stats']>) {
    out[key] = f.num(key, base[key], 0, Number.MAX_SAFE_INTEGER);
  }
  return out;
}

/** A valid SaveData from any parsed JSON value. `bikes` are the bike ids that exist in this build;
 *  the dotted paths of repaired fields are appended to `fixed` (for one console warning). */
export function sanitizeSave(raw: unknown, base: SaveData, bikes: readonly BikeId[], fixed: string[] = []): SaveData {
  const f = Fields.of(raw, '', fixed);
  const listed = f.strings('ownedBikes');
  const known = listed.filter((id): id is BikeId => isOneOf(id, bikes));
  if (known.length !== listed.length) fixed.push('ownedBikes');
  const owned = [...new Set([...base.ownedBikes, ...known])];
  const bike = f.pick('bike', bikes, base.bike);
  if (!owned.includes(bike)) owned.push(bike);
  return {
    version: 1,
    coins: f.num('coins', base.coins, 0, MAX_COINS, true),
    ownedBikes: owned,
    bike,
    career: careerOf(Fields.of(f.raw.career, 'career.', fixed), base.career),
    settings: settingsOf(Fields.of(f.raw.settings, 'settings.', fixed), base.settings),
    stats: statsOf(Fields.of(f.raw.stats, 'stats.', fixed), base.stats),
    achievements: f.strings('achievements'),
  };
}
