# r6 — unstick-2 (race AI: steering past a stopped car keeps pedalling)

## Plan
1. Reproduce: `node tools/race-soak.mjs --track gobi` → `FAIL [seed 1] rider 7 (penguin) stuck at s=1984`.
2. Probe `shots/r6-unstick-2/probe-gobi.mjs`: dump rider 7 every 0.5 s around s≈1980 (x, v, follow, escape,
   near blips) → confirm the follow stays on the car it is already beside.
3. `plan.ts` `blockage()`: the followed blip must really be in the rider's way — end the follow when the blip's
   body no longer overlaps the rider's current x (its own lane).
4. `brain.ts` `unstick()`: cut the throttle only while the followed blip overlaps our own x by the bike's half
   width AND the gap is under PRESSED_GAP; otherwise pedal fully.
5. Acceptance: soaks on all five tracks, `race-scenarios`, `w2-police`, `r6-net-det`, `core-check`, `tsc-own`.

## Done
- Steps 2–4 by the worker (MiniMax-M78). The worker's session then died on the gateway (429 "scheduler capacity
  exhausted for model=MiniMax-M78" and 502s from 06:33 to 07:18, runner gave up) before it ran the acceptance;
  the lead verified and finished it:
  - `blockage()` reports the followed blip's lateral centre and half width (`followX`, `followHw`), and
    `unstick()` only comes off the throttle while that blip overlaps the bike's own lane.
  - Lead change: the worker's "beside it already and out of our lane → not followed" rule applied to every
    blip, moving riders included, and shifted the pack's racing (police busts in soak-city seed 1 and
    soak-variants seed 4, the scenario "full-speed player is let go", combat-soak SHOWTIME timing). It now only
    applies to stopped things (`b.vs < STOPPED`: a stopped car, a standing prop) — the gobi case — and a moving
    rider beside us keeps its follow as before.

## In progress / next
- Nothing. The lead's narrowed rule (`b.vs < STOPPED`) is in the tree; the worker re-ran every acceptance
  command on that final state after round 1's two failures (see Evidence).

## Worker re-run of all 10 acceptance commands on the final state (branch r6, clean tree)
| command | result |
| --- | --- |
| `node tools/r4/tsc-own.mjs src/gameplay/race/ai/` | `TSC-OWN OK` |
| `node tools/race-soak.mjs --track gobi` | `SOAK OK` (maxStuck 2.5 / 0.5 / 0.5 s) |
| `node tools/race-soak.mjs --track watertown` | `SOAK OK` (2.5 / 0.5 / 0.5 s) |
| `node tools/race-soak.mjs --track city` | `SOAK OK` (0.5 / 0.5 / 1.0 s) — round 1's `police never busted` gone |
| `node tools/race-soak.mjs --track coast` | `SOAK OK` (0.5 / 1.5 / 2.0 s) |
| `node tools/race-soak.mjs --track mountain` | `SOAK OK` (0.5 / 0.5 / 3.0 s) |
| `node tools/race-scenarios.mjs` | `62/62 checks passed`, no FAIL, exit 0 — round 1's 61/62 gone |
| `node tools/r4/w2-police.mjs` | `w2-police OK` |
| `node tools/r6/net-det.mjs` | `r6-net-det OK` |
| `node tools/core-check.mjs` | `core-check OK` |


## How to test (exact commands)
- `node tools/race-soak.mjs --track gobi` (and watertown, city, coast, mountain; `--seeds 4 --extra ...` variants)
- `node tools/race-scenarios.mjs` · `node tools/combat-check.mjs --soak` · `node tools/r4/w2-police.mjs`
- `node tools/r6/net-det.mjs` · `node tools/core-check.mjs` · `node tools/r4/tsc-own.mjs src/gameplay/race/ai/`

## Evidence (key output lines)
- Before: `FAIL [seed 1] rider 7 (penguin) stuck at s=1984` (gobi soak, < 2 m/s for 5.5 s at 1.5 m/s).
- Worker's version: soak-gobi OK, but soak-city / soak-variants `police never busted the braking player`,
  race-scenarios 61/62 (`full-speed player is let go … busted at 22.9 s`), combat-soak `first SHOWTIME at 33.2 s`.
- Final version (lead's narrowing): soak-gobi, soak-city, soak-variants, combat-soak, race-scenarios (62/62) all OK;
  soak-watertown/coast/mountain, w2-police, w2-rivals, r6-police, r6-net-det, race-check, core-check, tsc re-run on it.

## Known issues
- watertown seed 1 can still queue ~4.5 s behind a stopped van at s≈2785 (under the 5 s rule; r6-unstick note).
- mountain seed 3 shows `maxStuck=3.0 s` — the slowest case left, under the soak's 5 s rule.
- Probes kept for the record: `shots/r6-unstick-2/probe-gobi.mjs` (rider 7 through the gobi work zone: it now
  passes s=1980 at 18 m/s instead of crawling at 1.5), `probe-police.mjs` (the corgi busting the braking player).

## Requests
- (none)
