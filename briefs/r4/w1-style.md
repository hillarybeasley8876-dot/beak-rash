# r4 job w1-style — STYLE chains (new module `src/gameplay/style/`)

Read SPEC.md §17 (your spec), §15–§16 (throws and tricks that feed it) and §22. Contracts already in core (do not edit
core): events `style:chain { riderId, action, label, points, total, mult, count }` and `style:bank { riderId, total,
count, sp, coins, broken }`, `SaveData.stats.bestStyle`, `RaceResult.styleBest?`. Core already loads your module
(`src/core/modules.ts` imports `src/gameplay/style/index.ts` and calls `createStyle(app)` once; `src/core/game.ts`
calls `attach(session)` at race start and `attach(null)` when the race ends) — `src/gameplay/style/index.ts` is a
placeholder for you to replace. Look at `src/gameplay/achievements.ts` + `achievements/facts.ts` for how a session
module listens to the bus and cleans up.

## Behaviour (player only: ignore every event whose rider is not `session.player`)
- Actions and base points (the event that scores it):
  - `driftBoost`: `rider:boost` with kind 'drift' → power ≥ 0.33 → 180 (L3), ≥ 0.26 → 100 (L2), else 50 (L1)
  - `slingshot`: `rider:boost` kind 'draft' → 80
  - `nearMiss`: `rider:nearMiss` → 60
  - `perfect`: `rider:land` with perfect true → 80
  - `trick`: `rider:trick` phase 'land' → the event's `points` (already 120 × n + 50 × (n − 1))
  - `hit`: `combat:hit` attacker = player, not blocked, not heavy → 40; `heavyHit`: heavy → 60;
    `throwHit`: a hit whose `weapon` is not 'none' and differs from the weapon the player holds right now (the thrown
    weapon already left the hand) → 90
  - `parry`: `combat:parry` riderId = player → 150
  - `ko`: `combat:ko` attacker = player → 200
  - `steal`: `combat:weaponPick` riderId = player with `stolenFrom !== null` → 80
  - `batonDodge`: `police:swing` riderId = player with `hit: false` → 100
- Chain: an action within 3.0 s (session sim time, `session.time`) of the previous one extends the chain, else a new
  chain starts (the old one banks first). Points: the same action kind twice in a row scores half (round down to an
  integer). `total` = Σ points of the chain; `mult` = 1 + 0.25 × (distinct action kinds in the chain − 1), max 4;
  `count` = actions in the chain. Emit `style:chain` after every action with the running values and a short Chinese
  P5 `label` for the HUD (e.g. 擦肩, 完美落地, 特技, 击倒, 夺械, 招架, 漂移L3, 甩尾弹射, 飞刀, 闪避警棍).
- Bank: 3.0 s without an action → `broken: false`; a hit taken (`combat:hit` victim = player and not blocked, or
  `npc:hit` victim = player with damage > 0) or the player crashing (`rider:crash`) → bank at once, `broken: true`.
  Banked value `total = round(Σ points × mult)` (JS Math.round); `sp = min(25, ⌊total / 100⌋)`, `coins = ⌊total / 250⌋`.
  Emit `style:bank { riderId, total, count, sp, coins, broken }` (combat applies sp/coins in a later job — you only
  emit). Keep the best banked total of the race; on `race:end` write it into the player's RaceResult (`styleBest`) and
  raise `app.save.data.stats.bestStyle` (via `app.save.update`) when it is higher; also raise the save at every bank.
- Detach (`attach(null)`) drops the current chain silently and removes every bus listener. No allocations per frame;
  the 3 s timeout may be checked on bus events plus a cheap per-step check (subscribe to whatever per-step signal you
  find, or check lazily — the acceptance test steps frames and expects the bank ~3 s after the last action).
- Tuning numbers in one table (`src/gameplay/style/tuning.ts`). Files < 400 lines, no `any`.

## Files you own
`src/gameplay/style/` (whole folder).

## Acceptance (the runner runs these; read `tools/r4/w1-style.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/style/` → TSC-OWN OK
- `node tools/r4/w1-style.mjs` → w1-style OK
- `node tools/core-check.mjs` → core-check OK
