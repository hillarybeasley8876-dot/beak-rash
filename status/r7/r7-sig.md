# r7-sig — signature skills felt (doge / slide / steal / whistle)

## Plan
1. Baseline: run the feel audit on the 4 failing skills to have numbers before the change.
   `node tools/r7/feel.mjs --only shiba.doge,penguin.slide,seagull.steal,corgi.whistle --out F:/dev/beak-rash-out/r7/feel-sig-base`
2. doge.ts: get the audit to ≥ 8 m in 3.5 s **without** raising the 'boost' status strength (the lead-owned
   `skill boosts keep their own clock` case pins it at 1.15): keep `boost 0.15` and add a launch kick
   (the sloth.flash pattern), plus the doge face on the bubble and `skill:result` 「狗头护体 3s」.
3. slide.ts: SLIDE.boost 0.25 → 0.33. Proof: audit gain ≥ 8 m.
4. steal.ts: victim = nearest rider ≤ 9 m that HAS something (weapon or SP ≥ 5), else nearest;
   weapon + up to 25 SP; nothing there → fries (+10 SP). Visual: the grab flies out and back carrying
   the loot (weapon prop / coin) + aura discs + fx. `skill:result` 「偷到 …」.
5. whistle.ts: everyone in the 20 m ±35° cone gets the warning baseline (a wobble, 1.2 s) — the `slow`
   status stays the offenders' fine, which is what `whistle slows offenders only` pins;
   `skill:result` 「警告 ×N」/「罚单 ×N」. Proof: audit affected ≥ 2 AND `combat-check` 72/72.
6. Full acceptance: tsc-own, feel + feel-check (12 skills), combat-check, --soak, w2-rivals, w2-police,
   net-det, core-check.

## Done
- `shiba.doge`: `DOGE = { dur 3, boost 0.15, launch 1.45 }` — the cast kicks the bike to 1.45 × its top speed
  (~6 m/s of overspeed over the boosted top, spent by the overspeed drag over the next second) and the +15 %
  status holds 3 s: **+18.3 m in 3.5 s** (was +3.5 m). `DogeBubble` (a ShieldBubble subclass) inks the doge's
  face on the camera side of the bubble — pixel deal-with-it shades, an additive cream muzzle and a smirk, so the
  rider still reads through them — plus a `sparkle` burst and `skill:result` 「狗头护体 3s」 (the HUD renders it).
- `penguin.slide`: boost 0.33 → **+10.2 m**; the icy streak is unchanged.
- `seagull.steal`: `STEAL = { radius 9, sp 25, fries 10, rich 5 }`. Victim = nearest rider ≤ 9 m that has a
  weapon or SP ≥ 5, else the nearest one at all. Takes the weapon **and** up to 25 SP; a rider with nothing
  loses its fries (+10 SP out of thin air). Visible snatch: `Snatch` (the loot — the victim's weapon prop, or a
  coin — flies from the beak to the victim and back, spinning, with an additive glow), the old `Tether`, two
  `AuraDisc` marks (victim + caster) and `fries`/`sparkle`/`coin` bursts → **14.6 % of the middle at +0.3 s**
  (was 2.3 %), and the pan really moves: player `{"sp":25,"w":"pan"}`, goose `"pan->none"`. `skill:result`
  「偷到 平底锅 偷到 25 SP」 / 「偷到薯条 +10 SP」 / 「抢了个寂寞」; `skill:hit` on the victim.
- `corgi.whistle`: everyone in the 20 m ±35° cone is warned — `wobble` 1.2 s, their bike rocks (this is the
  baseline an ordinary race needs, SPEC §29 rule 3). Offenders (heat > 0.05 or a hit in the last 6 s) are fined
  as before: `slow` 50 % for 2 s + `wobble` 0.45 s + `cue('stun')` + a camera nudge. `skillAffect` still emits
  `skill:hit` for every rider it touches; `skill:result` 「罚单 ×N」 / 「警告 ×N」.

## In progress / next
- none. `torpedo / gulp / wing / honk / chill / spin / ghost / flash / swallow` were not touched (they pass).

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/`
- `node tools/r7/feel.mjs --only pelican.torpedo,…,corgi.whistle --out F:/dev/beak-rash-out/r7/feel-sig && node tools/r7/feel-check.mjs --summary F:/dev/beak-rash-out/r7/feel-sig/summary.json --only …`
- `node tools/combat-check.mjs` · `node tools/combat-check.mjs --soak`
- `node tools/r4/w2-rivals.mjs` · `node tools/r4/w2-police.mjs` · `node tools/r6/net-det.mjs` · `node tools/core-check.mjs`
- `node shots/r7-sig/probe.mjs shiba.doge|seagull.steal` (casts the skill in a race-like scene and shoots it)

## Evidence (key output lines) — all eight acceptance commands, final tree
- `TSC-OWN OK`
- feel audit + `feel-check OK` (exit 0), all twelve PASS: `shiba.doge seen 6.2→8.4 %, 3 affected, +18.3 m` ·
  `penguin.slide seen 4.9→9.5 %, +10.2 m` · `seagull.steal seen 14.6→14.6 %, 1 affected` ·
  `corgi.whistle seen 26.6→26.6 %, 3 affected, st=['wobble']`. Baseline before the change: +3.5 m / +7.6 m /
  2.3 % nothing taken / 0 affected.
- `node tools/combat-check.mjs` → `72/72 passed` (exit 0) — including `whistle slows offenders only` and
  `skill boosts keep their own clock: a short drift boost under DOGE ends on time`.
- `node tools/combat-check.mjs --soak` → `SOAK OK` (coast 64.2 s, city 73.3 / 105 s, mountain 80.5 s, console
  errors 0).
- `w2-rivals OK` · `w2-police OK` · `r6-net-det OK` · `core-check OK`; every browser run ended with `errors []`.
- Looked at: `shots/r7-sig/doge-final.jpg` (the gold bubble with the shades, 「狗头护体 3s」 + 护盾/加速 words from
  the ui-hud unit, 101 km/h on the speedo), `shots/r7-sig/steal-sheet.jpg`, and the audit sheets.

## Known issues
- The doge's face is drawn on the camera side of the bubble, so the rider's back overlaps its middle; the shades
  and the muzzle read around it.
- The warned riders of `corgi.whistle` show no status word over their heads (`wobble` has none in
  `data/status-words.ts`, it is the bump status); the caster's 「警告 ×N」 is the readout. A word for the warning
  would need a status word of its own (data/status-words.ts is content — the lead's).
- `combat-check --soak` is not deterministic run to run (the soak bot paces itself on `clock.realTime` while
  stepping manual frames): the same tree once reported `first SHOWTIME at 32.7 s (< 35 s)` and was clean on
  three other runs.
- The audit's doge gain varies with the launch value non-monotonically (1.2 → +23.8 m, 1.4 → +17.9 m,
  1.45 → +18.3 m): the cast ride's collisions with the rivals around it change with the speed. All values are
  far above the 8 m floor; 1.45 is the one that also clears it for a rider already at top speed.

## Requests
- SPEC §7 still lists the pre-r7 numbers (`shiba.doge … +15 % speed`, `penguin.slide … +25 % speed`,
  `seagull.steal (nearest ≤ 6 m: weapon or 20 SP)`, `corgi.whistle (offenders ahead ≤ 20 m: slow 1 s)`).
  Core owns SPEC; §29 describes the new behaviour. (No check needs changing any more.)
