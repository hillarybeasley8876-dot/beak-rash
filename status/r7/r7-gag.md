# r7-gag — Gag skills felt (SPEC §29)

## Plan
1. Props: add `gag:after` (rider silhouette for blink afterimages) and `gag:goji` (berry) to gag/props.ts.
   Proof: `node tools/core-check.mjs` → core-check OK (library builds every key).
2. New visuals in the gag folder: glint.ts (camera-facing star flash at a track point), afterimage.ts (fading
   rider silhouettes), steam.ts (green goji steam swirl around a rider).
   Proof: `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/gag/` → TSC-OWN OK.
3. pool.boomerang: fish ×2 (scale 3, flying at 1.85 m over the caster's head), white swoosh Trail, glint where it
   turns, out 16 m over 1.8 s, hit reach UNCHANGED at 1.3 m (a wider box broke the SP economy, see Evidence).
   Proof: feel audit → screen middle ≥ 3 % at +0.3 s; `node tools/r6/skills.mjs --only gag`.
4. pool.blink: 20 m, speed kept, 4 afterimages (0.4 s), flat-ring flash at both ends + star at the landing,
   skillBoost 0.6 s / 0.15. Proof: feel audit → gain ≥ 15 m; r6-skills (blink ≥ 9).
5. pool.thermos: heal 30 + cleanse stay, skillBoost 1.5 s / 0.15, goji steam swirl, `skill:result` for the caster
   (「+30 HP」/「+30 HP · 净化 2」/「枸杞提神」). Proof: feel audit (hp +30, seen ≥ 3 % / peak ≥ 6 %, HUD 「+30 HP」).
6. Acceptance: tsc-own, feel + feel-check (all 8 gag skills), r6-skills gag, combat-check --soak, net-det, core-check.

## Done
All six steps. pool.boomerang 0.8 % → 8.6 % at +0.3 s (peak 9.4 %), pool.blink +14.6 m → +28.5 m with four
afterimages and flashes, pool.thermos now boosts and reads 「+30 HP」 on the HUD at any HP.

## In progress / next
Nothing. The three new visual files (glint / afterimage / steam) are only used by this folder's skills.

## How to test (exact commands)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/skills/gag/`
- `node tools/r7/feel.mjs --only pool.boomerang,pool.pie,pool.brainfight,pool.blink,pool.thermos,pool.ducks,pool.popup,pool.warsong --out F:/dev/beak-rash-out/r7/feel-gag`
- `node tools/r7/feel-check.mjs --summary F:/dev/beak-rash-out/r7/feel-gag/summary.json --only pool.boomerang,pool.pie,pool.brainfight,pool.blink,pool.thermos,pool.ducks,pool.popup,pool.warsong`
- `node tools/r6/skills.mjs --only gag` · `node tools/combat-check.mjs --soak` · `node tools/r6/net-det.mjs` · `node tools/core-check.mjs`

## Evidence (key output lines)
- feel-check (final tree): PASS pool.boomerang seen 8.6→9.4 % · PASS pool.blink seen 6.5→10.8 %, +28.5 m ·
  PASS pool.thermos seen 11.6→11.8 % … `feel-check OK`
- r6-skills: `{"boomerang":2,…,"blink":20,"thermos":{"hp":0.78,"clean":true},…}` → `r6-skills OK`
- soak (final tree): coast SHOWTIME at 64.2 s · city 73.3/105 s · mountain 80.5 s · console errors 0 → `SOAK OK`
- `r6-net-det OK`, `core-check OK`, `TSC-OWN OK`; every audit ride reports `errors []`.
- HUD: the thermos ride's new texts include `+30 HP` (ui-hud renders `skill:result`).

## Known issues
- The boomerang's hit reach stays 1.3 m although the fish is drawn at scale 3. A 1.7 m box put rivals' fish on
  the player so often that coast's first SHOWTIME came at 32.7 s (< 35 s) — with the reach back at 1.3 the soak
  is OK. The visual size carries the feel; the hitbox carries the balance.
- The blink's star glint is at the landing point only: a star over the caster is ~1 m from the chase camera and
  white-outs the whole screen (measured 21 % of the frame). The departure end still gets its flat ring.

## Requests
None.
