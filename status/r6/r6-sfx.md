# r6-sfx — every skill sounds like itself, every reaction has a sting

## Plan

1. `src/audio/sfx/skills-r6.ts` (new): `SKILL_R6_SFX` — a cast sound `skill.<id>` for all 26 r6 skills
   (6 meme sigs, 17 pool, 3 shared ults), plus `skill.<id>.hit` for the ones that hit a rider and
   `skill.<id>.end` where the end is an event (bubble pop, time-stop tape). Tuning in one table.
   Verify: `node tools/r4/tsc-own.mjs src/audio/` → TSC-OWN OK
2. Same file: `REACT_SFX` — `react.<reaction>` for the seven reactions (vaporize / melt / freeze /
   electro / superconduct / overload / swirl): a highlight, louder than a skill hit, below the KO boom.
   Verify: `node tools/audio-check.mjs --offline --only race-coast --sfx` → all audio checks passed
3. `src/audio/sfx/bank.ts`: register `SKILL_R6_SFX` + `REACT_SFX` in the bank.
   Verify: `node tools/r6/present.mjs --only audio` → r6-present OK
4. `src/audio/events-r6.ts` (new) + `src/audio/system.ts`: wire `combat:reaction` → `react.<id>` at
   the victim (never so quiet that the mix swallows it), one sting per reaction burst
   (`h.cooldown`), and the fresh one's munch on every pickup it vacuums.
   Verify: `node tools/r6/present.mjs --only audio` → r6-present OK
5. `src/audio/events-combat.ts`: `ult:start` plays the cast ult's own `skill.<id>` (never the
   pelican's SHOWTIME whoosh), `ult:impact` uses `skill.<id>.impact` → `.hit` → the pelican's;
   rate-limit the hit sounds of the skills that hit many riders at once (the ducks, the firecracker).
   Verify: `node tools/r6/present.mjs --only audio` → r6-present OK
6. Full acceptance: `node tools/r4/tsc-own.mjs src/audio/`, `node tools/r6/present.mjs --only audio`,
   `node tools/audio-check.mjs --offline --only race-coast --sfx`, `node tools/r4/w3-audio.mjs`,
   `node tools/core-check.mjs`.

## Done

- Step 1–5 done. `src/audio/sfx/skills-r6.ts` (379 lines) holds 53 r6 sounds: the cast of every
  one of the 26 r6 skills, a `.hit` for each of the 21 that hit a rider, `.end` for the bubble pop
  and the time stop's tape, and the seven reaction stings (`REACT_SFX`).
- `bank.ts` registers both; `events-r6.ts` (new, wired in `system.ts` next to `wireCombat`) plays
  `react.<id>` at the victim (min gain 0.6 so the mix cannot swallow it) and the fresh one's munch
  on every pickup it vacuums in; `events-combat.ts` gives every ult its own cast / impact sound and
  rate-limits the hit sounds of the pack-hitting skills.
- Loudness: every new sound sits between -6.6 and -18 dBFS (the old skill sounds: -8 … -14, the KO
  boom: -3.8), so a reaction is louder than a skill hit and never louder than the KO.
- Probes (mine, under `shots/r6-sfx/`): `peaks.mjs` (the peak / rms / clicks of every new sound
  next to the old ones) and `race-probe.mjs` (the bubble pop, the time stop's tape, the fresh
  munch and the duck army's bumps in a live race).

## In progress / next

- Nothing. All five acceptance commands pass.

## How to test (exact commands)

```
node tools/r4/tsc-own.mjs src/audio/            # → TSC-OWN OK
node tools/r6/present.mjs --only audio          # → r6-present OK
node tools/audio-check.mjs --offline --only race-coast --sfx   # → all audio checks passed
node tools/r4/w3-audio.mjs                      # → w3-audio OK
node tools/core-check.mjs                       # → core-check OK
node shots/r6-sfx/peaks.mjs                     # the new sounds' peaks vs the old ones
node shots/r6-sfx/race-probe.mjs                # the '.end' sounds / munch / duck rate limit
```

## Evidence (key output lines)

- `node tools/r6/present.mjs --only audio`
  - `PASS every skill has its own cast sound 'skill.<id>' in the sfx bank (39 of 39; missing: )`
  - `PASS every reaction has a sting 'react.<id>' in the sfx bank (missing: none)`
  - `PASS cast in a race … "ults":{"ult.meteor":{"own":true,"pelican":false,…},"ult.storm":{…},"ult.timestop":{…}}`
  - `PASS each reaction plays its sting react.<id> (silent: none)` → `r6-present OK`
- `node tools/audio-check.mjs --offline --only race-coast --sfx` → `sfx rendered: 188, failing: 0`
  → `all audio checks passed` (no peak over -1 dBFS, no clipping, no clicks)
- `node shots/r6-sfx/peaks.mjs`: the new sounds run -6.6 … -18 dBFS (e.g. `skill.pool.warsong -6.59`,
  `react.vaporize -6.52`, `skill.pool.tornado -12.21`) against the old `skill.shiba.doge -8.4` and
  `ko.boom -3.76`; `clicks 0, clipped 0` on every one.
- `node shots/r6-sfx/race-probe.mjs` → `{ bubbleEnd: true, timestopEnd: true, timestopCast: true,
  freshMunch: 1, duckHits: 3, duckCast: true }`, `console errors: none`
- `node tools/r4/tsc-own.mjs src/audio/` → `TSC-OWN OK`; `node tools/r4/w3-audio.mjs` → `w3-audio OK`;
  `node tools/core-check.mjs` → `core-check OK`.

## Known issues

- The hit-sound rate limit uses the host's real-time cooldown, so a hit sound is skipped when the
  same skill hits twice inside the gap (the ducks: 0.2 s, the firecracker string: 0.2 s). In the
  manual-step probes the sim runs faster than real time, so the limit bites harder there than in a
  race.
- The r6 pool / ult sounds are not in `PREWARM_RACE` (the pool skills belong to no character, so
  `raceSounds` does not pick them up): their first play in a race is synthesised live and cached
  afterwards. Left alone on purpose — pre-warming ~50 more sounds would eat the 160 s cache budget
  the other cues need.

## Requests

- (none yet)
