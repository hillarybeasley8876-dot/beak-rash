# r7 job sig — the signature skills that are not felt (combat; SPEC §29)

The skill feel audit (`node tools/r7/feel.mjs`, SPEC §29 — read how it works: two rides, CONTROL and CAST, from the same
seed and formation; `tools/r7/feel-check.mjs` holds the contract per skill) says, for the signature skills:
```
FAIL shiba.doge     +3.5 m in 3.5 s (≥ 8 m)                — "无敌并加速": the speed is not felt (boost 0.15)
FAIL penguin.slide  +7.6 m in 3.5 s (≥ 8 m)                — boost 0.25
FAIL seagull.steal  2.3 % of the screen; nothing taken      — it took from the shiba beside it, which had nothing,
                                                              while three rivals ahead carried 40 SP and a pan
FAIL corgi.whistle  0 rivals affected (≥ 2)                 — only "offenders" (heat > 0.05 or attacked in the last
                                                              6 s) are slowed; in an ordinary race nobody is one
```
The rest of the kit (torpedo, gulp, wing, SHOWTIME, honk, chill, spin, ghost, flash) passes. `skillBoost` already
kicks the bike now (common.ts BOOST_KICK, lead) — use it, don't change it. Read SPEC.md §7, §24, §29,
`src/gameplay/combat/skills/{doge,slide,steal,whistle,common,types}.ts`, `src/gameplay/combat/visuals/` (the visuals
you may reuse: Tether, ShieldBubble, ConeWave, AuraDisc, FlatRing, Trail …), `src/gameplay/combat/statuses.ts`,
`src/data/skills.ts` (what each skill promises), `src/data/status-words.ts`, and `tools/r7/feel-check.mjs`.

## Build it
1. **shiba.doge** — 狗头保命 is felt: boost so the audit gains ≥ 8 m in 3.5 s (try 0.3 for its 3 s), the shield bubble
   unmistakable (bigger, the doge face on it), a `skill:result` 「狗头护体 3s」 (good) at the cast.
2. **penguin.slide** — ≥ 8 m (boost ≈ 0.32–0.35); the icy streak stays.
3. **seagull.steal** — MINE! always takes something from someone:
   - the victim is the nearest rider within 9 m (ahead or beside) **that has something** (a weapon, or SP ≥ 5); only
     when nobody around has anything does it fall back to the nearest one;
   - takes the weapon (as today) and up to 25 SP; when the victim has nothing, the gull still snatches its fries:
     +10 SP for the seagull out of thin air;
   - a visible snatch: the gull's grab flies from the caster to the victim and back carrying the loot (≥ 3 % of the
     middle of the screen at +0.3 s, ≥ 6 % at the peak — measure it with the audit);
   - `skill:result` for the caster: 「偷到 平底锅」 / 「偷到 25 SP」 / 「偷到薯条 +10 SP」 (good).
4. **corgi.whistle** — 哔——! warns everyone in its cone (20 m, ±35°): every rider there is slowed 25 % for 1.2 s;
   offenders (as today) are fined: 50 % for 2 s and a stop shake; `skill:result` 「警告 ×N」 or 「罚单 ×N」 when an
   offender was among them.
5. Every rider a skill of yours affects gets its `skill:hit` (skillAffect / skillHit already emit it — keep it so).
6. Keep the AI fair: rivals cast these skills on the player too. Don't make a control effect last longer than
   2 s; the pack's SP economy must hold (combat-check --soak).

## Files you own
`src/gameplay/combat/skills/doge.ts`, `slide.ts`, `steal.ts`, `whistle.ts`, `torpedo.ts`, `gulp.ts`, `wing.ts`,
`honk.ts`, `chill.ts`, `spin.ts`, `ghost.ts`, `flash.ts`, `swallow.ts` (all under `src/gameplay/combat/skills/`).

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/` → TSC-OWN OK
- `node tools/r7/feel.mjs --only pelican.torpedo,pelican.gulp,pelican.wing,goose.honk,capybara.chill,cat.spin,shiba.doge,pigeon.ghost,penguin.slide,seagull.steal,sloth.flash,corgi.whistle --out F:/dev/beak-rash-out/r7/feel-sig && node tools/r7/feel-check.mjs --summary F:/dev/beak-rash-out/r7/feel-sig/summary.json --only pelican.torpedo,pelican.gulp,pelican.wing,goose.honk,capybara.chill,cat.spin,shiba.doge,pigeon.ghost,penguin.slide,seagull.steal,sloth.flash,corgi.whistle` → feel-check OK
- `node tools/combat-check.mjs` → passed; `node tools/combat-check.mjs --soak` → SOAK OK
- `node tools/r4/w2-rivals.mjs` → w2-rivals OK; `node tools/r4/w2-police.mjs` → w2-police OK
- `node tools/r6/net-det.mjs` → r6-net-det OK (the sim stays deterministic)
- `node tools/core-check.mjs` → core-check OK
Look at the sheets the audit writes (`F:/dev/beak-rash-out/r7/feel-sig/sheet-*.jpg`) before you report.
