#!/usr/bin/env node
// Podium balance (critic r3): full races with a passive player (lane keeping, full throttle) over seeds ×
// tracks (levels cycle). Asserts no rival species takes more than 35 % of the rival wins and every species
// that raced reaches a podium at least once. Prints each race, speed-skill casts per rival and a share table.
//   node tools/race-podium.mjs [--tracks coast,city,mountain] [--seeds 1-24] [--levels 1,2,3,4] [--par 3]
//     [--size 480x270] [--stub fx,audio] [--out shots/race/r3fix/podium.json]
import fs from 'node:fs';
import { parseArgs, withPage } from './lib.mjs';
import { openRace } from './race-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const range = (spec) => String(spec).split(',').flatMap((part) => {
  const [lo, hi] = part.split('-').map(Number);
  return hi ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : [lo];
});
const tracks = String(a.tracks ?? 'coast,city,mountain').split(',');
const seeds = range(a.seeds ?? '1-24');
const levels = range(a.levels ?? '1,2,3,4');
const par = Number(a.par ?? 3);
const stub = a.stub ? `&stub=${a.stub}` : '';
const DT = 1 / 30;
const SPEED_SKILLS = new Set(['penguin.slide', 'sloth.flash', 'shiba.doge', 'pigeon.ghost']);
const jobs = [];
// Each track gets its own seed block (coast 1…, city 101…, mountain 201…): per-race form dice must differ per race.
seeds.forEach((seed, i) => tracks.forEach((track, j) => jobs.push({ track, seed: seed + 100 * j, level: levels[(i + j) % levels.length] })));
const total = jobs.length;
const done = [];

const LEADER = `(() => { const s = window.__br.session(); const L = s.riders.slice().sort((p, q) => q.s - p.s)[0];
  return L.character + '@' + Math.round(L.s / s.track.length * 100); })()`;

async function race(h, job) {
  await openRace(h, `race=${job.track}&seed=${job.seed}&level=${job.level}&manual=1&intro=0${stub}`);
  const chars = await h.eval('Object.fromEntries(window.__br.session().riders.map((r) => [r.id, r.character]))');
  const lead = [];
  let form = {};
  for (let i = 0; i < 45 && !(await h.eval('!!window.__rl.end')); i++) {
    await h.eval(`window.__runHuman(300, ${DT}, 1000, 'passive')`);
    if (i % 3 === 1) lead.push(await h.eval(LEADER));
    // Today's form: base pace vs the level reference (roadbike 20 m/s × (1 + 2 %/level)), in %.
    if (i === 1) form = await h.eval(`Object.fromEntries(window.__br.race.ai().filter((b) => b.base !== null)
      .map((b) => [b.c, +((b.base / (20 * (1 + 0.02 * (${job.level} - 1))) - 1) * 100).toFixed(1)]))`);
  }
  const res = await h.eval('window.__rl.end ?? window.__br.race.results()');
  const casts = {};
  for (const e of await h.eval(`window.__rl.log.filter((e) => e.t === 'skill:cast')`)) {
    if (SPEED_SKILLS.has(e.p.skillId)) casts[chars[e.p.riderId]] = (casts[chars[e.p.riderId]] ?? 0) + 1;
  }
  return { ...job, res: res.map((r) => ({ place: r.place, c: r.character, t: r.time, me: r.isPlayer })), casts, lead, form,
    errors: (await h.errors()).length };
}

async function worker() {
  await withPage(async (page, h) => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const t0 = Date.now();
      try {
        const row = await race(h, job);
        done.push(row);
        const line = row.res.map((r) => `${r.place}.${r.me ? 'YOU' : r.c}:${r.t === null ? 'DNF' : r.t.toFixed(1)}`).join(' ');
        console.log(`[${done.length}/${total}] ${job.track} L${job.level} s${job.seed} (${((Date.now() - t0) / 1000).toFixed(0)} s): ${line}`);
        console.log(`    form % ${JSON.stringify(row.form)} · speed casts ${JSON.stringify(row.casts)}`);
        console.log(`    leader ${row.lead.join(' ')}${row.errors ? ` · ERRORS ${row.errors}` : ''}`);
      } catch (err) {
        console.log(`[x] ${job.track} L${job.level} s${job.seed} threw: ${String(err).slice(0, 200)}`);
      }
    }
  }, { size: a.size ?? '480x270' });
}

await Promise.all(Array.from({ length: Math.min(par, jobs.length) }, () => worker()));

const wins = {}, entries = {}, podiums = {}, mePlaces = [];
let rivalWins = 0, errors = 0;
for (const row of done) {
  errors += row.errors;
  const rivals = row.res.filter((r) => !r.me);
  for (const r of rivals) entries[r.c] = (entries[r.c] ?? 0) + 1;
  const winner = rivals.find((r) => r.place === 1);
  if (winner) { wins[winner.c] = (wins[winner.c] ?? 0) + 1; rivalWins++; }
  for (const r of row.res) if (!r.me && r.place <= 3) podiums[r.c] = (podiums[r.c] ?? 0) + 1;
  mePlaces.push(row.res.find((r) => r.me)?.place ?? 0);
}
console.log('\nspecies   entries  wins (share of rival wins)  podiums');
for (const c of Object.keys(entries).sort()) {
  console.log(`${c.padEnd(9)} ${String(entries[c]).padStart(7)}  ${String(wins[c] ?? 0).padStart(4)} (${(((wins[c] ?? 0) / Math.max(1, rivalWins)) * 100).toFixed(0)} %)              ${podiums[c] ?? 0}`);
}
console.log(`player places: ${mePlaces.join(' ')} · races ${done.length}/${total} · console errors ${errors}`);
if (a.out) fs.writeFileSync(a.out, JSON.stringify(done));
const maxShare = Math.max(0, ...Object.values(wins)) / Math.max(1, rivalWins);
const noPodium = Object.keys(entries).filter((c) => !podiums[c]);
const ok = done.length === total && maxShare <= 0.35 && noPodium.length === 0 && errors === 0;
console.log(`${ok ? 'PASS' : 'FAIL'} podium balance: max share ${(maxShare * 100).toFixed(0)} % (≤ 35 %), no podium: ${noPodium.join(',') || '-'}`);
process.exit(ok ? 0 : 1);
