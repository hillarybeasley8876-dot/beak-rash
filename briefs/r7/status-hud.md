# r7 job status-hud — every status shows: words, chips, the player's banner, the caster's readout (ui-hud; SPEC §29)

The skill feel audit (`tools/r7/feel.mjs`, SPEC §29) found that when a skill puts a status on a rider — 眩晕, 减速, 沉默,
左右颠倒, 定身, 寒冷, 淋湿, 着火 … — nothing on the screen says so: the name tag shows one chip for stun/shield only, damage
gets numbers, elements get a badge, and everything else is invisible. The caster never learns whether the cast hit, and
a player who is silenced or confused by a rival does not know why the bike behaves oddly. You build the status layer of
the HUD. Read SPEC.md §10 (UI, P5 style), §24 (statuses), §29 (the feel contract), `src/data/status-words.ts` (the words,
glyphs, colours, which statuses get a banner — use it, do not hard-code words), `src/ui/hud/hud.ts` (how layers are
made and updated), `src/ui/hud/world/` (overlay.ts, project.ts, tags.ts — the chip system —, damage.ts — floating
numbers —, elements.ts — element badges —, edges.ts, taglayout.ts, avoid.ts), `src/ui/hud/skills.ts` (the skill
slots), `src/ui/hud/css/`, `src/core/events-map.ts` (`skill:cast`, `skill:hit`, `skill:end`, `skill:result`), and the
acceptance `tools/r7/status-hud.mjs` first.

## Build it
1. **Status words** (new `src/ui/hud/world/statuswords.ts`): when a rider gains a status that has a word in
   STATUS_WORDS (watch `session.riders[*].statuses` each frame: a status id that was not there last frame), pop the
   word over its head: P5 style (word inked in the status colour on a black slab, slight tilt, slam in 0.12 s, hold,
   rise and fade by 1.1 s), bigger for riders near the player. One word per rider per status per 1.2 s (refreshes
   don't re-pop); at most 6 words on screen; only riders on screen and within 60 m; damage numbers keep their place —
   stack the word above them, never on top. The player's own statuses pop too.
2. **Status chips** (tags.ts — extend the chip system, don't build a second one): while a status lasts, its glyph
   chip shows over the rider (up to 3, most important first: frozen, stun, rooted, confused, silenced, chill, slow,
   cold, burn, wet, charged, oiled, blind; good ones — boost, shield, intangible — in a separate green style), each
   with a thin ring that empties over the status's remaining time.
3. **The player's banner + screen cue** (new `src/ui/hud/statusbanner.ts` + css): when the player has a status with
   `banner: true`, a banner under the place block — 「沉默 2.4s」 / 「左右颠倒」 … with a countdown bar — strongest one
   only (frozen > stun > rooted > confused > silenced > chill > slow > oiled). A screen cue for confused (purple
   swirling edge vignette + a ⇄ mark), silenced (the skill slots greyed with a 琴/lock glyph — `skills.ts`), frozen
   (frost on the edges), stun (stars in the corners). No cue blocks the road in the middle of the screen; all respect
   reduced motion.
4. **The caster's readout** (new `src/ui/hud/readout.ts`, next to the skill cluster): for the player's own casts —
   count the `skill:hit` victims between its `skill:cast` and `skill:end`; for attack / control / summon / trap / gag
   skills (catalogue category) show 「命中 ×N」 when N ≥ 1, 「落空」 when the skill ended with N = 0; show every
   `skill:result` of the player (its `text`, green when `good`, grey when not) — a rival's never. Class names: words
   `st-word`, readouts `st-readout`, banner `st-banner`, rear callouts `st-rear` (the audit reads them).
5. **Rear callout**: a `skill:hit` from the player's skill whose victim is behind the player (and off screen) shows
   「身后 · <victim name> <verb> <skill name>」 at the bottom edge for 1.5 s — e.g. 「身后 · 柴犬 踩中香蕉皮！」; the
   victim's name from ROSTER, the skill's name from SKILLS.
6. **Debug surface**: `window.__br.hud = { status() }` (only when `window.__br` exists), returning
   `{ words: [{ rider, status, text, age }], chips: { [riderId]: StatusId[] }, banner: { status, text, left } | null,
   cue: StatusId | null, slotsLocked: boolean, readouts: [{ text, age }], rear: [{ text, age }] }` — what is on screen
   now.
7. Performance: no layout reads (offsetWidth, getBoundingClientRect) in the per-frame path of the new code; pooled
   elements like damage.ts; the HUD's frame cost stays within w3-hud's budget.

## Files you own
`src/ui/hud/world/statuswords.ts` (new), `src/ui/hud/statusbanner.ts` (new), `src/ui/hud/readout.ts` (new),
`src/ui/hud/world/tags.ts`, `src/ui/hud/world/overlay.ts`, `src/ui/hud/skills.ts`, `src/ui/hud/hud.ts`,
`src/ui/hud/css/` (new files or the existing ones).

## Acceptance (the runner runs these)
- `node tools/r4/tsc-own.mjs src/ui/hud/` → TSC-OWN OK
- `node tools/r7/status-hud.mjs` → r7-status-hud OK
- `node tools/r4/w3-hud.mjs` → w3-hud OK
- `node tools/r6/present.mjs --only visual` → r6-present OK
- `node tools/r6/ui.mjs` → r6-ui OK
- `node tools/ui-tour.mjs --sizes 1280x720,1920x1080 --spot none` → all checks passed
- `node tools/core-check.mjs` → core-check OK
Look at it (screenshots via thumb.py into `shots/r7-status-hud/`): a honk into three rivals (three 眩晕), the player
confused (banner + cue), silenced (locked slots), a peel behind (rear callout), at 1280×720 and 1920×1080.
