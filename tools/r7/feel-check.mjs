#!/usr/bin/env node
// r7 acceptance: the skill feel contract (SPEC §29), applied to the audit (tools/r7/feel.mjs → summary.json).
// Lead-owned, read-only for workers. Per skill, in the audit's race-like scene (seven rivals around the player, three
// of them with SP and one with a pan, pickups ahead, the player at 70 % HP):
//   seen    — its own visuals cover ≥ 3 % of the middle of the screen at +0.3 s (traps ≥ 1.5 %) and ≥ 6 % at their peak
//   result  — what the rule says: rivals affected (hit/trap), metres gained (move), protection or HP (defense),
//             something taken (steal), something happened (any)
//   hud     — (--hud) a status word or a damage number over a victim; the caster's readout (命中 ×N / 落空 /
//             skill:result); a trap that fires behind the player is called out (st-rear)
//   node tools/r7/feel-check.mjs [--summary F:/dev/beak-rash-out/r7/feel/summary.json] [--only id,id] [--hud]
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';

const a = parseArgs(process.argv.slice(2));
const SUMMARY = String(a.summary ?? 'F:/dev/beak-rash-out/r7/feel/summary.json');
const HUD = !!a.hud;
const only = a.only ? new Set(String(a.only).split(',')) : null;

/** The contract per skill: kind + thresholds (min rivals affected, metres gained, protective statuses, HP). */
const RULES = {
  'pelican.torpedo': { kind: 'hit', min: 1 },
  'pelican.gulp': { kind: 'hit', min: 1 },
  'pelican.wing': { kind: 'move', gain: 10 },
  'pelican.ult': { kind: 'hit', min: 3 },
  'goose.honk': { kind: 'hit', min: 2 },
  'capybara.chill': { kind: 'hit', min: 2 },
  'cat.spin': { kind: 'hit', min: 1 },
  'shiba.doge': { kind: 'defense', status: ['shield', 'intangible'], gain: 8 },
  'pigeon.ghost': { kind: 'move', gain: 15 },
  'penguin.slide': { kind: 'move', gain: 8 },
  'seagull.steal': { kind: 'steal', min: 1 },
  'sloth.flash': { kind: 'move', gain: 15 },
  'corgi.whistle': { kind: 'hit', min: 2 },
  'bananacat.peel': { kind: 'trap', min: 1 },
  'cryingcat.tears': { kind: 'hit', min: 2, gain: 6 },
  'xinxian.fresh': { kind: 'move', gain: 8 },
  'moodeng.bounce': { kind: 'hit', min: 2 },
  'pedro.trash': { kind: 'any' },
  'hamster.violin': { kind: 'hit', min: 2 },
  'pool.firebreath': { kind: 'hit', min: 1 },
  'pool.icelance': { kind: 'hit', min: 1 },
  'pool.thunder': { kind: 'hit', min: 1 },
  'pool.watergun': { kind: 'hit', min: 1 },
  'pool.tornado': { kind: 'hit', min: 2 },
  'pool.boomerang': { kind: 'hit', min: 1 },
  'pool.pie': { kind: 'hit', min: 1 },
  'pool.brainfight': { kind: 'hit', min: 2 },
  'pool.rocket': { kind: 'move', gain: 10 },
  'pool.blink': { kind: 'move', gain: 15 },
  'pool.bubble': { kind: 'defense', status: ['shield'] },
  'pool.thermos': { kind: 'defense', hp: 20 },
  'pool.ducks': { kind: 'hit', min: 2 },
  'pool.firecracker': { kind: 'trap', min: 1 },
  'pool.popup': { kind: 'hit', min: 1 },
  'pool.warsong': { kind: 'hit', min: 2, gain: 6 },
  'pool.snowball': { kind: 'hit', min: 2 },
  'ult.timestop': { kind: 'hit', min: 3 },
  'ult.meteor': { kind: 'hit', min: 3 },
  'ult.storm': { kind: 'hit', min: 3 },
};

const words = (() => {
  const src = fs.readFileSync(new URL('../../src/data/status-words.ts', import.meta.url), 'utf8');
  return [...src.matchAll(/word: '([^']+)'/g)].map((m) => m[1]);
})();

const sum = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
let fails = 0;
const say = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };
for (const [id, rule] of Object.entries(RULES)) {
  if (only && !only.has(id)) continue;
  const s = sum.skills[id];
  if (!s || s.error) { say(false, `${id}: no audit ride (${s?.error ?? 'missing'})`); continue; }
  const why = [];
  // seen
  const at03 = s.screen[1][1], peak = s.peak_mid;
  const floor = rule.kind === 'trap' ? 0.015 : 0.03;
  if (at03 < floor) why.push(`only ${(at03 * 100).toFixed(1)} % of the screen at +0.3 s (≥ ${floor * 100} %)`);
  if (peak < 0.06) why.push(`peak ${(peak * 100).toFixed(1)} % of the screen (≥ 6 %)`);
  // result
  const pl = s.player.at(-1) ?? { gain: 0, hp: 0, sp: 0, coins: 0, w: null };
  const pst = new Set(s.player.flatMap((p) => p.st));
  const gain = pl.gain;
  if ((rule.kind === 'hit' || rule.kind === 'trap') && s.affected < rule.min) why.push(`${s.affected} rivals affected (≥ ${rule.min})`);
  if (rule.gain && gain < rule.gain) why.push(`+${gain.toFixed(1)} m in 3.5 s (≥ ${rule.gain} m)`);
  if (rule.kind === 'defense' && rule.status && !rule.status.some((x) => pst.has(x))) why.push(`no ${rule.status.join('/')} on the caster`);
  if (rule.kind === 'defense' && rule.hp) {
    const hp = Math.max(...s.player.map((p) => p.hp));
    if (hp < rule.hp) why.push(`+${hp} HP vs CONTROL (≥ ${rule.hp})`);
  }
  if (rule.kind === 'steal' && !(pl.sp >= 10 || pl.w || pl.coins >= 3)) why.push(`nothing taken (SP ${pl.sp}, coins ${pl.coins}, weapon ${pl.w ?? '-'})`);
  if (rule.kind === 'any' && !(s.affected >= 1 || Math.abs(pl.sp) >= 10 || pl.w || pl.coins >= 3 || pl.hp >= 10 || gain >= 8)) why.push('nothing happened');
  // hud
  if (HUD) {
    const texts = s.hud ?? [];
    const cls = s.hud_cls ?? [];
    const offensive = rule.kind === 'hit' || rule.kind === 'trap';
    if (offensive && !(texts.some((t) => words.some((w) => t.includes(w))) || (s.nums ?? []).length > 0)) why.push('no status word or damage number on the HUD');
    const readout = s.has_readout ?? cls.some((c) => /st-readout/.test(c));
    const rearOut = s.has_rear ?? cls.some((c) => /st-rear/.test(c));
    if (rule.kind !== 'move' && rule.kind !== 'defense' && !readout) why.push("no caster readout (st-readout: 命中 ×N / 落空 / skill:result)");
    if (rule.kind === 'trap' && !rearOut) why.push('the trap firing behind is not called out (st-rear)');
  }
  say(why.length === 0, `${id.padEnd(17)} ${why.length ? why.join('; ') : `seen ${(at03 * 100).toFixed(1)}→${(peak * 100).toFixed(1)} %, ${s.affected} affected, ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} m`}`);
}
console.log(fails ? `\nfeel-check FAILED (${fails})` : '\nfeel-check OK');
process.exit(fails ? 1 : 0);
