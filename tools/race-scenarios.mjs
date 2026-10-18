#!/usr/bin/env node
// Race unit scenario checks (deterministic manual stepping). Prints PASS/FAIL per check.
//   node tools/race-scenarios.mjs [--only police,launch,finish,…] [--shots] [--stub world,sim,…] [--seeds 1,2]
// Groups: basic (police, launch, finish, restart, timeout), fair (close, bikes, mugging, opening, flicker, pulses),
// chase (visible, arrive, outrun, koNoBust, selfBust), contact (grudge, stopped, brakecheck), chatter, order (penalty, tie), traffic (popin). close, bikes, mugging and
// arrive (full races) run only when named.
import { parseArgs, withPage } from './lib.mjs';
import { basicScenarios } from './race-scenarios/basic.mjs';
import { chaseScenarios } from './race-scenarios/chase.mjs';
import { chatterScenarios } from './race-scenarios/chatter.mjs';
import { contactScenarios } from './race-scenarios/contact.mjs';
import { fairScenarios } from './race-scenarios/fair.mjs';
import { orderScenarios } from './race-scenarios/order.mjs';
import { trafficScenarios } from './race-scenarios/traffic.mjs';

const a = parseArgs(process.argv.slice(2));
const only = a.only ? String(a.only).split(',') : null;
const stub = a.stub ? `&stub=${a.stub}` : '';
const results = [];
const check = (name, ok, info) => {
  results.push({ name, ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, info === undefined ? '' : JSON.stringify(info));
};
const scenarios = { ...basicScenarios, ...fairScenarios, ...chaseScenarios, ...chatterScenarios, ...contactScenarios, ...orderScenarios, ...trafficScenarios };
const NAMED_ONLY = new Set(['close', 'mugging', 'bikes', 'arrive']);   // slow multi-race runs

await withPage(async (page, h) => {
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only ? !only.includes(name) : NAMED_ONLY.has(name)) continue;
    try { await fn(page, h, { check, stub, a }); } catch (err) { check(`${name} (threw)`, false, String(err).slice(0, 300)); }
    const errs = await h.errors().catch(() => []);
    if (errs.length) check(`${name}: no console errors`, false, errs.slice(0, 3));
  }
});
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
