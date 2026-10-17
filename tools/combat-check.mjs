#!/usr/bin/env node
// Combat scenario checks (deterministic, manual stepping). Critics rerun this.
//   node tools/combat-check.mjs [--only <substring>] [--seed 7] [--full | --stub a,b] [--keep-going]
// Default isolates fx/audio/ui/actors with core stubs (no slow-mo cinematics changing sim time, no breakage
// from views being edited); --full runs every real unit; --stub picks the stubbed units explicitly.
import { fixes } from './combat-check/fixes.mjs';
import { fixes2 } from './combat-check/fixes2.mjs';
import { finish } from './combat-check/finish.mjs';
import { installHelpers } from './combat-check/page.mjs';
import { items } from './combat-check/items.mjs';
import { melee } from './combat-check/melee.mjs';
import { sigs } from './combat-check/sigs.mjs';
import { skills } from './combat-check/skills.mjs';
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const LINEUP = 'goose,cat,capybara,shiba,pigeon,penguin,seagull,sloth,corgi';
const stubs = a.full ? '' : typeof a.stub === 'string' ? a.stub : 'fx,audio,ui,actors';
const stub = stubs ? `&stub=${stubs}` : '';
const url = `/?race=coast&seed=${a.seed ?? 7}&traffic=0&police=0&manual=1&rivals=${LINEUP}${stub}`;
const all = [...melee, ...items, ...skills, ...sigs, ...fixes, ...fixes2, ...finish].filter(([name]) => !a.only || name.includes(String(a.only)));

// Every console error fails the run unless it is clearly another unit's (its [tag] or a stack in its files);
// those are listed but don't fail (isolate them with --stub).
const FOREIGN = /\[(actors|fx|ui|hud|audio|sim|camera|race|world|track|modules|game)\]|\/src\/(actors|fx|ui|audio|sim|camera|world|gameplay\/race)\//;
const isCombatError = (e) => /\/src\/gameplay\/combat\/|\[combat\]/.test(e) || !FOREIGN.test(e);

const results = await withPage(async (page, h) => {
  await h.goto(url);
  await page.evaluate(installHelpers);
  await page.evaluate(() => {
    const cc = window.__cc;
    cc.until(() => cc.S().phase === 'racing', 3000);
    cc.ctl({ throttle: 1 });
    cc.step(120);
  });
  const out = [];
  for (const [name, fn] of all) {
    const t0 = Date.now();
    let res;
    try {
      res = await page.evaluate(fn);
    } catch (err) {
      res = { ok: false, info: `threw: ${err.message.split('\n')[0]}` };
    }
    out.push({ name, ok: !!res.ok, info: res.info, ms: Date.now() - t0 });
    console.log(`${res.ok ? 'PASS' : 'FAIL'}  ${name}${res.ok ? '' : `\n      ${JSON.stringify(res.info)}`}`);
    if (!res.ok && !a['keep-going'] && a.only) break;
  }
  const logged = await h.errors();
  const errors = logged.filter(isCombatError), foreign = logged.filter((e) => !isCombatError(e));
  if (foreign.length) console.log(`note  ${foreign.length} console error(s) from other units:\n      ${foreign.slice(0, 3).map((e) => e.slice(0, 160)).join('\n      ')}`);
  out.push({ name: 'no combat (or unattributed) errors in the console', ok: errors.length === 0, info: errors.slice(0, 5) });
  console.log(`${errors.length === 0 ? 'PASS' : 'FAIL'}  no combat (or unattributed) errors in the console${errors.length ? `\n      ${errors.slice(0, 3).join('\n      ')}` : ''}`);
  return out;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(' | ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
