#!/usr/bin/env node
// Unit regression for src/core/save-sanitize.ts (corrupt / outdated saves; Node strips the TS types).
//   node tools/test-core-save.mjs   (exit 1 on failure)
import assert from 'node:assert/strict';
import { isQuality, sanitizeSave } from '../src/core/save-sanitize.ts';

const BIKES = ['roadbike', 'erba', 'shared', 'fixie', 'mtb', 'tandem', 'kidbike'];
const base = () => ({
  version: 1, coins: 300, ownedBikes: ['roadbike'], bike: 'roadbike',
  career: { unlocked: 1, best: {} },
  settings: { master: 0.9, music: 0.7, sfx: 0.9, voice: 0.9, quality: 'high', shake: 1, autoPedal: false, slowmo: 'full' },
  stats: { races: 0, wins: 0, kos: 0, wrecked: 0, busted: 0, distance: 0 },
  achievements: [],
});
const clean = (raw) => { const fixed = []; return { data: sanitizeSave(raw, base(), BIKES, fixed), fixed }; };

// A healthy save round-trips unchanged and reports nothing.
const good = { ...base(), coins: 1234, ownedBikes: ['roadbike', 'erba'], bike: 'erba', career: { unlocked: 3, best: { 'c1-coast': 2 } }, achievements: ['a', 'b'] };
assert.deepEqual(clean(good), { data: good, fixed: [] }, 'valid save is kept as is');

// Stale bike id (renamed bike) → default bike, never a crash at race start.
let r = clean({ bike: 'rocket', ownedBikes: ['roadbike', 'rocket', 'mtb'] });
assert.equal(r.data.bike, 'roadbike', 'unknown equipped bike falls back to the default');
assert.deepEqual(r.data.ownedBikes, ['roadbike', 'mtb'], 'unknown owned bikes are dropped, the starter bike stays');
assert.ok(r.fixed.includes('bike') && r.fixed.includes('ownedBikes'), 'repairs are reported');

// A known but unlisted equipped bike stays equipped and becomes owned.
r = clean({ bike: 'fixie', ownedBikes: [] });
assert.equal(r.data.bike, 'fixie');
assert.deepEqual(r.data.ownedBikes, ['roadbike', 'fixie'], 'equipped bike is always owned');

// Unknown quality / slow-mo, wrong types, out-of-range numbers.
r = clean({ settings: { quality: 'ultra', master: 'loud', music: 7, sfx: -1, shake: null, autoPedal: 'yes', slowmo: 'max' } });
assert.deepEqual(r.data.settings, { ...base().settings, music: 1, sfx: 0 }, 'settings are repaired field by field');
assert.deepEqual(r.fixed.sort(), ['settings.autoPedal', 'settings.master', 'settings.music', 'settings.quality', 'settings.sfx', 'settings.shake', 'settings.slowmo']);
assert.equal(clean({ settings: { quality: 'potato' } }).data.settings.quality, 'high');

// Numbers: NaN / Infinity / negatives / huge values; stats keep finite values only.
r = clean({ coins: -50, career: { unlocked: 'x', best: { a: 0, b: 3.4, c: 'first', d: 1e9 } }, stats: { races: Infinity, wins: 4, kos: -2 } });
assert.equal(r.data.coins, 0, 'negative coins clamp to 0');
assert.deepEqual(r.data.career, { unlocked: 1, best: { b: 3, d: 99 } }, 'career best keeps valid places only');
assert.deepEqual(r.data.stats, { ...base().stats, wins: 4 }, 'stats keep finite non-negative values');
assert.equal(clean({ coins: 1e300 }).data.coins, 1e9, 'coins are capped');

// Wrong shapes at the top level / nested objects.
for (const junk of [null, 42, 'save', [], { settings: [], career: 7, stats: 'x', achievements: 'all' }]) {
  const out = clean(junk).data;
  assert.equal(out.bike, 'roadbike');
  assert.deepEqual(out.settings, base().settings, `junk ${JSON.stringify(junk)} → default settings`);
  assert.deepEqual(out.achievements, []);
}
assert.deepEqual(clean({ achievements: ['x', 'x', 3, 'y'] }).data.achievements, ['x', 'y'], 'achievements: unique strings');

// Old partial saves only fill in defaults (nothing reported as repaired).
r = clean({ coins: 80, settings: { quality: 'low' } });
assert.equal(r.data.settings.quality, 'low');
assert.equal(r.data.settings.master, 0.9);
assert.deepEqual(r.fixed, [], 'missing fields are defaults, not repairs');

assert.ok(isQuality('medium') && !isQuality('ultra') && !isQuality(undefined), 'isQuality');
console.log('test-core-save OK');
