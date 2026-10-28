# r6 net-sim — one race on every client (SPEC §28)

The sim no longer depends on the local player: in an online race every rule that talked about "the player"
talks about a **human** (offline the player, online every member of the room). The race is the same race on
every client — same hash, same tick, same end.

## Plan

1. **`race/humans.ts` (new)** — the sim's "the player": `nearestHuman` (smallest |Δs|, ties → the lower id),
   `leadingHuman`, `trailingHuman`, `humanNear`. Verify: `node tools/r4/tsc-own.mjs src/gameplay/ src/sim/`.
2. **`race/ctx.ts`** — `WorkZone` (the shared shape), `firstHumanFinish`, `online`. Verify: tsc.
3. **`race/ai/form.ts`** — form for the AI riders only (the humans are the yardstick, not rivals). Verify: tsc.
4. **`race/grid.ts`** — the humans keep the middle slots; the bully stays off every human's neighbouring slots.
5. **`race/flow.ts`** — online: no intro flyby, no skip key, the countdown at tick 0, the race ends when every
   human finished or 45 s (FINISH_GRACE_MS) after the first one did.
6. **`race/standings.ts`** — the pass hysteresis around each human, the final stretch per human.
7. **`race/ai/*`** — brains for every non-human (+ a human after its finish), pace / rubber band / payback /
   fairness per human, a hunt token per human, the taunts from the humans.
8. **`race/logic.ts`** — `takeover(id)` (a human left → an AI rides it).
9. **`race/traffic/index.ts`** — spawn / despawn around every human, one shared budget.
10. **`race/events/*`** — an event arms with the LEADING human and ends with the TRAILING human.
11. **`race/rivals/*`** — no nemesis, no alliance, no rivalry online.
12. **`combat/*`** — the heavy tell near any human, the humans start bare, the hit-stop reads the humans,
    no cast is ever held for a KO cinematic online.
13. **Acceptance** — the eleven commands below.

## Done

- **`race/humans.ts` (new)** — `nearestHuman(session, r)`, `leadingHuman`, `trailingHuman`, `leadingS`,
  `trailingS`, `humanNear`. The one place that says what "the player" means to the sim.
- **`race/ctx.ts`** — `WorkZone` (the open lane of a work zone), `firstHumanFinish` (the online grace clock),
  `online`.
- **`race/grid.ts`** — the rivals are the non-human riders; the humans take the middle slots (online: the
  block core gave them, `min(3, aiCount)` AI rows ahead of it), offline the player keeps slot 4. The bully
  (the most aggressive rival) is swapped out of the neighbouring slots of **every** human.
- **`race/flow.ts`** — online: the phase is `countdown` from tick 0 (no flyby, no skip key — the local input
  is not even subscribed), and the race ends when every human has finished or 45 s after the first human
  did (`FINISH_GRACE_MS`), on the same tick on every client, `race:end` once. Offline is untouched.
- **`race/standings.ts`** — the hysteresis is per human (`human → rider → +1/−1`), so no human's place
  wobbles; the final stretch is announced for every human. Human vs human passes count too.
- **`race/ai/*`** —
  - `form.ts`: today's form is rolled for the AI riders only (the same dice on every client).
  - `fight.ts`: the fairness rules work per human — the calm start, the hit budget (per human), the grudge,
    the heavy share and **a hunt token per human** (`HuntTokens = Map<RiderId, HuntToken>`), so one rider
    hunts one human at a time, not one rider per race.
  - `pace.ts` / `brain.ts` / `index.ts`: the rubber band, the payback chase, the chase camera
    (`true` online) and the bell work against the rider's **nearest human**; `SkillView.player` became
    `SkillView.human`; the brain drives every non-human rider and a human after its finish.
  - `taunts.ts`: the lines are chosen from the humans (never the local rider), so every client hears the
    same chatter; only the AI riders talk.
- **`race/logic.ts`** — `takeover(id)`: a human left → its rider gets a brain from that tick on (a clean
  slate: no plan, no hunt, no grudge), and the hunt token of that human is free again.
- **`race/traffic/index.ts`** — every human has its own spawn band (the vehicles spawn in turn, one per
  human) and a vehicle is only despawned when it is out of **every** human's band; the budget of vehicles
  stays shared.
- **`race/events/*`** — an event arms and starts with the **leading** human and its props are done when
  the **trailing** human has passed them (the fish truck stops in the leading human's lane).
- **`race/rivals/index.ts`** — an online race has no nemesis, no alliance and no rivalry (they read the
  local player's grudge); the guard is `ctx.online`, not a generalisation.
- **`combat/*`** — the heavy tell is shown when a human is close enough to read it; the humans start with
  bare wings; the hit-stop / camera shake are scaled by the distance to the nearest human (the local
  player is one of them, so the local feel is unchanged); an online race never holds a cast for a KO
  cinematic (the cinematic is presentation and its real-time clock would split the clients).
- **Drive-by fix (a dead end that made the race-soak fail):** an AI rider could ride into a hole in a
  work zone's wall (a piece held back by a car) and get wedged in a closed lane for good — the city soak
  failed on it ("rider 1 (capybara) stuck at s=1147"). The event director now tells the AI about the zone
  when the zone is **announced** (`roadworksLane` → `ai.setZone`), and the brain keeps its racing line but
  never leaves the open lane. The closed side of a work zone is a dead end; the AI stays out of it.

## In progress / next

Nothing — the whole acceptance is green.

## How to test (exact commands)

    node tools/r4/tsc-own.mjs src/gameplay/ src/sim/     # → TSC-OWN OK
    node tools/r6/net-det.mjs                            # → r6-net-det OK
    node tools/race-scenarios.mjs                        # → 62/62 checks passed
    node tools/race-soak.mjs --track coast               # → SOAK OK
    node tools/race-soak.mjs --track city                # → SOAK OK
    node tools/combat-check.mjs                          # → 72/72 passed
    node tools/combat-check.mjs --soak                   # → SOAK OK
    node tools/r4/w2-rivals.mjs                          # → w2-rivals OK
    node tools/r4/w2-events.mjs                          # → w2-events OK
    node tools/r6/skills.mjs --only ai                   # → r6-skills OK
    node tools/core-check.mjs                            # → core-check OK

Probes (mine, under `shots/r6-net-sim/`, not part of the acceptance):

    node shots/r6-net-sim/det-probe.mjs --ticks 600    # three clients, a full state dump every 60 ticks
    node shots/r6-net-sim/stuck-probe.mjs --track city --seed 2   # why a rider is slow (the AI state)
    node shots/r6-net-sim/trace-rider.mjs --track city --seed 2 --rider 1 --from 40 --to 70

## Evidence (key output lines)

- `node tools/r6/net-det.mjs` → **`r6-net-det OK`**: "the online race runs 3000 ticks (50 hashes, phase
  racing)", "another human's client at low quality, rendering every other tick, computes the same race
  (first different hash after tick null)", "a WebKit client computes the same race as Chromium (first
  different hash after tick null)", "each client rides its own human (session.player 0 / 2 / 1)", "the human
  who left at tick 1500 is an AI rider afterwards on every client (humans [0,1])".
- `node tools/race-soak.mjs --track city` → **SOAK OK** (before the work-zone fix: "FAIL [seed 2] rider 1
  (capybara) stuck at s=1147" — the rider was wedged between two barrier pieces of the closed lane, its
  throttle at 1 and its speed at 0 for 5.5 s).
- `node tools/race-soak.mjs --track coast` → **SOAK OK**; `node tools/race-scenarios.mjs` → 62/62;
  `node tools/combat-check.mjs` → 72/72; `node tools/combat-check.mjs --soak` → SOAK OK;
  `node tools/r4/w2-rivals.mjs` → w2-rivals OK; `node tools/r4/w2-events.mjs` → w2-events OK;
  `node tools/r6/skills.mjs --only ai` → r6-skills OK; `node tools/core-check.mjs` → core-check OK;
  `node tools/r4/tsc-own.mjs src/gameplay/ src/sim/` → TSC-OWN OK.
- The determinism probe (`shots/r6-net-sim/det-probe.mjs --ticks 600`) dumps the whole sim state every 60
  ticks of all three clients: "chromium-high vs chromium-low: identical for 10 snapshots" and
  "chromium-high vs webkit: identical for 10 snapshots".

## Known issues

- **The determinism of the engines still leans on `src/net/detmath.ts` being installed at boot** (the
  net-math job's request): the port is written and green, but nothing calls `installDetMath()` yet — the
  net client (`src/net/`) is still the stub. The three clients of `net-det` agreed over 3000 ticks without
  it, but a `Math.sin`/`Math.hypot` that differs in the last bit between V8 and JavaScriptCore can still
  split them (the port is the fix).
- The work zone's open lane is now the AI's line inside the zone: the AI riders queue up in the chicane
  instead of spreading out over the racing line. That is the intended reading of the zone, but it changes
  the field's shape a little (the coast and city soaks are green with it).
- The offline race is unchanged in behaviour (the humans are `[player]` there), but not bit-for-bit
  identical to the old build: the AI's rng order is the same, yet the taunt/hunt bookkeeping now runs
  through the human maps. The offline acceptance (soaks, scenarios, w2-*) is green.

## Requests

- **`src/net/`: call `installDetMath()` once at boot** (before the first simulation step). The port is
  ready (`src/net/detmath.ts`, `node tools/r6/detmath.mjs` → r6-detmath OK); without it a last-bit
  difference in `Math.sin` / `Math.hypot` between V8 and JavaScriptCore can split two clients of the same
  online race. (This is the net-math job's own request; the net client owns the boot.)
- **`src/gameplay/race/police/roadblock.ts`: the police's roadblock may go up inside a rider.** The soak's
  "traffic spawned inside riders" check tripped on it once (ids 8014/8015: the barriers of the roadblock
  appeared 0.7 m in front of rider 1, inside its gap). `placeRoadblock` picks `player.s + ahead` and never
  looks at the riders; the events do the same job with `spotFree` (`src/gameplay/race/events/spot.ts`).
  The file is not mine, so I did not touch it — it is a one-line check plus the existing retry loop.
