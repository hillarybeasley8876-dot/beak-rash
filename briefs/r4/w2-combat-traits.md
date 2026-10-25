# r4 job w2-combat-traits — weapon traits, pan parry, trick + STYLE rewards (combat unit)

Read SPEC.md §7 (combat; note the r3 SP economy), §15 (weapon traits + parry — your main spec), §16–§17 (tricks and
STYLE pay SP / coins) and §22. Throwing already works (w1-combat-throw: `src/gameplay/combat/throw.ts`,
`projectiles/thrown.ts`, `external.ts` — read them; the saltfish boomerang and the slipper homing build on them).

## Data
Extend `WeaponDef` in `src/data/weapons.ts` with optional `trait?: 'boomerang' | 'loosen' | 'parry' | 'triple' |
'flash' | 'seeker' | 'crit'`, `traitName?: string` (HUD label: 回旋镖 / 硬核 / 完美格挡 / 甩葱三连 / 闪光灯 / 必中 / 青轴)
and `crit?: number` (crit chance, default 0.1). Fill them for saltfish / baguette / pan / leek / selfie / slipper /
keyboard (umbrella's glide is the sim's — give it `traitName: '滑翔'` only). Numbers in tuning.ts.

## Traits (SPEC §15)
- saltfish 回旋镖: a thrown saltfish that hits nothing curves back toward its thrower and is caught (back in the hand,
  uses − 1) if it passes within 2 m of the thrower within 1.6 s of the release; otherwise it drops on the road. Works
  while the thrower brakes or turns (home onto the thrower's current position).
- baguette 硬核: heavy hits knock the victim's weapon loose every time (instead of 60 %).
- pan 完美格挡 (PARRY): while holding the pan, ANY swing pressed ≤ 0.15 s before an incoming hit lands parries it:
  • a rider's melee hit: no damage, the attacker's swing is cancelled and it gets 'stun' 0.6 s;
  • an `npc:strike`: answer `npc:hit` with `parried: true, damage: 0` (no knock);
  • emit `combat:parry { riderId, attacker (rider id or null), obstacleId (900/901 or null), weapon: 'pan', pos }`.
  The parrying swing itself still resolves normally if it reaches someone. The passive block chance (0.35) stays.
- leek 甩葱三连: the 3rd consecutive hit by the same rider within 1.2 s deals ×1.5 damage and +50 % knock (then the
  count restarts).
- selfie 闪光灯: hits give the victim 'blind' for 0.6 s.
- slipper 必中: a thrown slipper picks its target in a ±60° cone within 45 m and steers at 6 rad/s.
- keyboard 青轴: crit chance 0.25 (use `WeaponDef.crit`; others keep 0.1). Keycap debris is the fx unit's later.

## Rewards
- `rider:trick` phase 'land' → that rider gets SP + 8 × count.
- `style:bank` → the rider gets SP + e.sp and coins + e.coins (`rider.coins`).
- Both respect the r3 economy: SP never above 100, and the 12 s post-SHOWTIME lockout applies to them like it does to
  fighting SP. The soak (`node tools/combat-check.mjs --soak`) must stay green: an aggressive bot still gets at most 2
  SHOWTIMEs per race — if STYLE/trick SP pushes it over, scale them down in tuning.ts and say so in your report.

## Files you own
`src/gameplay/combat/` (whole folder), `src/data/weapons.ts`, `tools/combat-check.mjs`, `tools/combat-check/`
(add cases, never weaken existing ones).

## Acceptance (the runner runs these; read `tools/r4/w2-traits.mjs` first)
- `node tools/r4/tsc-own.mjs src/gameplay/combat/ src/data/weapons.ts` → TSC-OWN OK
- `node tools/r4/w2-traits.mjs` → w2-traits OK
- `node tools/r4/w1-throw.mjs` → w1-throw OK (throwing keeps working)
- `node tools/combat-check.mjs` → all pass
- `node tools/combat-check.mjs --soak` → exit 0
- `node tools/core-check.mjs` → core-check OK
