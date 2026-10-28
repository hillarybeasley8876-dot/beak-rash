# r6-animals — the six meme racers' animal calls

## Plan
1. Read SPEC §1–§4/§11/§13/§23, kit.ts, animals.ts, bank.ts, barks.ts, tools/r6/animals.mjs. Proof: baseline
   `node tools/r6/animals.mjs` → FAILED (2), missing bananacat cryingcat xinxian moodeng pedro hamster. ✓
2. Write `shots/r6-animals/probe.mjs` (offline render of every `animal.*` → peak/rms/dur/20 ms envelope + wav).
   Proof: probe prints a row per existing call. ✓ (10 rows, peaks −9.9…−14.8 dBFS)
3. Add the six calls to `src/audio/sfx/animals.ts`. Proof: `tsc-own` OK + `tools/r6/animals.mjs` OK. ✓
4. Tune levels/shape from the probe: 3 rounds. Proof: probe rows, peaks now in the existing band. ✓
5. Full acceptance. ✓

## Done
- Six `ANIMAL_SFX` entries in `src/audio/sfx/animals.ts` (bananacat, cryingcat, xinxian, moodeng, pedro,
  hamster), built only from the existing kit primitives (`call`/`hiss`/`tone`/`span`/`pulseWave`). No new
  helper → `src/audio/sfx/kit.ts` untouched.
- Scratch probes under `shots/r6-animals/`: `probe.mjs` (offline render → peak/rms/dur/envelope + wav),
  `pitch.mjs` (autocorrelation f0 per 40 ms of each wav), `game-probe.mjs` (live race, plays all six, checks
  `unknown sfx` / console).

## In progress / next
- Nothing. Job complete.

## How to test (exact commands)
- `node tools/r6/animals.mjs` → r6-animals OK
- `node tools/r4/tsc-own.mjs src/audio/` → TSC-OWN OK
- `node tools/audio-check.mjs --offline` → all audio checks passed
- `node tools/audio-check.mjs --game` → all audio checks passed
- `node tools/core-check.mjs` → core-check OK
- `node shots/r6-animals/probe.mjs` (renders + writes `shots/r6-animals/<id>.wav`)
- `node shots/r6-animals/pitch.mjs` (f0 track per call)

## Evidence (key output lines)
- baseline: `FAIL every racer has an animal call (missing: bananacat 香蕉猫, cryingcat 泪眼猫猫, xinxian 新鲜哥,
  moodeng 弹跳猪, pedro 佩德罗, hamster 悲伤仓鼠)` → after: `PASS every racer has an animal call (missing: none)`,
  `PASS the six meme calls are six different sounds`, `r6-animals OK`.
- `TSC-OWN OK`.
- `node tools/audio-check.mjs --offline` → `sfx rendered: 194, failing: 0` / `all audio checks passed`.
- `node tools/audio-check.mjs --game` → `ok pack burst: 10 weapons, 0 unknown-sound warnings` /
  `all audio checks passed` (first run failed only `start: first race: A on GO (A starts [-0.033] s from GO)`,
  the known timing flake; re-run passed).
- `node tools/core-check.mjs` → `core-check OK`.
- Rendered levels (peak dBFS / dur), the six new calls vs the existing ones (existing band −9.9…−14.8):
  `animal.bananacat −9.9 0.66s · animal.cryingcat −11.1 0.52s · animal.xinxian −12.3 0.35s ·
   animal.moodeng −9.5 0.35s · animal.pedro −13.2 0.41s · animal.hamster −10.5 0.41s` — all ≤ 0.8 s,
  `jumps 0` (no discontinuities) on every call.
- Envelopes (20 ms windows, 0–9 of peak) — each call has its own shape:
  bananacat `345567886557899633223565203455431` (rise, sob, sag) ·
  cryingcat `13557734789943588788520111` (wobble, then the sniff tail) ·
  xinxian `243116955555555541` (chirp, gap, meow) ·
  moodeng `210000029988787752` (snort, gap, grunt) ·
  pedro `336520008595200187931` (three trills) ·
  hamster `68984000686410013321` (three squeaks, each softer).
- f0 tracks (Hz per 40 ms, autocorrelation): bananacat `421 471 533 582 615 667 696 727 780 800 780 744 744 627
  571 508` (rising, then the sob falls) · cryingcat `593 627 615 542 604 604 525 571 582 533 500` (wobble) ·
  xinxian `970 970 542 604 615 615 571 508` (chirp ~1 kHz, then a lower+quicker meow than `animal.cat`'s
  667–800) · moodeng `1231 … 206 221 200 180` (nasal squeak → low wet grunt) · pedro `2462 1103 …` ×3
  (trill = pitch flipping) · hamster `2462 2462 2133 … 2286 2133 1778 … 1882 1778` (falling).
- Live race (`game-probe.mjs`): `trace ["animal.bananacat","animal.cryingcat","animal.xinxian",
  "animal.moodeng","animal.pedro","animal.hamster"]`, `errors []`, no `unknown sfx` in the logs.

## Known issues
- `audio-check --game`'s "A on GO" timing missed by 33 ms on one run (the machine was at 100 % busy) and
  passed on the re-run — the flake the brief describes, unrelated to this change.

## Requests
- (none)
