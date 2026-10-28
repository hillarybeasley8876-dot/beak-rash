#!/usr/bin/env node
// r6 acceptance: every racer has its own animal call (SPEC §13 / §23). Lead-owned, read-only for workers.
// The roster's racers (src/data/roster.ts, `racer: true`) each need an `animal.<id>` entry in src/audio/sfx/animals.ts:
// voice/barks.ts plays it on taunts and hits, sfx/bank.ts pre-renders it; a missing one is silent and logs
// `[audio] unknown sfx` (audio-check --game fails on it).
//   node tools/r6/animals.mjs
import fs from 'node:fs';
import { expect, finish } from '../r4/accept-lib.mjs';

const roster = fs.readFileSync('src/data/roster.ts', 'utf8');
const animals = fs.readFileSync('src/audio/sfx/animals.ts', 'utf8');
// one entry per character: from `id: '<id>'` to the next `id: '` (the entry's own fields)
const entries = [...roster.matchAll(/\bid: '([a-z]+)', name: '([^']+)'/g)].map((m, i, all) => {
  const end = i + 1 < all.length ? all[i + 1].index : roster.length;
  return { id: m[1], name: m[2], body: roster.slice(m.index, end) };
});
const racers = entries.filter((e) => /\bracer: true\b/.test(e.body));
expect(racers.length >= 15, `the roster's racers are found (${racers.length}: ${racers.map((r) => r.id).join(' ')})`);
const missing = racers.filter((r) => !new RegExp(`'animal\\.${r.id}'\\s*:`).test(animals));
expect(missing.length === 0, `every racer has an animal call (missing: ${missing.map((r) => `${r.id} ${r.name}`).join(', ') || 'none'})`);
const meme = ['bananacat', 'cryingcat', 'xinxian', 'moodeng', 'pedro', 'hamster'];
const bodies = meme.map((id) => (animals.match(new RegExp(`'animal\\.${id}'\\s*:([\\s\\S]*?)(?=\\n  '|\\n};)`)) ?? [])[1] ?? '');
expect(new Set(bodies.filter(Boolean).map((b) => b.replace(/\s+/g, ''))).size === meme.length, 'the six meme calls are six different sounds');
finish('r6-animals');
