# r6 job net-sim — one race on every client: the sim stops depending on the local player (race + combat; SPEC §28)

Online rooms (SPEC §28) are deterministic lockstep: every client runs the whole race from the same RaceConfig and
the same per-tick inputs, and must compute the same state. Core is ready (read `src/core/session.ts`: `tick()`,
`humans`, `hash()`; `src/core/contracts.ts`: `RaceConfig.online`, `Session.humans`, `RaceLogic.takeover`;
`src/core/race-config.ts onlineRaceConfig`; `src/core/game.ts` frame loop). The rest of the sim still treats "the
player" as special, and in an online race every client has a different local player: `isPlayer` and `session.player`
are this client's rider (camera, HUD, audio, achievements). Measured (`node tools/r6/net-det.mjs`): three clients of
one race differ from the very first hash — race logic re-grids around `session.player` (grid.ts), and every later
"player" rule (AI pace, hunting, traffic, events, standings …) splits them further.

Read SPEC.md §28 (the determinism contract and the online race rules), then every file listed below.

## The rule
In an online race (`session.config.online` set) no sim code — `src/gameplay/race/**`, `src/gameplay/combat/**`,
`src/sim/**` — reads `isPlayer`, `session.player`, the camera (`app.rig`), the clock's real time / scale, the local
input (`app.input`) or the save. Offline (`config.online` unset) the game plays exactly as today: there `humans` is
`[player]`, so writing the rules in terms of the humans changes nothing offline.
- **"Not AI-controlled"** → `r.human` (true for every human of an online race; offline = the player).
- **"The player" in a rule** → the humans: a rule about one rival and the player uses that rival's NEAREST human
  (smallest |Δs|, ties → lower id; a helper in `race/ctx.ts` or `race/humans.ts`); a rule about the race as a whole
  uses the leading or the trailing human as stated below.
- Police, secrets, STYLE and nemesis/alliances do not run online (core sets `police: false`, `nemesis: null` and does
  not attach style/secrets): guard the alliance/rivalry code with `!config.online` instead of generalising it.

## Build it (file by file — `grep -n "isPlayer\|session.player\|\.player\b\|app.rig\|clock\.\|app.input\|save.data"`)
- `race/grid.ts`: the qualifying order around the player → around the humans (online: the humans keep the middle
  slots core gave them; the bully rule keeps the most aggressive rival off every human's neighbouring slots).
- `race/flow.ts`: online — no intro flyby and no skip-by-key: the countdown starts at tick 0 (the intro camera does not
  run, `intro-camera.ts`); the race ends when every human has finished, or 45 s (FINISH_GRACE_MS) after the first
  human did — at the same tick on every client; `race:end` once. Offline unchanged.
- `race/ai/index.ts`, `ai/brain.ts`, `ai/pace.ts`, `ai/fight.ts`, `ai/skill-rules.ts`, `ai/taunts.ts`, `ai/form.ts`,
  `ai/throw.ts`, `ai/blunder.ts`: brains for every rider that is not human (and for a human after the finish, as the
  player's today); `takeover(id)` = a human left: give its rider a brain from that tick on (implement
  `RaceLogic.takeover` in `logic.ts`). Pace / rubber band / payback / fairness (calm start, the hunt token, the hit
  budget, grudges) per human: each AI against its nearest human; the hunt token is per human. `chaseCam` /
  `app.rig.mode === 'chase'` → `true` online. Taunts: their choices must not differ between clients (base them on
  the humans, or keep them presentation-only with their own cosmetic rng — never `session.rng` from a local decision).
- `race/traffic/index.ts`: spawn / despawn around every human (each human's spawn band; one shared budget).
- `race/events/*`: an event arms / starts when the LEADING human comes within its distances and ends when the
  TRAILING human is past it.
- `race/standings.ts`, `race/results.ts`, `race/logic.ts`, `race/spectate.ts`: places for everyone; the hysteresis
  around the player → around each human; results mark `isPlayer` (presentation, fine) — the saved stats stay this
  client's.
- `combat/melee.ts`: the heavy-swing tell near the player → near any human. `combat/armory.ts`: the humans start with
  bare wings. `combat/skills/runner.ts`: online, never hold a cast for a KO cinematic (`clock.realTime`): the
  cinematics are presentation. `combat/feedback.ts`: hit-stop may stay (presentation; the online loop ignores the
  clock) but must not change sim state. `combat/pickups/pickups.ts sync()` is presentation (fine).
- Module state: no counter or cache in module scope that survives into the next race (`grep -n "^let "`).
- Anything else `tools/r6/net-det.mjs` shows: it reports the first tick whose hash differs. To find the culprit,
  compare two clients' riders and obstacles at that tick (`shots/r6-net-sim/` probes; `window.__br.session()`).

## Files you own
`src/gameplay/race/` (except `src/gameplay/race/police/`, `police.ts`, `police-*.ts`), `src/gameplay/combat/`,
`src/sim/`.

## Acceptance (the runner runs these; read `tools/r6/net-det.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/ src/sim/` → TSC-OWN OK
- `node tools/r6/net-det.mjs` → r6-net-det OK (three clients, two engines, three qualities, two frame cadences: the
  same hash every 60 ticks for 3000 ticks; a human leaving mid-race is an AI rider afterwards)
- `node tools/race-scenarios.mjs` → every check passed
- `node tools/race-soak.mjs --track coast` → SOAK OK; `node tools/race-soak.mjs --track city` → SOAK OK
- `node tools/combat-check.mjs` → passed; `node tools/combat-check.mjs --soak` → SOAK OK
- `node tools/r4/w2-rivals.mjs` → w2-rivals OK; `node tools/r4/w2-events.mjs` → w2-events OK
- `node tools/r6/skills.mjs --only ai` → r6-skills OK
- `node tools/core-check.mjs` → core-check OK
