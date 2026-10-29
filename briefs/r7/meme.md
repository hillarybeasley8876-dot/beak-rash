# r7 job meme — the meme racers' skills that are not felt (combat; SPEC §29)

The skill feel audit (`node tools/r7/feel.mjs`, SPEC §29 — two rides, CONTROL and CAST, from the same seed and
formation; `tools/r7/feel-check.mjs` holds the contract per skill) says, for the six meme skills:
```
FAIL bananacat.peel   peak 1.8 % of the screen (≥ 6 %)      — the peels land behind the rider: the camera never sees
                                                              them fall (the two riders behind did skid)
FAIL cryingcat.tears  +4.0 m in 3.5 s (≥ 6 m)               — the crying cat "speeds up": boost 0.25
FAIL xinxian.fresh    +0.9 m in 3.5 s (≥ 8 m)               — four pickups lay ahead; the player even ended with 5
                                                              fewer 小鱼干 than without the skill: vacuumed pickups
                                                              look like they are not credited as collected
FAIL hamster.violin   1.9 % of the screen at +0.3 s, 2.0 % peak — four riders were silenced and nobody could see it
PASS pedro.trash      but the prize is random and mostly invisible: the coin prize (+40 小鱼干) showed a few
                      sparkles; the weapon prize changed the hand
PASS moodeng.bounce
```
`skillBoost` already kicks the bike now (common.ts BOOST_KICK, lead) — use it, don't change it. Read SPEC.md §23,
§24, §29, `src/gameplay/combat/skills/meme/` (all of it), `src/gameplay/combat/pickups/` (vacuum, pickup:take),
`src/gameplay/combat/visuals/`, `src/data/skills.ts`, `src/data/status-words.ts`, and `tools/r7/feel-check.mjs`.

## Build it
1. **bananacat.peel** — the toss is seen: each peel flies up over the cat's head (a visible arc, about 2.5 m high)
   and back onto the road behind, so the camera sees all three go (≥ 1.5 % of the middle at +0.3 s — trap rule —
   and ≥ 6 % at the peak); peels on the road a bit bigger and brighter. Skidding stays as it is (the HUD calls a
   skid behind the player out from its `skill:hit`).
2. **cryingcat.tears** — the cat's own speed-up is felt: ≥ 6 m in the audit (boost ≈ 0.35–0.4).
3. **xinxian.fresh** — 五秒真香 is felt with and without food:
   - vacuumed pickups are collected exactly as if ridden over (coins credited, fish heal, weapons equip) — find why
     the audit lost 5 coins and fix it in the skill (or in pickups/ if the vacuum is the cause — then say so under
     Requests and keep the change minimal);
   - a base boost at the cast (0.15 for 2 s) on top of the per-bite boosts (bites 0.08 each, cap 0.4);
   - the suction is seen: pickups fly to the cat along a visible streak; `skill:result` 「吸到 N 个」 at the end
     (「一口都没吃到」 when N = 0, good: false).
   - ≥ 8 m in the audit.
4. **hamster.violin** — the sad tune is seen and felt: a big grey-blue "sad" aura on the road (its radius), notes
   swirling out to every listener, a little rain cloud over each silenced rider for the silence; the listeners also
   ride 15 % slower while it plays (so a silenced rival visibly drops back); ≥ 3 % of the middle at +0.3 s, ≥ 6 % peak.
5. **pedro.trash** — the prize is always shown: the item pops out of the bin and hangs over pedro's head for 0.6 s
   (missile can, the weapon, a 小鱼干 pile, a green stink cloud), and `skill:result` names it: 「掏到 飞弹！」,
   「掏到 <weapon name>」, 「+40 小鱼干」, 「臭气熏天！」.
6. Every rider a skill of yours affects gets its `skill:hit`.
7. Keep the AI fair: rivals cast these on the player too — no control longer than 2 s beyond today's, the SP economy
   holds (combat-check --soak).

## Files you own
`src/gameplay/combat/skills/meme/` (all files).

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/meme/` → TSC-OWN OK
- `node tools/r7/feel.mjs --only bananacat.peel,cryingcat.tears,xinxian.fresh,moodeng.bounce,pedro.trash,hamster.violin --out F:/dev/beak-rash-out/r7/feel-meme && node tools/r7/feel-check.mjs --summary F:/dev/beak-rash-out/r7/feel-meme/summary.json --only bananacat.peel,cryingcat.tears,xinxian.fresh,moodeng.bounce,pedro.trash,hamster.violin` → feel-check OK
- `node tools/r6/skills.mjs --only meme` → r6-skills OK
- `node tools/combat-check.mjs --soak` → SOAK OK
- `node tools/r6/net-det.mjs` → r6-net-det OK
- `node tools/core-check.mjs` → core-check OK
Look at the sheets the audit writes (`F:/dev/beak-rash-out/r7/feel-meme/sheet-*.jpg`) before you report.
