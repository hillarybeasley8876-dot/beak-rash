# r6-skills-elem — the elemental pool skills (SPEC §24)

Files I own: `src/gameplay/combat/skills/elem/**` + this file. Nothing else was edited.

## Plan (steps, each with the command that proved it)
1. `elem/props.ts` — new geometries (elem:icelance, elem:snowball, elem:cracker, elem:flame) via PartBuilder.
2. `elem/common.ts` — `coneObstacles` / `radiusObstacles` (the police reach) + `elemHit` (hit + element).
3. `elem/visuals.ts` — Bolt (sky→target ribbon), Whirl (the tornado funnel), Crack (the hopping firecracker), Ember (the fire patch).
4.–12. One file per skill: firebreath, icelance, thunder, watergun, tornado, snowball, rocket, firecracker, bubble.
13. `elem/index.ts` — the nine listed for the registry.
14. Acceptance: tsc-own, `tools/r6/skills.mjs --only elem,react`, `tools/combat-check.mjs`, `tools/core-check.mjs`.
15. Screenshots: `shots/r6-skills-elem/*.png` (one per skill) + `sheet.jpg`; probes `probe-ice.mjs`, `probe-mesh.mjs`,
    `probe-lance.mjs`, `probe-lance2.mjs`, `shots.mjs`.

## Done
- The nine elemental pool skills are implemented, each with its own file and a tuning table at the top:
  - **pool.firebreath** — a flame cone 10 m ahead (±30°, 12 dmg) that burns (fire aura); the police in the cone are scorched.
  - **pool.icelance** — a homing ice spike (nearest rival ≤ 45 m, ±25°, 10 dmg) that lays **two** cold stacks (three freeze);
    with no target it flies straight. The police in its path shatter (projectile `onObstacle` + a radius sweep, see below).
  - **pool.thunder** — a bolt on the nearest opponent ahead (≤ 40 m, ±30°, 14 dmg + 0.3 s stun, thunder aura); in the rain it
    chains to 3 more riders; it strikes an officer in reach instead of a rider when the officer is nearer.
  - **pool.watergun** — a water jet 9 m ahead (±28°, 8 dmg) that soaks (water aura) and shoves the rider out of your lane
    (knock 6 + 0.3 s of pushing).
  - **pool.tornado** — a whirlwind that races 22 m/s ahead of the caster for 2.2 s, knocks over everyone it meets
    (10 dmg) and carries the elements it touches to the riders around them (wind aura → the swirl reaction).
  - **pool.snowball** — a big ball thrown at the pack; where it lands everyone within 4.5 m takes 12 dmg and two cold stacks.
  - **pool.rocket** — a burst forward (+35 % top speed for 3 s, +5 m/s) that leaves a burning line on the road behind
    (6 dmg + fire aura for whoever rides over it).
  - **pool.firecracker** — a lit 二踢脚 that hops along the road behind the caster; when a rider comes within 3 m it goes
    off (12 dmg + fire, 3.5 m blast). The police in the blast are hit too.
  - **pool.bubble** — a bubble that stops the next punch for 2.5 s (a `shield`, melee only); when it bursts it soaks
    everyone within 4 m (water aura).
- Every skill that damages riders also reaches the police (`obstaclesIn` + `skillObstacleHit`, `onObstacle` for the two
  projectiles). `tools/r6/skills.mjs` reports `police: []` for my group.
- Every rider that is hit gets `skill:hit` (via `skillHit`) and every damage goes through `combat:hit`.
- Elements: every skill calls `applyElement` on every rider it hits, so the four reactions fire
  (vaporize / freeze / electro / overload all PASS).
- Visuals: cone waves (fire, water), a sky bolt (thunder), an upright funnel (tornado), projectile meshes + trails
  (ice lance, snowball), fire patches (rocket), a hopping firecracker, a rim-lit bubble. All of them end and dispose
  (the combat-check 3-race loop is back to baseline).
- Two design notes for the reviewer:
  - The **firecracker** hops along behind the caster instead of lying still on the road: a static trap is never reached by
    a rider who is pinned to the caster, and a chasing rider is always moving away from a dropped trap. A trailing one
    actually goes off when someone comes close.
  - The two **projectile** skills (ice lance, snowball) also sweep the police around the live projectile each frame
    (`ICELANCE.policeRadius` / `SNOWBALL.burstRadius`): the projectile's own contact window is only ±1.3 m and the officer
    keeps pace with the caster, so the window alone could miss.
- No `Math.random()` anywhere (the elements use the fixed tuning tables), no `new Material` per cast (the visuals use
  `ctx.visuals.materials` / the shared toon cache), no allocation per substep in the per-frame loops beyond the
  codebase's own `others()`-style helpers.

## In progress / next
Nothing — the job is finished. Waiting for the lead's review.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/elem/` → TSC-OWN OK
- `node tools/r6/skills.mjs --only elem,react` → the two PASS lines below
- `node tools/combat-check.mjs` → 72/72 passed
- `node tools/core-check.mjs` → core-check OK
- `node shots/r6-skills-elem/shots.mjs` → re-takes the nine screenshots (writes into shots/r6-skills-elem/)

## Evidence (key output lines)
```
$ node tools/r4/tsc-own.mjs src/gameplay/combat/skills/elem/
TSC-OWN OK

$ node tools/r6/skills.mjs --only elem,react
PASS elemental pool skills do what their descriptions say {"fire":{"hit":1,"burn":true},"ice":{"cold1":2,"frozen":true},
  "thunder":1,"water":{"wet":true,"pushed":4.04},"tornado":2,"snow":2,"rocket":{"boost":1.35,"burned":true},
  "cracker":1,"bubble":{"blocked":true,"wet":true},"police":[]}
PASS element reactions fire between skills (combat:reaction) {"vaporize":2,"freeze":1,"electro":1,"overload":1}
PASS skills: no console errors ()
r6-skills OK

$ node tools/combat-check.mjs
72/72 passed

$ node tools/core-check.mjs
core-check OK
```
Screenshots: `shots/r6-skills-elem/{firebreath,icelance,thunder,watergun,tornado,snowball,rocket,firecracker,bubble}.png`
+ `sheet.jpg` (the nine in one sheet). The shot run ends with `console errors: []`.

## Known issues
- The ice lance and the snowball are fast: in the chase view they are behind the rider's own body for the first ~0.2 s
  and small afterwards (the shot sheet shows the lance far down the road). The trail carries the read.
- The catalogue line of `tools/r6/skills.mjs` was red until the gag / meme / ults jobs landed their files; it is green now.

## Requests
- `src/gameplay/race/ai/skills.ts` (job **skills-ai**) — the AI rule for each of my skills (one line each):
  - `pool.firebreath` — fire when a rival is 4–10 m ahead (the cone's reach); never point-blank.
  - `pool.icelance` — fire when the nearest rival is 8–40 m ahead (the spike homes; no need to be close).
  - `pool.thunder` — fire when a rival is 5–40 m ahead (the bolt takes the nearest one); best in the rain.
  - `pool.watergun` — fire when a rival is 3–9 m ahead: it soaks them and shoves them off the line.
  - `pool.tornado` — fire when a rival is 10–35 m ahead (the whirlwind runs down the road through the pack).
  - `pool.snowball` — fire when two or more rivals are 8–30 m ahead (it hits a group, not one rider).
  - `pool.rocket` — fire when a chaser is within 12 m behind (the dash plus the fire line behind you).
  - `pool.firecracker` — fire when a chaser is within 15 m behind (the trap goes off when someone comes close).
  - `pool.bubble` — fire when a rival is within 3 m and swinging (the bubble eats the next punch).
