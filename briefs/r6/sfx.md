# r6 job sfx — every skill sounds like itself, every reaction has a sting (audio unit; SPEC §24)

The user asked for skills that are "要素拉满" (packed with flavour). The 26 r6 skills (6 meme signatures, 17 pool
skills, 3 shared ults) only play the generic `skill.cast` / `skill.hit` fallbacks (`src/audio/events-combat.ts
skillSfx`), a shared ult plays the pelican's SHOWTIME whoosh (`ult:start` hard-codes `skill.pelican.ult`), and the
seven element reactions (`combat:reaction`) make no sound at all. Measured by `node tools/r6/present.mjs --only
audio`: 13 of 39 skills have their own sound, 0 of 7 reactions.

Read SPEC.md §11 (audio) and §24, `src/data/skills.ts` (every skill's name, desc, category, element),
`src/gameplay/combat/elements.ts` (what each reaction does), the skill files under
`src/gameplay/combat/skills/{elem,gag,meme,ults}/` (when each one hits, how long it lasts), `src/audio/sfx/kit.ts`
(tone / fm / hiss / ring / call / span), `src/audio/sfx/animals.ts` (meow / honk / bark / coo / gullCry),
`src/audio/sfx/skills.ts` (the 13 existing skill sounds: copy their style and loudness), `src/audio/sfx/bank.ts`
(the SFX registry), `src/audio/events-combat.ts` (bus → sound).

## Build it
1. **A cast sound for every skill**, keyed `skill.<id>` (so `skillSfx` finds it), plus `skill.<id>.hit` for every
   skill that hits a rider and `skill.<id>.end` where the end is an event (a rain that stops, a shield that pops).
   Put the r6 ones in a new `src/audio/sfx/skills-r6.ts` (export `SKILL_R6_SFX`, registered in `bank.ts`). Each sound
   says what the skill does, in the game's cartoon voice (short, punchy, 0.15–1.2 s; long effects get a short cast
   sound + a loop-free tail, never a sustained drone):
   - fire: firebreath = a roaring whoosh (pink noise, lowpass sweeping up) with crackle; rocket = ignition hiss +
     rising whistle; firecracker = a fizzing fuse, then a string of pops on `.hit`; meteor (ult) = a deep incoming
     whistle falling in pitch, `.hit` a heavy boom.
   - ice: icelance = a glassy shimmer + a crisp crack on `.hit`; snowball = a soft whump + crunch.
   - thunder: thunder = a sharp crack + low rumble; storm (ult) = a rolling thunder bed with rain hiss.
   - water: watergun = a squirt (band-passed noise with a burble); bubble = a blub, `.end` a pop.
   - wind: tornado = a rising swirling wind (band-pass sweep with a wobble).
   - gags: boomerang = a whoop-whoop flyby; pie = a wet splat on `.hit`; brainfight = a cartoon boing + wobble; blink
     = a zap-blip; thermos = a cap twist + a sip + a content sigh; ducks = a quack chorus (several pitched quacks);
     popup = a cheesy ad jingle ding; warsong = a short horn fanfare with a drum hit.
   - meme signatures: bananacat.peel = a squishy peel + a slip whistle on `.hit`; cryingcat.tears = a sad wail
     (meow pitched down, slow vibrato) + rain patter; xinxian.fresh = a vacuum whoosh + munch on each pickup;
     moodeng.bounce = a big boing up, `.hit` a heavy thud; pedro.trash = a bin rummage clatter + a happy little
     tune; hamster.violin = a short sad violin phrase (FM string with vibrato, four notes descending in minor).
   - timestop (ult) = a clock tick that slows to a stop + a tape-stop (pitch dropping to nothing); `.end` the tape
     spinning back up.
2. **A sting per reaction**, keyed `react.<reaction>` (vaporize, melt, freeze, electro, superconduct, overload,
   swirl), played at the victim on `combat:reaction` (wire it in a new `src/audio/events-r6.ts`, registered in
   `src/audio/system.ts` next to `wireCombat`): vaporize = a steam hiss burst; melt = a sizzle + drip; freeze = an ice
   crystallise crack; electro = an electric buzz zap that stutters (it chains); superconduct = a shatter with an icy
   zap; overload = an explosion boom; swirl = a swirling whoosh. A reaction is a highlight: a little louder than a
   skill hit, but never above the KO boom.
3. **The ult cast**: `ult:start` plays the cast ult's own sound (`skill.<skillId>`), not `skill.pelican.ult`; the
   SHOWTIME stinger and the announcer call stay for every ult the player casts. `ult:impact` likewise uses
   `skill.<skillId>.impact` when it exists (the pelican's), else `skill.<skillId>.hit`, else the pelican's impact.
4. Rate-limit what can repeat (the ducks, a firecracker string, electro chaining through a wet pack: one sting per
   reaction burst, not one per victim; `h.cooldown`).

## Look (listen) at it
Render your new sounds with `node tools/audio-check.mjs --offline --only race-coast --sfx` (peak / clipping / clicks / dropouts for every
sfx) and listen to a race with them: `sandbox/audio.html` plays any sfx by id. Keep the loudness of the existing skill
sounds (their peaks are in the offline report).

## Files you own
`src/audio/sfx/skills-r6.ts` (new), `src/audio/sfx/skills.ts`, `src/audio/sfx/bank.ts`, `src/audio/events-combat.ts`,
`src/audio/events-r6.ts` (new), `src/audio/system.ts`.

## Acceptance (the runner runs these; read `tools/r6/present.mjs` first)
- `node tools/r4/tsc-own.mjs src/audio/` → TSC-OWN OK
- `node tools/r6/present.mjs --only audio` → r6-present OK
- `node tools/audio-check.mjs --offline --only race-coast --sfx` → all audio checks passed
- `node tools/r4/w3-audio.mjs` → w3-audio OK
- `node tools/core-check.mjs` → core-check OK
