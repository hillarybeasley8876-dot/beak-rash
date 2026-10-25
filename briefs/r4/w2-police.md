# r4 job w2-police — Police 2.0: wanted stars, baton, backup, roadblocks, fight back, 「V我50」 (race unit)

Read SPEC.md §9 (race/police today) and §14 (Police 2.0 — your spec), §21 #3 (the bribe), §22. Contracts already in
core (do not edit core): events `police:wanted / windup / swing / roadblock / hurt / down / bribe`, `npc:strike`
(combat resolves it and answers `npc:hit` — already implemented in `src/gameplay/combat/external.ts`), `npc:say`,
`combat:bell`, `combat:obstacleHit`, `combat:swing`, `rider:obstacleHit`, `rider:crash`; WeaponId `baton` (the actors
unit has its mesh); ObstacleKind `barrier`.

## Read first
`src/gameplay/race/police.ts` (today's chase: heat, spawn, whistle, bust, knock, let-go/escape rules — keep them),
`police-chase.ts`, `police-heat.ts`, `police-view.ts` (the corgi = an actors RiderView posed from a race-owned
RiderState `st` + obstacle id 900), `src/gameplay/race/debug.ts` (`__br.race.police()` summary, `setHeat`),
`src/sim/obstacles.ts` (solid obstacles: a non-vehicle prop crashes a rider above 16 m/s relative with cause
'obstacle' and emits `rider:obstacleHit {obstacleId}` first; slower riders bounce), `src/data/roster.ts`
(POLICE_LINES). Test: `tools/r4/w2-police.mjs` (read it: it drives heat with `__br.race.setHeat`).

## Build it (split police.ts — it is ~300 lines — into small new files: wanted, baton, backup, roadblock, bribe…)
1. Wanted level W (0–3) per SPEC §14 with hysteresis on heat (≥0.5 / ≥0.75 / ≥0.95) and the event-based bumps (two
   knocks on the corgi this chase or a rival KO within 30 m of it → ≥2; a corgi down or two refused bribes → 3).
   Emit `police:wanted { riderId, level, prev }` on every change (also back to 0 on escape / let-go / bust / bribe).
2. Baton (W ≥ 2): the corgi holds the baton (`st.weapon = 'baton'`); when |ds| ≤ 1.5 m and the lateral gap is
   0.5–1.8 m it winds up: `st.action = { kind: 'heavy', side, … }` so the actors view shows the swing, emit
   `police:windup { riderId, obstacleId, side (the corgi's side of the player), pos, time: 0.45 (W3: 0.35) }`.
   When the wind-up ends emit `police:swing { …, hit }`; `hit` = player still within |ds| ≤ 1.6 m, lateral ≤ 1.9 m,
   not airborne (y < 0.5), racing; if hit emit `npc:strike { victim, obstacleId, damage: 10 (W3 14), knock: 4.2, side,
   heavy: W3, weapon: 'baton', pos, cause: 'police' }`. Cooldown 2.2 s (W3 1.6 s). Two corgis never wind up within
   0.6 s of each other. A strike that crashes the player (rider:crash cause 'police') = bust right after respawn.
3. Backup (W3): a second corgi (its own RiderState, PoliceView and obstacle id 901) sprints in ~4 s later with the
   same chase AI; it can strike, be knocked, be bribed. Both leave when the chase ends.
4. Roadblock (once per W3 chase): 220–300 m ahead of the player, not in a tunnel/bridge feature, not within 150 m of the
   finish: solid `barrier` obstacles (each ≈ 2 m wide) across the drivable width (track.bounds) except ONE gap of
   3.2 m at a seeded lane, red/white sawhorse barrier meshes + a "柯基执勤 POLICE" sign (toon + outline, race-owned,
   instanced/merged), emit `police:roadblock { riderId, s, gapX, gapWidth, pos }`. A rider crash right after
   `rider:obstacleHit` on one of these barriers = bust after respawn (police crash). Remove them 20 s after the player
   passes or when the chase ends.
5. Fight back: each corgi has 60 HP. Player swings that reach it (today's knock) deal the weapon's damage (heavy
   ×1.5) and `combat:obstacleHit` on 900/901 deals its `damage`; each hit knocks it back and emits `police:hurt
   { obstacleId, attacker, damage, hp, pos }`. At 0 HP: the corgi tumbles (pose `st` crashed with a crash info so the
   view plays its tumble), emit `police:down { obstacleId, attacker, pos }`, W → 3 (a backup arrives in 6 s if none),
   the corgi sits up and leaves after 3 s, line "柯基下班了！".
6. 「V我50」: `combat:bell` by the player with a corgi within 6 m, W 1–2, `player.coins ≥ 50`, fewer than 2 bribes this
   race → accepted: coins −50, `police:bribe { accepted: true, amount: 50 }`, line "……下不为例。", the chase ends as a
   let-go (no escape credit), heat 0.15, no new chase for 30 s. Otherwise refused (`accepted: false`), heat +0.1,
   line "这次不行！" (W3) / "小鱼干不够还想贿赂？" (< 50) / "事不过三！" (third try).
7. Lines via `npc:say` (obstacle id): wind-up "站住！", strike "警棍警告！", backup "呼叫增援！", roadblock
   "前方设卡，看你往哪跑！", down "柯基下班了！", plus the bribe lines; rate-limit (≥ 2.5 s apart per corgi).
8. Heat: tunnels cool 2× while every corgi is > 15 m behind; a thrown hit on a corgi +0.10; a rival KO within 30 m of a
   corgi +0.15.
Numbers in a tuning table; keep `__br.race.police()` working (add `wanted`, `hp`, `backup` to the summary).

## Files you own
`src/gameplay/race/police.ts`, `src/gameplay/race/police-chase.ts`, `src/gameplay/race/police-heat.ts`,
`src/gameplay/race/police-view.ts`, `src/gameplay/race/police/` (new folder for the new files), `src/data/police-lines.ts`
(new, the corgi's lines), `tools/race-scenarios/chase.mjs`.

## Acceptance (the runner runs these; read `tools/r4/w2-police.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/race/police.ts src/gameplay/race/police-chase.ts src/gameplay/race/police-heat.ts src/gameplay/race/police-view.ts src/gameplay/race/police/ src/data/police-lines.ts` → TSC-OWN OK
- `node tools/r4/w2-police.mjs` → w2-police OK
- `node tools/race-scenarios.mjs --only police,visible,outrun,koBust,selfBust` → exit 0 (today's police scenarios keep working)
- `node tools/race-soak.mjs --track city` → exit 0
- `node tools/core-check.mjs` → core-check OK
