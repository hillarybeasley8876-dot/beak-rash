# r7 job gag — the pool gag skills that are not felt (combat; SPEC §29)

The skill feel audit (`node tools/r7/feel.mjs`, SPEC §29 — two rides, CONTROL and CAST, from the same seed and
formation; `tools/r7/feel-check.mjs` holds the contract per skill) says, for the gag folder:
```
FAIL pool.boomerang  0.8 % of the screen at +0.3 s (≥ 3 %)   — the fish is small and already 10 m out by then
FAIL pool.blink      +14.6 m in 3.5 s (≥ 15 m)               — and nothing shows the jump: the camera just moves
PASS pool.thermos    but only at 70 % HP: at full HP with no debuff it does nothing at all
PASS pool.pie, pool.brainfight, pool.ducks, pool.popup, pool.warsong
```
`skillBoost` already kicks the bike now (common.ts BOOST_KICK, lead) — use it, don't change it. Read SPEC.md §24,
§29, `src/gameplay/combat/skills/gag/` (all of it), `src/gameplay/combat/visuals/` (Flyer, FlatRing, Trail, ShieldBubble
…), `src/gameplay/combat/statuses.ts` (CLEANSABLE), `src/data/skills.ts`, and `tools/r7/feel-check.mjs`.

## Build it
1. **pool.boomerang** — seen from the first instant: a fish about twice as big (it's a boomerang made of a whole
   salted fish), a white swoosh trail behind it and a glint each turn; it leaves a little slower and goes a little
   further (out 16 m) so the eye can follow it out and back; ≥ 3 % of the middle of the screen at +0.3 s.
2. **pool.blink** — 闪现 reads as a jump: 20 m up the road (same rules: never through a wall, past the line or off
   the asphalt), the speed kept; four fading afterimages of the rider along the jump (0.4 s), a flash at both ends,
   and a short `skillBoost` (0.6 s, 0.15) so the camera punches; ≥ 15 m in the audit.
3. **pool.thermos** — felt every time: the heal (30) and the cleanse stay; add a short pick-me-up (`skillBoost`
   1.5 s, 0.15 — 枸杞提神) so a cast at full HP still does something; a green goji steam swirl around the rider; a
   `skill:result` for the caster: 「+30 HP」, with the cleanse 「+30 HP · 净化 2」, at full HP 「枸杞提神」 (good).
4. Every rider a skill of yours affects gets its `skill:hit` (skillAffect / skillHit already emit it — keep it so).
5. Keep the AI fair: rivals cast these on the player too; the SP economy holds (combat-check --soak).

## Files you own
`src/gameplay/combat/skills/gag/` (all files).

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/gag/` → TSC-OWN OK
- `node tools/r7/feel.mjs --only pool.boomerang,pool.pie,pool.brainfight,pool.blink,pool.thermos,pool.ducks,pool.popup,pool.warsong --out F:/dev/beak-rash-out/r7/feel-gag && node tools/r7/feel-check.mjs --summary F:/dev/beak-rash-out/r7/feel-gag/summary.json --only pool.boomerang,pool.pie,pool.brainfight,pool.blink,pool.thermos,pool.ducks,pool.popup,pool.warsong` → feel-check OK
- `node tools/r6/skills.mjs --only gag` → r6-skills OK
- `node tools/combat-check.mjs --soak` → SOAK OK
- `node tools/r6/net-det.mjs` → r6-net-det OK
- `node tools/core-check.mjs` → core-check OK
Look at the sheets the audit writes (`F:/dev/beak-rash-out/r7/feel-gag/sheet-*.jpg`) before you report.
