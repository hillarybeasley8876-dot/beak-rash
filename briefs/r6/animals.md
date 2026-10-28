# r6 job animals — the six meme racers get their own animal call (audio; SPEC §13 / §23)

Every racer has an `animal.<character>` call (`src/audio/sfx/animals.ts`): `src/audio/voice/barks.ts` plays it when a
rider taunts or gets hit, and `src/audio/sfx/bank.ts raceSounds()` pre-renders it at the start of a race. The six r6
meme racers have none, so their calls are silent and every play logs `[audio] unknown sfx "animal.cryingcat"` — the
final regression's `audio-check --game` fails on that warning (pack burst). Read SPEC.md §13 (audio) and §23 (the
meme roster), `src/data/roster.ts` (the six entries: bananacat 香蕉猫 「香蕉里的哭包」, cryingcat 泪眼猫猫 「含泪竖大拇指」,
xinxian 新鲜哥 the orange stray who only eats food within five seconds, moodeng 弹跳猪 the pygmy hippo who bites,
pedro 佩德罗 the dancing raccoon 「垃圾桶之王」, hamster 悲伤仓鼠 with its violin), `src/audio/sfx/animals.ts` (how the
existing calls are built: `meow`, `bark`, `honk`, `coo`, `call`, `span`), `src/audio/sfx/kit.ts`.

## Build it
1. Six new entries in `animals.ts`, one per meme racer, each recognisable and different from the existing ones:
   - `animal.bananacat`: a whiny, rising "huh?" meow, half a sob (the crying-cat-in-a-banana meme);
   - `animal.cryingcat`: a wet, wobbling sob-meow that ends in a sniff;
   - `animal.xinxian`: a short, hungry street-cat chirp + meow, quicker and lower than `animal.cat`;
   - `animal.moodeng`: a pygmy hippo — a squeaky snort into a short wet grunt (not a pig oink);
   - `animal.pedro`: a raccoon — two or three fast chittering trills;
   - `animal.hamster`: tiny high squeaks, sad (falling pitch).
   Short (≤ 0.8 s), peak level like the existing calls (the loudness check of `audio-check --offline` must pass).
2. Nothing else changes: barks.ts and bank.ts already ask for `animal.<character>`.

## Files you own
`src/audio/sfx/animals.ts` (and `src/audio/sfx/kit.ts` only if a new helper is needed — keep the existing ones as they are).

## Acceptance (the runner runs these)
- `node tools/r6/animals.mjs` → r6-animals OK (every racer of the roster has its `animal.<id>` call)
- `node tools/r4/tsc-own.mjs src/audio/` → TSC-OWN OK
- `node tools/audio-check.mjs --offline` → all audio checks passed
- `node tools/audio-check.mjs --game` → all audio checks passed (on a busy machine its timing check "A on GO" can
  miss by a few tens of ms: run it again before you touch anything for it)
- `node tools/core-check.mjs` → core-check OK
Render the six calls to wav (the offline renderer of audio-check) and listen-check their envelopes/peaks in your report.
