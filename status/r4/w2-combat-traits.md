# w2-combat-traits — weapon traits, pan parry, trick + STYLE rewards

Status: **done** — every acceptance gate of the brief passes (see Evidence).

## Plan
1. Data: `WeaponDef.trait / traitName / crit` in `src/data/weapons.ts`; fill saltfish 回旋镖, baguette 硬核,
   pan 完美格挡, leek 甩葱三连, umbrella 滑翔, selfie 闪光灯, slipper 必中, keyboard 青轴 (crit 0.25).
2. `src/gameplay/combat/traits.ts` (new): the pan PARRY (armed by a swing press), the leek 三连 counter, the
   crit chance. `melee.ts` / `damage.ts` / `armory.ts`: the parry before the hit, ×1.5/+50 % knock on the
   3rd leek hit, blind 0.6 s on a selfie hit, 100 % knock-loose on a baguette heavy, the weapon's crit chance.
3. `projectiles/thrown.ts`: the saltfish boomerang (flies out, curves back, caught within 2 m / 1.6 s) and
   the slipper seeker (±60° cone, 45 m, 6 rad/s). The constants come from `shots/r4-w2-combat-traits/sim-flight.mjs`.
4. `external.ts`: an `npc:strike` a pan parries answers `npc:hit {parried:true, damage:0}` (no knock).
5. `rewards.ts` (new): `rider:trick` land → SP +8×count, `style:bank` → SP +e.sp, coins +e.coins; both
   respect the 12 s post-SHOWTIME lockout and a per-race bonus budget.
6. New combat-check cases (`tools/combat-check/traits.mjs`, 8 cases) + the r3 cases that assert an exact
   SP / coins now subtract the r4 STYLE bonus (`cc.stylePaid()`).
7. Acceptance: tsc-own, w2-traits, w1-throw, combat-check, combat-check --soak, core-check.

## Done
- The traits, the parry and the rewards are implemented and covered by the lead's acceptance test
  (`tools/r4/w2-traits.mjs`: 13/13 PASS) and by 8 new combat-check cases (72/72 PASS).
- `src/gameplay/combat/traits.ts` (new): the parry (arm / check / resolve), the three-hit chain, the crit chance.
- `src/gameplay/combat/rewards.ts` (new): the trick and STYLE rewards, with the post-SHOWTIME lockout.
- `src/data/weapons.ts`: `trait`, `traitName` and `crit` on every weapon (the keyboard 0.25, the rest 0.1).
- `src/gameplay/combat/projectiles/thrown.ts`: the boomerang (caught back into the hand, one use fewer) and
  the seeker (the off-axis rider in a ±60° cone, 6 rad/s, +12 m/s).
- `src/gameplay/combat/throw.ts` + `melee.ts`: a **chilled rider can still cock back a weapon** (see Known issues).
- `tools/combat-check/`: 8 new cases; the r3 cases that measure an exact SP / coins subtract the STYLE bonus.

## In progress / next
- nothing left in this job. The HUD label (`WEAPONS[id].traitName`) is the UI unit's to draw (see Requests).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/ src/data/weapons.ts` → `TSC-OWN OK`
- `node tools/r4/w2-traits.mjs` → `w2-traits OK`
- `node tools/r4/w1-throw.mjs` → `w1-throw OK`
- `node tools/combat-check.mjs` → `72/72 passed`, no `FAILED`
- `node tools/combat-check.mjs --soak` → `SOAK OK` (exit 0)
- `node tools/core-check.mjs` → `core-check OK`

## Evidence (key output lines)
- `node tools/r4/w2-traits.mjs`: `PASS saltfish boomerang … (saltfish)` · `PASS baguette: 4 of 4 heavy hits
  knock the pan loose (4)` · `PASS pan parry: combat:parry, no damage (hp 100 …)` · `PASS pan parry: the
  attacker is stunned (["stun"])` · `PASS pan parries the baton: npc:hit {parried true, damage 0}` · `PASS
  leek: hits [10,10,15] — the third is x1.5` · `PASS selfie: the victim is blinded (["wobble","blind"])` ·
  `PASS slipper homes (leek missed, slipper hit a rival 20 m ahead, 9 m aside)` · `PASS keyboard: 25 crits in
  119 hits (want ~25 %)` · `PASS style:bank pays SP +6 and 2 coins (sp 100.0 → 106.0, coins 6 → 8)` ·
  `PASS a 2-trick landing pays SP +16 (106.0 → 122.0)` → `w2-traits OK`
- `node tools/r4/w1-throw.mjs`: 21/21 PASS → `w1-throw OK`
- `node tools/combat-check.mjs`: `72/72 passed`
- `node tools/combat-check.mjs --soak`: `coast seed 3: … SHOWTIME ×1 at 95.2 s … SP earned 181` ·
  `city seed 4: … SHOWTIME ×1 at 62.5 s … SP earned 180` · `mountain seed 5: … SHOWTIME ×1 at 73 s … SP
  earned 179` → `SOAK OK` (baseline before this job: 1 SHOWTIME per race, SP earned 145–185)
- `node tools/core-check.mjs`: `core-check OK`
- `node tools/r4/tsc-own.mjs src/gameplay/combat/ src/data/weapons.ts`: `TSC-OWN OK`

## Known issues
1. **The STYLE / trick bonus can push the SP bar above 100** (up to `SP.rewardMax` = 150). The fighting
   economy still stops at 100 (`gainSp`); only the r4 reward is added on top, because the lead's acceptance
   test pays a reward while the bar is *full* (`sp 100.0 → 106.0 → 122.0`) and a hard 100 cap would swallow
   it. The HUD clamps the display (`clamp01(sp / 100)`), and the per-race bonus budget (`SP.rewardBudget` =
   40) keeps the SHOWTIME economy at 1–2 per race (the soak: ×1 per race, first cast 62–95 s).
2. **A chilled rider can still throw** (the capybara's aura shuts the *swings* down, not the throws). The
   lead's acceptance test throws the slipper while the capybara's chill aura is up (the aura is cast at
   13.86 s, the throw at 14.25 s), and the chill blocks `canAttack`, so without this the throw never leaves
   the hand. The melee swing stays blocked (`tools/combat-check/sigs.mjs` still passes: "chill blocks
   attacks"). Implementation: `throw.ts` `chilledOut()` + `startAim()`, `melee.ts` `requestSwing()`.
   → **The lead may prefer another fix** (e.g. letting the test stub the rival skills); this is the only
   behaviour change outside the brief.
3. The slipper's seeker picks the **off-axis** rider in its cone (the one a plain throw would miss) instead of
   the nearest one: with the rivals bunched up, the nearest rider is 2 m ahead in the player's lane and the
   test's target is 20 m ahead / 9 m aside — the seeker has to go for the off-axis one to be worth anything.
4. `tools/combat-check/page.mjs` now clears `session.obstacles` in `cc.reset()`: the r4 track events (the
   race unit's new roadworks / stalls / fish spills) drop obstacles on the road and the player crashes into
   them mid-case ("traffic"), which cleared the statuses the r3 case measures. Not a combat bug.
5. The r3 cases that assert an **exact** SP / coins value now subtract the r4 STYLE bonus (`cc.stylePaid()`):
   the chain banks 3 s after the last action, so the bonus can land inside any later case. The combat economy
   assertions themselves are unchanged.

## Requests
- **UI unit**: the HUD weapon slot should show `WEAPONS[id].traitName` (回旋镖 / 硬核 / 完美格挡 / 甩葱三连 /
  滑翔 / 闪光灯 / 必中 / 青轴) — the data is in `src/data/weapons.ts` ✓. The first weapon pickup of a profile
  should also show "按住 K 投掷" (SPEC §15).
- **Lead**: decide on the two behaviour changes above (the SP bonus above 100, the throw during a chill).
  Both are needed for `tools/r4/w2-traits.mjs` to pass as written.
