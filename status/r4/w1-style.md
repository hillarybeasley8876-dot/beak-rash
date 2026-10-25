# w1-style — STYLE chains (new module `src/gameplay/style`, SPEC §17)

## Plan
1. `src/gameplay/style/tuning.ts`: every STYLE number (chain window 3 s, mult step 0.25 / cap 4, repeat
   factor 0.5, base points, drift powers 0.26 / 0.33, SP cap 25 per 100, coins per 250) + the Chinese
   HUD labels.  Verify: `node tools/r4/tsc-own.mjs src/gameplay/style/` → TSC-OWN OK.
2. `src/gameplay/style/chain.ts`: the chain state — distinct kinds, Σ points, action count, the
   multiplier and the half points for the same kind twice in a row.  Verify: same tsc command.
3. `src/gameplay/style/actions.ts`: bus event → STYLE action (kind, label, points), pure mappers.
   Verify: same tsc command.
4. `src/gameplay/style/index.ts`: `createStyle(app)` — bus listeners (player only), the chain, the
   bank (`style:bank` + save.stats.bestStyle), `race:end` → RaceResult.styleBest, and the 3 s timeout
   check after every session step (the bus has no per-frame event, so `session.step` is wrapped while
   attached and restored on detach).
   Verify: `node tools/r4/w1-style.mjs` → w1-style OK.
5. Full acceptance: `node tools/r4/tsc-own.mjs src/gameplay/style/`, `node tools/r4/w1-style.mjs`,
   `node tools/core-check.mjs`.

## Done
- Step 1–4 done: `tuning.ts` (numbers + labels), `chain.ts` (chain state, half-repeat, ×0.25/kind,
  cap ×4), `actions.ts` (event → action), `index.ts` (listeners, chain, bank, save, race:end).
- Player only: every event of another rider is ignored (the player id comes from `session.player.id`).
- Actions: driftBoost 180/100/50 (power 0.33/0.26), nearMiss 60, perfect 80, trick (the event's
  points), hit 40, heavyHit 60, throwHit 90, parry 150, ko 200, steal 80, batonDodge 100.
- Bank: `total = round(Σ points × mult)`, `sp = min(25, ⌊total/100⌋)`, `coins = ⌊total/250⌋`; broken
  on a hit taken (combat:hit not blocked / npc:hit with damage) or a crash, not broken on the 3 s
  timeout. `style:bank` is emitted; the save's `stats.bestStyle` is raised at every bank; `race:end`
  writes the race's best bank into the player's `RaceResult.styleBest`.
- `attach(null)` drops the open chain silently and removes every listener; `dispose()` does the same.
- The 3 s timeout is checked after every session step: the bus has no per-frame event, so `index.ts`
  wraps `session.step` while it is attached and restores the original on detach (one compare, no
  allocation). Bus events also bank a chain whose window expired before the new action.
- A chain that is still open when the race ends is banked (not broken) so the player keeps it.

## In progress / next
Nothing — the module is complete and the acceptance commands pass. Next: the lead's decision on the
slingshot (see Requests).

## How to test (exact commands)
node tools/r4/tsc-own.mjs src/gameplay/style/
node tools/r4/w1-style.mjs
node tools/core-check.mjs
node shots/r4-w1-style/probe-actions.mjs   (probe: the actions the acceptance test does not cover)

## Evidence (key output lines)
- `node tools/r4/tsc-own.mjs src/gameplay/style/` → `TSC-OWN OK` (2 errors in files outside this job).
- `node tools/r4/w1-style.mjs` → 12 PASS, `w1-style OK` (chain 60 → 60/1/1; 4 actions → total 230,
  mult 1.25; 3 s idle → bank {total 288, count 4, sp 2, coins 1, broken false}; save bestStyle 288;
  drift L3 → 180 and a hit taken banks broken 180; other riders ignored; blocked hit does not break;
  KO 200; trick 290 ×1.25; crash banks round(490×1.25) = 613 broken; no console errors).
- `node tools/core-check.mjs` → `core-check OK` (8 PASS).
- `node shots/r4-w1-style/probe-actions.mjs` →
  `[["hit",40],["heavyHit",60],["throwHit",90],["parry",150],["steal",80],["batonDodge",100]]`,
  `mult after many kinds: 3 total 950`, `bank {total 2850, count 9, sp 25, coins 11, broken false}`,
  `race:end styleBest: [2850]`, `save bestStyle: 2850`, `errors: []`.

## Known issues
- The slingshot does not join the chain (see Requests): `SLINGSHOT_CHAINS = false` in `tuning.ts`.
  Reason: the acceptance test drives a race in which the player overtakes a rival and collects a passive
  slingshot (`rider:boost` kind 'draft', sim `contacts.ts` gives it when the player leaves a draft)
  while the test waits for the chain of its four deliberate actions to time out. The test expects that
  chain to bank with exactly its own 288 points, so any fifth action (the slingshot, 80 points, a
  third kind → ×1.5) breaks it. Measured with `shots/r4-w1-style/probe.mjs`: the player's draft boost
  fires at t = 4.30 s, the four manual actions end at t ≈ 2.4 s, the test's 200 frames end at
  t = 5.89 s → with the slingshot in the chain the bank lands at t = 7.3 s, after the test's window.
  Flipping `SLINGSHOT_CHAINS` to true makes `node tools/r4/w1-style.mjs` fail on two checks.

## Requests
- Slingshot (SPEC §17 "slingshot 80", brief bullet 2): please pick one —
  (a) keep the slingshot out of the chain (current, a passive draft bonus must not keep a skill chain
  alive nor grow its multiplier) and let SPEC §17 be amended, or
  (b) let the slingshot chain and let the acceptance test expect the extra action (the test's bank
  would be 465 instead of 288 and the idle bank lands ~1.4 s after the test's window).
  The implementation is ready for (b): one constant in `src/gameplay/style/tuning.ts`.
- Core: the bus has no per-frame event, so the 3 s chain timeout needs a per-step signal. The module
  wraps `session.step` while attached (restored on detach). A core-owned per-frame event (e.g.
  `race:tick`) would be cleaner; until then the wrap stays.
- Combat (later job): `style:bank` is emitted with `sp` / `coins` — combat applies them to the player
  and the coins to the rider.
