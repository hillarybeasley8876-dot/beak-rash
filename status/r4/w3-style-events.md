# w3-style-events — STYLE for the roadblock gap, the goose flock and the fruit stalls (§17)

## Plan
1. Read SPEC §14/§17/§19, `src/core/events-map.ts`, `src/gameplay/style/*`, the emitters
   (`race/police/field.ts`, `race/police/roadblock.ts`, `race/events/geese.ts`, `race/events/stalls.ts`) and
   `tools/r4/w3-style-events.mjs`. Verify: read them all before touching code.
2. Tuning: `POINTS`/`LABEL` gain `roadblock 150 冲卡`, `geese 120 鹅群穿行`, `stall 100 砸摊`; the ranges
   (honk 6 m, stall 8 m, 40 m past a flock, flock match 40 m) go into a new `SPOT` table.
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/style/` → TSC-OWN OK.
3. New `src/gameplay/style/track-events.ts`: remembers the roadblocks (`police:roadblock`), the flocks
   (`race:event` geese / start) and the smashed stalls (`npc:say` of a 'stall'); the crossings are checked
   in `update()` (the player passes the gap, the player rides 40 m past the flock).
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/style/` → TSC-OWN OK.
4. `src/gameplay/style/index.ts` wires it: the new listeners join `listen()`, `update()` also runs the
   crossing checks, `attach()`/`detach()` forget the spots.
   Verify: `node tools/r4/tsc-own.mjs src/gameplay/style/` → TSC-OWN OK.
5. Acceptance: `node tools/r4/w3-style-events.mjs` → w3-style-events OK; `node tools/r4/w1-style.mjs` →
   w1-style OK; `node tools/core-check.mjs` → core-check OK.

## Done
- `src/gameplay/style/tuning.ts`: `POINTS.roadblock 150 / geese 120 / stall 100`, `LABEL.roadblock 冲卡 /
  geese 鹅群穿行 / stall 砸摊`, `FixedKind` grows the three kinds, and the new `SPOT` table holds the
  distances (honk 6 m, stall 8 m, 40 m past a flock, a honk belongs to the flock within 40 m).
- `src/gameplay/style/track-events.ts` (new): the three set pieces of the road.
  - `police:roadblock` (the player's own block) is remembered; the first frame the player is past its `s`
    it scores `roadblock 150` when it is racing and `|x − gapX| ≤ gapWidth / 2` (i.e. through the gap).
    A crash into the barriers scores nothing.
  - `race:event {kind:'geese', phase:'start'}` remembers the flock spot; a `traffic:honk` of a 'goose'
    obstacle within 6 m of the player spoils that flock; 40 m past the spot the flock scores `geese 120`.
  - `npc:say` of a 'stall' obstacle within 8 m of the player scores `stall 100`, once per stall.
  - The spots are forgotten on attach/detach (race end) and spent spots are dropped when they are passed.
- `src/gameplay/style/index.ts`: the new listeners, the per-frame crossing check and the reset on detach.
- Probes (mine, in `shots/r4-w3-style-events/`): `probe-drift.mjs` (the player's x does not drift on the
  coast road, so the gap check is exact), `probe-real.mjs` (a forced geese event and a forced market stall,
  both created by the race unit, score 120 / 100 in the real game), `probe-touch.mjs` (riding into the geese
  honks six geese and gives no flock bonus), `probe-hud.mjs` (the HUD flies the Chinese label in).

## In progress / next
- Nothing left in this job; the acceptance is green.

## How to test (exact commands)
```
node tools/r4/tsc-own.mjs src/gameplay/style/   # TSC-OWN OK
node tools/r4/w3-style-events.mjs               # w3-style-events OK
node tools/r4/w1-style.mjs                      # w1-style OK
node tools/core-check.mjs                       # core-check OK
node shots/r4-w3-style-events/probe-real.mjs    # the real in-game path (geese 120, stall 100)
node shots/r4-w3-style-events/probe-touch.mjs   # a touched goose spoils the flock
```

## Evidence (key output lines)
```
$ node tools/r4/tsc-own.mjs src/gameplay/style/
TSC-OWN OK

$ node tools/r4/w3-style-events.mjs
PASS threading the roadblock's gap scores roadblock 150 (roadblock:150)
PASS passing outside the gap scores nothing (none)
PASS riding through the goose flock untouched scores geese 120 (geese:120)
PASS a goose the player touched (it honks at the player) — no flock bonus (none)
PASS smashing a fruit stall scores stall 100 (stall:100)
PASS a stall smashed 300 m away (a rival did it) scores nothing (none)
PASS style events: no console errors ()
w3-style-events OK

$ node tools/r4/w1-style.mjs
PASS style: no console errors ()
w1-style OK

$ node tools/core-check.mjs
PASS pad: d-pad left steers left (steer=-1.00, dx=-6.51)
core-check OK

$ node shots/r4-w3-style-events/probe-real.mjs
geese {"at":130,"s":192.6,"ev":[{"riderId":0,"action":"geese","label":"鹅群穿行","points":120,"total":120,"mult":1,"count":1,"at":170.10779027629533}]}
stall {"at":312.59,...,"ev":[{"riderId":0,"action":"stall","label":"砸摊","points":100,...,"at":311.5988024407639},{"say":"我的西瓜！",...}]}
errors 0 []

$ node shots/r4-w3-style-events/probe-touch.mjs
touch {"at":120,"s":166.3,...,"ev":[{"honk":5000,...},...,{"honk":5005,...}]}   # no 'geese' action
errors 0 []
```
(The flock scored exactly 40 m past the flock spot 130 → 170.1.)

## Known issues
- none

## Requests
- none
