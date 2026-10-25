# r4 · w2-police — Police 2.0 (SPEC §14)

Status: **done** (all five acceptance commands run; see Evidence).

## Plan

1. `src/data/police-lines.ts` — the corgi's new lines (windup / strike / backup / roadblock /
   down / bribe yes-no).
2. `src/gameplay/race/police/tuning.ts` — every number of Police 2.0 (wanted thresholds, baton
   reach/timing, backup delay, roadblock geometry, bribe price) + the old chase numbers.
3. `src/gameplay/race/police/wanted.ts` — the wanted level W (0..3) with heat hysteresis +
   event bumps (two knocks → 2, a rival KO nearby → 2, a corgi down / two refused bribes → 3).
4. `src/gameplay/race/police/corgi.ts` — one corgi unit (RiderState + PoliceView + obstacle +
   baton state + HP), so a chase can run two of them (900 / 901).
5. `src/gameplay/race/police/baton.ts` — the wind-up → swing state machine
   (`police:windup` → `police:swing {hit}` → `npc:strike`).
6. `src/gameplay/race/police/roadblock.ts` + `roadblock-mesh.ts` — solid `barrier` obstacles across
   the drivable width with one 3.2 m gap, sawhorse meshes and the 「柯基执勤 POLICE」 sign.
7. `src/gameplay/race/police/bribe.ts` — 「V我50」: `combat:bell` near a corgi → `police:bribe`.
8. `src/gameplay/race/police/field.ts` — the ★3 field: the reinforcement (901), the roadblock, the bribe.
9. `src/gameplay/race/police/fight.ts` — the baton, the damage, the officer going down, the listeners.
10. `src/gameplay/race/police.ts` — the orchestrator (the mode machine, the chase, the summary).
11. `police-heat.ts` (tunnel cooling ×2), `police-chase.ts` (`ride(..., commit)` for the lunge).
12. `tools/race-scenarios/chase.mjs` — a new `stars` scenario for Police 2.0 (the old ones untouched).

### Verification commands (per step)
- typecheck: `npx tsc --noEmit -p tsconfig.json` · own: `node tools/r4/tsc-own.mjs <my files>`
- acceptance: `node tools/r4/w2-police.mjs` · `node tools/race-scenarios.mjs --only police,visible,outrun,koBust,selfBust,stars`
- soak: `node tools/race-soak.mjs --track city` · core: `node tools/core-check.mjs`

## Done
- Wanted stars W 0..3 (`police:wanted {riderId, level, prev}` on every change, back to 0 on escape /
  let-go / bust / bribe), heat hysteresis (0.5 / 0.75 / >0.95, the drop lines 0.42 / 0.68 / 0.9) and
  the event bumps (two knocks on the officer, a rival KO within 30 m → ★2; an officer down, two
  refused bribes → ★3).
- The baton (★2+): the officer holds the baton (`st.weapon = 'baton'`), winds up 0.45 s (★3: 0.35 s)
  behind the player, `police:windup` → `police:swing {hit}` → `npc:strike` (damage 10 / 14, knock
  4.2, `cause: 'police'`), cooldown 2.2 s (★3: 1.6 s), two officers never wind up within 0.6 s.
  The player dodges by braking out of reach (the officer commits to its lunge, a braked player
  leaves the box), by swerving out of the 1.9 m side band or by hopping.
- Fight back: 60 HP, a player swing (the weapon's damage, heavy ×1.5) or a thrown weapon
  (`combat:obstacleHit` on 900/901) hurts it and knocks it back (`police:hurt {hp}`); at 0 HP it
  tumbles (`st.crash`), `police:down` is emitted, the stars go to ★3, a backup is called in 6 s, the
  officer sits up after 3 s and leaves with 「柯基下班了！」.
- The backup (★3): a second corgi (obstacle 901, its own RiderState + PoliceView) sprints in 4 s
  later with the same chase AI; it can strike, be knocked and be bribed; both leave with the chase.
- The roadblock (★3, once per chase): 220–300 m ahead, never in a tunnel/bridge, never within
  150 m of the finish — solid `barrier` obstacles (≈2 m each) across the drivable width with one
  3.2 m gap at a seeded lane, red/white sawhorse meshes, cones and the 「柯基执勤 POLICE」 sign;
  `police:roadblock {s, gapX, gapWidth, pos}`; taken down 20 s after the player passes it. A fast
  hit on a barrier is a police crash → the player is busted when they are back on the bike.
- 「V我50」: the bell next to an officer (≤ 6 m) at ★1–★2 with ≥ 50 coins and fewer than two
  bribes this race → accepted (coins −50, `police:bribe {accepted: true}`, 「……下不为例。」, the
  chase ends as a let-go with no escape credit, heat 0.15, no new chase for 30 s). Refused at ★3
  («这次不行！»), with too few coins («小鱼干不够还想贿赂？») or on the third try («事不过三！») →
  `police:bribe {accepted: false}`, heat +0.10.
- The lines via `npc:say` (rate limited to one line per officer per 2.5 s) and the extra heat
  (a thrown hit +0.10, a rival KO within 30 m +0.15, the heat cools twice as fast in a tunnel
  while every officer is far behind).
- `__br.race.police()` still works and now also reports `wanted`, `hp`, `backup`, `roadblock`
  (plus `windup`, `cd`, `ds`, `lat` for debugging).

## In progress / next
- (nothing) — the unit is finished; the open items are below.

## How to test (exact commands)
```
node tools/r4/tsc-own.mjs src/gameplay/race/police.ts src/gameplay/race/police-chase.ts src/gameplay/race/police-heat.ts src/gameplay/race/police-view.ts src/gameplay/race/police/ src/data/police-lines.ts
node tools/r4/w2-police.mjs
node tools/race-scenarios.mjs --only police,visible,outrun,koBust,selfBust,stars
node tools/race-soak.mjs --track city
node tools/core-check.mjs
```

## Evidence (key output lines)
- `tools/r4/tsc-own.mjs` → `TSC-OWN OK` (0 errors in my files).
- `tools/r4/w2-police.mjs` → 17 PASS, `w2-police OK` (★1 no wind-up · ★2 wind-up 0.45 s + swing +
  npc:strike damage 10 · the dodge misses · the bribe 120 → 70 · ★3 backup 901 + a 3.2 m gap ·
  the bribe refused at ★3 · 35+35 → hp 25 → 0 · `police:down`).
- `tools/race-scenarios.mjs --only police,visible,outrun,koBust,selfBust,stars` → `24/24 checks passed`
  (the old police scenarios are untouched and still pass; `stars` is the new Police 2.0 scenario).
- `tools/core-check.mjs` → `core-check OK`.
- Screenshots: `shots/r4-w2-police/block2.jpg` (the block: the sign 「柯基执勤 POLICE」, the
  sawhorses, the cones and the gap) and `shots/r4-w2-police/baton.jpg` (the HUD's ★★ and the red
  "!" over the officer while it winds up).
- The audio unit generated voice clips for all 26 of the new lines (the clip texts match
  `src/data/police-lines.ts` exactly ✓).
- `tools/race-soak.mjs --track city` → **1 failing check, not caused by this unit** (see Known issues):
  seeds 1 and 2 bust the braking player ✓ (`busted: 1` / `busted: 2`), seed 3 does not.

## Known issues
- The city soak fails one check: `[seed 3] police never busted the braking player`. It is a timing
  coincidence in that race, not a regression:
  - The soak raises the heat at the first sample after t = 40 s. In the city seed-3 race the officer's
    only chase (t 24.2 → 40.4 s) ends **0.1 s before** that sample: it got tired while trailing and
    gave up (the old chase rules, untouched) — and a let-go caps the heat at 0.3, so the heat the
    soak just set is reset in the same frame and no new chase starts (`shots/r4-w2-police/probe-bust.mjs`,
    `probe-chase.mjs`).
  - The chase runs at ★1 there (the heat is 0.5–0.71), and the ★1 path is behaviourally identical to
    the pre-Police-2.0 code (the officer rides level with the player, never swings). The same
    failure reproduces with `setHeat(0.55)` (★1) and with `traffic=0`.
  - The heat in that race comes only from the autopilot's own hits (`combat:hit`), i.e. from the
    w2-rivals AI work in progress (`src/gameplay/race/ai/*` was being edited while this ran) — the
    new Police 2.0 heat sources (a thrown weapon hitting an officer, a rival KO next to one,
    traffic next to one) do not fire in that race at all (`probe-heat2.mjs`).
  - Fixing it inside the police unit would mean changing the old let-go/heat rules (the brief says
    to keep them), so I left them alone and reported it.

- The console errors the tools sometimes report (`[modules] unit "audio"/"ui"/"fx" failed to load`)
  come from the other units' in-flight edits and from the shared dev server being overloaded — the
  same commands pass again a minute later.
- ★3 needs a heat **above** 0.95 (`T.w3 = 0.95`, the test is `heat > w3`). SPEC §14 says "≥ 0.95",
  but `tools/race-scenarios/chase.mjs` (outrun) drives the heat to exactly 0.95 and expects a plain
  let-go; at ★3 the officer swings a 14-damage baton and a roadblock goes up, which busts that
  passive player. The acceptance test (heat 0.97 → ★3) and the new `stars` scenario (0.97) are
  unaffected. If the lead wants the literal "≥ 0.95", the outrun scenario has to change.
- The officer only reaches the player's tail when the player is not flat out (the officer cruises
  just under the player's top speed — the old chase rule, kept on purpose), so the baton mostly
  shows up when the player fights or drives at a moderate pace. A full-throttle player is let go
  before the officer can tail it (the old `outrun` behaviour).
- The strike's reach is the officer's forward sweep: it catches a rider up to 1.0 m *behind* the
  officer and 1.6 m ahead of it. A braked player leaves the box (the officer commits to its lunge
  during the wind-up), a swerving player leaves the 1.9 m side band, a hopping player clears the
  0.5 m height.

## Requests
- (core) none — every event Police 2.0 needs already exists in `core/events-map.ts`.
- (w2-events) the city's roadworks barriers (`race/events/roadworks.ts`) soft-locked the AI riders
  for a while (they piled up at the work zone and the soak reported them as stuck; reproduced with
  `police=0`, so not the police). It was fixed by the events unit while this job ran — the soak no
  longer reports stuck riders.
- (lead) the `race/events/roadworks.ts` barriers and the roadblock's barriers share the obstacle
  kind `barrier`; the roadblock's ids start at 8000 (the roadworks' at 5200) so the two never
  collide, but the acceptance test's gap check would see both if a work zone and a block landed on
  the same `s`.
