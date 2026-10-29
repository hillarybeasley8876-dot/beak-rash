# r7-meme — the meme skills that are not felt (SPEC §29)

## Plan
1. Read SPEC §23/§24/§29, the six meme skills, pickups/vacuum, tools/r7/feel-check.mjs; probe why xinxian lost coins.
   Proof: `node shots/r7-meme/probe-fresh.mjs` → the vacuumed coins were taken by rivals 1/4/2, the player only the fish.
2. peel: peels fly an arc over the cat's head (apex 2.6 m) and land behind; bigger + brighter, glow + slick.
   Proof: audit ≥1.5 % @0.3 s, ≥6 % peak, ≥1 affected; feel-check.
3. tears: caster boost 0.25 → 0.38 / 3 s. Proof: audit gain ≥ 6 m.
4. fresh: own hard yank (the cat claims what it pulls in), base boost 0.15/2 s, bites 0.08 cap 0.4,
   `skill:result` 「吸到 N 个」/「一口都没吃到」, rear-end bumps cost no speed. Proof: audit ≥ 8 m.
5. violin: grey-blue sad AuraDisc on the road, notes flying to every listener, a rain cloud per silenced rider,
   listeners 15 % slower. Proof: audit ≥3 % @0.3 s, ≥6 % peak, ≥2 affected.
6. trash: the prize pops out of the bin over pedro's head + `skill:result` names it. Proof: audit sheet + HUD text.
7. Acceptance: tsc-own, feel (six skills) + feel-check, r6/skills --only meme, combat-check --soak, net-det, core-check.

## Done
- peel: the toss is an arc over the head (both ends ride with the caster until it lands, so the three land strung
  out behind it), peels ×1.5 with an additive halo in the air and a pulsing slick on the road; skidding untouched.
- tears: boost 0.38 / 3 s (+20.8 m in the audit, was +4.0).
- fresh: own suction (`pull 24`/s, swallowed at 2.2 m by the caster through `pickups.take`, so coins/fish/weapons
  are credited exactly as if ridden over), base boost 0.15 + 0.08 a bite (cap 0.4), rear-end contact costs no speed
  (wing.ts's rule), `skill:result` at the end. Audit +13.9 m (was +0.9), 4 items taken by the caster in r6-skills.
- violin: AuraDisc (radius = reach), `SadNotes` flying to each listener, a small `RainCloud` over each silenced
  rider, and 15 % slow while it plays. 4 affected, 21.8→45.0 % of the screen.
- trash: `PrizePop` (the can / the weapon / a 小鱼干 pile / the green stink cloud) rises out of the bin and hangs
  over pedro's head for 0.6 s; `skill:result` 「掏到 飞弹！」/「掏到 <weapon>」/「+40 小鱼干」/「臭气熏天！」;
  the missile now leaves the bin at +0.45 s, after the reveal.
- bounce: untouched (it passed before).

## In progress / next
- nothing; acceptance runs are done (see Evidence).

## How to test (exact commands)
- `node shots/r7-meme/probe-fresh.mjs`
- `node tools/r7/feel.mjs --only bananacat.peel,cryingcat.tears,xinxian.fresh,moodeng.bounce,pedro.trash,hamster.violin --out F:/dev/beak-rash-out/r7/feel-meme`
- `node tools/r7/feel-check.mjs --summary F:/dev/beak-rash-out/r7/feel-meme/summary.json --only <the six>`
- `node tools/r6/skills.mjs --only meme` · `node tools/combat-check.mjs --soak` · `node tools/r6/net-det.mjs` · `node tools/core-check.mjs`

## Evidence (key output lines)
- baseline (before): peel `1.8 % peak`, tears `+4.0 m`, fresh `+0.9 m` / `coins −5`, violin `1.9 %`.
- after: `PASS bananacat.peel seen 7.5→99.9 %, 7 affected` · `cryingcat.tears 39.1→44.4 %, +20.8 m` ·
  `xinxian.fresh 9.2→9.2 %, +13.9 m` · `moodeng.bounce 5.0→9.2 %` · `pedro.trash 11.7→11.7 %` ·
  `hamster.violin 21.8→45.0 %, 4 affected` → `feel-check OK`.
- `r6-skills OK` (meme: fresh `{"taken":4,"boost":true}`, peel/tears/trash/violin true) · `core-check OK`.
- `SOAK OK` (3 races, 18 achievements, `console errors: 0`) · `r6-net-det OK` · `TSC-OWN OK` · `npx tsc --noEmit` clean.
- `node shots/r7-meme/probe-fresh.mjs` after the fix: `errors []`, the caster takes the fish itself.
- probe before the fix: `takes [[2.13,'coin',1],[2.31,'coin',4],[2.44,'coin',2],[2.45,'fish',0]]` (player = 0).

## Known issues
- peel's audit peak reads 99.9 % because a confused rival crashes at +2.6 s and the KO slow-mo camera takes over;
  the skill's own peak is 10.4 % at +0.6 s (already over the 6 % floor), so the pass does not depend on the crash.
- the audit scene is tight: the boosted caster rear-ends the rival 2.5 m ahead (all move skills do), which is why
  fresh keeps its speed through a rear-end bump, the way pelican.wing does.
- two of the four audit coins are still taken by rivals that are physically touching them while they fly in.

## Requests
- `combat/pickups/pickups.ts tryCollect()` hands an item to the first rider in array order, ignoring `vacuumBy`:
  a pickup already flying to a rider should be reserved for it (Big Gulp's vacuum has the same hole). Worked
  around inside fresh.ts (the skill claims what it pulled in), so nothing blocks on this.
