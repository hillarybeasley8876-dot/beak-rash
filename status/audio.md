# audio — status

## Plan (milestones)
1. [x] Engine (engine.ts): music / sfx / voice / sting buses → master → glue compressor → ×0.5 → soft clipper (ceiling −1.1 dBFS);
   muffle = low-pass + duck (slow-mo, KO, pause), voice ducks music −8 dB, tunnel reverb send, volumes from save (+ live updates).
2. [x] DSP (dsp/): click-free envelopes (perc / adsr with retrigger, cancelAndHold), k-rate filters, seeded noise buffers, reverb IRs, curves.
3. [x] Music (music/): theory (jazz chord qualities, voice leading), song data → compile (validated), lookahead SongPlayer (swing,
   humanise, fills, adaptive layers, stretch form), Conductor (crossfades, stingers, bass drop), 6 songs, 8 stingers.
4. [x] SFX (sfx/): 98 synthesized sounds (kit primitives: tone / hiss / ring / fm / formant call), bike loops, police siren,
   camera-relative placement (inverse-distance gain, pan, air absorption).
5. [x] Auto-triggers from the bus (events-race.ts, events-combat.ts) + session watcher (watcher.ts) — gameplay never calls sfx().
6. [x] Voices: tools/gen-tts.mjs → 66 clips in public/assets/voice (19 announcer, 47 character lines, 1.0 MB, loudness-normalised)
   + src/data/voice.ts; voice/player.ts (announcer queue with priorities / interrupt, positional rate-limited barks).
7. [x] sandbox/audio.html (audio lab: buttons for every song, stinger, sfx, voice; intensity / muffle / bass-drop / reverb /
   spatial controls; live meter + spectrogram) and tools/audio-check.mjs (offline renders + in-game checks).
8. [x] index.ts → real system (system.ts); verified in the browser (shots/audio/).

## Done — how it works
- Nothing exists before `unlock()` (UI calls it on the first key/click; the runtime also listens for the first gesture):
  the AudioContext (32 kHz, interactive) is created there; music asked for earlier starts on unlock.
- Music: 25 ms timer + update() schedule 180 ms ahead (1.6 s when the tab is hidden). Screen → song: title, menu (all menu
  screens + loading), race-<track> (race / intro), results; `pause` keeps the race song muffled.
- Adaptive: intensity 1 when the player is top-3 (extra percussion), 2 from 85 % progress (jumps to the B→A2 "stretch" form at
  the next bar with a crash, claps, 16th percussion, hook doubled an octave down). Slow-mo (clock scale < 0.95) muffles
  proportionally; cine:ko start muffles 0.85 + KO stinger, peak drops the bass (high-pass) + 击倒/双杀/三杀, end whooshes back.
- Event map: countdown beeps + 三二一冲 voice, GO stinger · hits per weapon (+crit / block layers) · swings · KO boom + barks ·
  ONE MORE at combo 3 · skill cast / hit / end per skill id (generic fallback) · SHOWTIME stinger + voice · pickups ·
  hop / land / PERFECT · drift start / level sparks · boosts (mini-turbo, pad, slingshot) · near miss · crashes / splash ·
  obstacles by kind · traffic horns by vehicle · police siren (positional, follows the corgi) + BUSTED · final stretch /
  lead / finish place voice lines · taunts → TTS clip of that exact bubble text, else the species call · bell (combat:bell
  / 叮 taunt) → 叮叮叮 · weapon break · incoming-projectile warning (projectile:spawn targeting the player) · police lost.
- Bike loops (player): wind (speed²), chain whirr (pedalling, tooth-rate AM), freewheel ticks (coasting), tyre roll, curb
  rumble, grass / sand / dirt / water layers, drift skid, boost jet; tunnel reverb. Rival / traffic pass-by whooshes.
- CPU (round 3): drums play one pre-mixed buffer per bar; keys, pad, clav and bass play pre-mixed buffers at rate 1
  from note banks rendered at boot (bank.ts / premix.ts); lead and brass are persistent voices that unplug when silent;
  the music reverb is a diffused feedback loop unplugged when no music plays; cached sfx takes play at rate 1; sfx voice
  limits (16 total, per-id caps) steal the quietest sound first. Realtime numbers: Fix round 3 below.

## Songs (critics can't listen — arrangement notes)
- **title** — "BEAK RASH! (Main Theme)" · 126 bpm · D Dorian · lead wah (solo synth) · form [intro, A, A2, B, A3, S, D, B2, A4] (loops back to A)
  D Dorian funk at 126 bpm, 16th swing 0.10; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:02). Intro: Rhodes + pad + vinyl crackle, reverse-cymbal swell and tom fill. A (8): Dm9–G13 Dorian vamp ×2, Bbmaj7–A7#9, Dm9, Eb7#11 (tritone sub of A7) back to Dm9; 8-bar slap line (thumb/pop octaves, dead notes, 6th and slide into bar 5, chromatic F–Eb into D), ghost-note snare, syncopated Rhodes comp, brass punches on bars 4/8. A2: the wah hook (call A–D–F–E–D / answer B–A–G–E–D, climbing to C6, bluesy C over A7#9) + clavinet chops. B (bridge): ii–V–I in F (Gm9–C13–Fmaj9–Bbmaj7), minor ii–V home (Em7b5–A7b9–Dm9) and Bb13–A7#9; half-time ride feel for 4 bars, legato walking bass with slides, lyrical counter-melody, brass swells, rip + fall. A3: pushed kick, busier ghosts, 16th dead-note bass, new comp / clav rhythms, brass answers, hook doubled an octave down, shaker / tambourine. S: square-synth solo over the Dorian i–IV vamp (Dm9 | G13) into Bbmaj7–C13–Dm9–A7#9. D: 4-bar half-time breakdown (Dm9–Bbmaj7–Gm9–A7#9, pad, long bass notes) then a 4-bar build (8th → 16th snare, octave bass, brass rips, swell). B2: the bridge with a full groove, octave-doubled lead, 8th-note bass with pops and a brass riff every bar. A4: hook with a new last bar (an Eb7#11 arpeggio falling 5–#11–3–9). Three rotating fills.
- **menu** — "Hideout Café" · 120 bpm · F minor / Ab major · lead flute (solo synth) · form [intro, A, A2, B, A3, S, D, B2, A4] (loops back to A)
  Lounge acid jazz for the menus, 120 bpm, heavy 16th swing (0.24), vinyl crackle; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:08). A (8): the circle progression Fm9–Bbm9–Eb13–Abmaj9–Dbmaj9–Gm7b5–C7b9–Fm9 (vi–ii–V–I–IV–vii–III7–vi in Ab). Rim-click backbeat with ghost notes, soft kick, 8th hats, shaker on the &s, an 8-bar walking slap line (1–5–8–7 shapes, a slide into Abmaj9). A2: the breathy flute melody (C6 down to G5, answered over Bbm9, a b9 Db6 over C7b9) over a busier walk with approach notes. B (bridge): Bbm9–Eb13–Abmaj9–Dbmaj7#11 then Gm7b5–C7alt–Fm9 and a Gb7#11 tritone sub back; two-feel bass for 4 bars then walking, ride, warm pad, soft brass swells, flute counter-line. A3: pushed kick, ghosted 16th bass, new comp rhythm, tambourine, the melody doubled an octave down. S: square-synth solo over the A changes (arpeggios with a b9 over C7b9), ride cymbal, four-to-the-bar bass. D: 4-bar breakdown (Rhodes + pad + whole-note bass, shaker only) and a 4-bar rebuild (rim, kick, 8th → 16th bass) into B2: the bridge with the full groove and an octave-doubled flute. A4: melody with a new last bar (Ab–G–F–Eb–C). Three rotating fills.
- **race-coast** — "Sunny Side Sprint" · 128 bpm · A major · lead wah · form [intro, A, A2, B, A3, S, D, B2, A4] (loops back to A)
  Sunny disco-funk, 128 bpm, swing 0.08, A major; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:00). A: Amaj9 | Bm9–E13 | Amaj9 | C#m7–F#7#9 | Bm9 | Dmaj9–Dm6 (minor plagal) | C#m7–F#7alt | Bm9–E13; four-on-the-floor, ghosted backbeat, 16th hats, 8-bar slap line (root–octave pop–5–6, #5 under F#7alt), off-beat Rhodes, clav chicken-scratch, brass punches. A2: wah hook (E–C#–E–F#–E … climbing to D6). B (chorus): Dmaj9–E13–C#m9–F#m9–Bm9–E13–Amaj9–Bb7#11, legato bass with slides, pad, brass riff, anthem lead. A3: pushed kick, busier ghosts, 16th dead-note bass, new comp/clav rhythms, brass answers, hook doubled an octave down. S: square-synth solo over an A mixolydian vamp (A9 | G/A ×2) into a ii–V turnaround. D: 4-bar half-time breakdown (pad, long bass notes) then a 4-bar build (8th → 16th snare, octave bass, brass rips, swell). B2: chorus + octave-doubled lead + brass riff every bar. A4: hook with a new last bar. Four rotating fills. Top-3: cowbell, shaker, clav 16ths (1–4 kHz). Final stretch: one-bar riser + snare roll, then B2–A4 up a whole step at +4 % tempo, +2 dB, driving 8th bass, double-time hats, claps.
- **race-city** — "Neon Pursuit" · 124 bpm · C minor · lead flute · form [intro, A, A2, B, A3, S, D, B2, A4] (loops back to A)
  Night acid jazz, 124 bpm, swing 0.14, C minor; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:04). A: Cm9 | Fm9 | Cm9 | Ab7#11–G7#9 | Cm9 | Fm9 | Dm7b5–G7b9 (minor ii–V) | Cm9–Db7#11 (tritone sub); broken-beat kick, ghost snares, 8-bar slap line (octave pops, b7 runs, b5 under the half-diminished), Rhodes comp, brass punches. A2: flute hook (G–Bb–C–Eb–D) + clav. B (bridge): Abmaj9–Gm7–Fm9–Bbm9/Eb13–Abmaj9–Dbmaj7#11–Dm7b5–G7alt, ride, walking slap line, pad, brass swells. A3: busier kick / ghosts, 16th dead-note bass, new comp + clav, brass answers, hook an octave down too. S: wah solo over a C dorian vamp (Cm9 | F9) into Abmaj7#11–G7#9. D: half-time breakdown then a 4-bar build. B2: four-on-the-floor drive, brass riff, doubled bridge melody. A4: hook ending B–Ab over the Db7#11 tritone sub, resolving into Cm9 at the loop. Top-3: brass answers, octave-doubled lead, shaker + cowbell, clav 16ths. Final stretch: riser + snare roll, then B2–A4 a whole step up (D minor) at +4 % tempo, four-on-the-floor, 8th bass, claps.
- **race-mountain** — "Sunset Switchbacks" · 130 bpm · A Dorian · lead wah · form [intro, A, A2, B, A3, S, D, B2, A4, T] (loops back to A)
  Driving sunset rock-funk, 130 bpm, nearly straight (swing 0.04), A Dorian; loop A–A2–B–A3–S–D–B2–A4–T = 68 bars (2:06). A: Am9 | Fmaj9 | G13 | Em7 | Am9 | Fmaj9 | Dm9–G13 | Cmaj9–E7#9; kick on 1, &2, 3, &4, 8-bar octave slap line, half-note Rhodes, brass hits. A2: soaring wah hook (A–G–E–G–A–C …). B (bridge): Dm9–G13–Cmaj9–Fmaj7#11–Bm7b5–E7b9–Am9–Fmaj7#11/E7alt, four-on-the-floor, ride, legato slap line, pad, brass swells. A3: pushed kick, 16th hats, 16th dead-note bass, new comp + clav, brass answers, hook an octave down too. S: square-synth solo over an A dorian vamp (Am9 | D9). D: half-time breakdown, then a 4-bar build. B2: brass riff, doubled bridge melody. A4: hook resolving up to E. T: 4-bar wah/brass tag on Fmaj7#11–G13 into E7alt. Top-3: brass answers, octave-doubled lead, cowbell + tambourine, clav 16ths. Final stretch: riser + snare roll, then B2–A4 a whole step up (B dorian) at +4 % tempo, four-on-the-floor, 8th bass, 16th hats, claps.
- **results** — "Victory Lap" · 122 bpm · F major · lead synth (solo wah) · form [intro, A, A2, B, A3, S, D, B2, A4] (loops back to A)
  Results / victory lap, 122 bpm, swing 0.16, F major; loop A–A2–B–A3–S–D–B2–A4 = 64 bars (2:06). Intro: brass rip + crash fanfare and a tom fill. A (8): Fmaj9 | Em7–A7#9 | Dm9 | Cm9–F13 (ii–V to IV) | Bbmaj9 | Bbm6 (minor plagal) | Am7–D7b9 | Gm9–C13 (ii–V home); shuffled kick / ghost-snare groove, an 8-bar slap line (1–5–8–5–3–5–6 on the one-chord bars, root–octave–7th on the ii–V bars, a slide home), Rhodes comp, brass punches. A2: bright synth-brass melody (A–C … C#–C over A7#9, Db over Bbm6) + shaker / tambourine. B (gospel bridge): Bbmaj9–C13–Am7–Dm9–Gm9–C9sus–Fmaj9 with a Gb7#11 tritone sub, legato walk with slides, claps on 2 & 4, pad, brass swells. A3: pushed kick, 16th dead-note bass, new comp, brass answers, claps, the melody doubled an octave down. S: wah solo over the gospel I–IV7 vamp (Fmaj9 | Bb13) into Dm9–G13–Gm9–C13. D: 4-bar half-time breakdown then a 4-bar build. B2: the bridge with 8th-note pops, a brass riff every bar and an octave-doubled lead. A4: melody with a new last bar. Three rotating fills.
- **Stingers**: count (880 Hz beep + kick), GO (beep + E6/9 brass fall + crash), KO (Dm stab → Dm(b13) fall, boom, low tom),
  SHOWTIME (tom roll + rising A → B → C# brass rips into Dmaj9 hit + synth A5 + crash), BUSTED (sad wah Bb–A–Ab–G),
  FINISH (tom pickup, Bb → C → Dmaj9/E fall + D6 lead), WRECKED (Fm fall + boom), ONE MORE (G → A rip + clap).
- Mix (round 3): kick side-chains bass / keys / pad / clav (depth 0.3); comping + horns dip −7.5 dB under lead notes;
  bass driven + high-passed; music reverb = diffused loop (≈ 0.9 s, decorrelated L / R); dotted-8th band-passed delay on
  keys / clav / lead; keys 8th-note auto-pan ±0.85, pad voices ±0.6, horns +0.4, clav −0.55; per-section levels (A −3 dB,
  B2 +2 dB) and the D breakdown / build. Tone, width and dynamics per song: Fix round 3 (M0 / M2 / M3).

## Known issues / gaps
- Can't be judged by ear in this environment: timbres were tuned by spectrum / level analysis only.
- Voices exist only for the lines generated (see tools/gen-tts.mjs LINES); new roster lines fall back to animal calls
  until `node tools/gen-tts.mjs` is rerun (needs IOA VPN; skips existing files, --force regenerates).
- Offline CPU numbers are wall-clock on a shared machine (load-aware: warnings instead of failures when loaded).

## Core requests
- (done by core) `AudioSystem.attach?(session)` is now called by game.ts; AudioRuntime implements it (window.__br.session()
  remains only as a fallback before the first attach).
- ui-screens (critic r2 m7): results grade stamp → `app.audio.sfx('ui.stamp')`; coin count-up → `sfx('ui.count')` per tick
  (audio caps it at 2 voices); optional: the PAUSE slam could use the existing 'ui.pause' tape-stop instead of 'ui.cutin'.
- core + race (critic r2 t6): add `'police:whistle': { riderId: RiderId; pos: Vec3Like }` to events-map and emit it from
  race/police.ts instead of `app.audio.sfx('police.whistle')` (and let corgi knocks go through combat:hit or a race event
  instead of `sfx('hit.<weapon>')`), so audio can place / rate-limit them like every other world sound.

## How to test
- `node tools/audio-check-adaptive.mjs` runs inside `--game`: top-3 hold / 2-bar line, finish freeze, place-based cues.
- `node tools/audio-check.mjs` — offline (every song 20 s + loop seam + final-stretch layer, 9 stingers, every sfx: peak
  < −1 dBFS, 0 clipped / clicks / dropouts; per song the bass stem, the hook over music + bike at 20 m/s, and one full
  loop's tone: octaves vs 125 Hz, width above 200 Hz, LRA, breakdown / build; 22-instrument retrigger check) then in-game
  (nothing before unlock, countdown, loops, mix peak, 11 event→sound mappings within one frame, KO cinematic, held KO lines
  (audio-check-barks.mjs), pause, mute, screen music, race-start sync, adaptive layers, no-WebAudio / WebKit, no errors),
  then the realtime CPU gate with a control tab (audio-check-cpu.mjs). `--offline`, `--game`, `--cpu`, `--only race-city`.
- Lab: http://127.0.0.1:5300/sandbox/audio.html (click UNLOCK, then any button).
- In game: `window.__br.audio.state() / trace() / level(s) / record(s) / music(id) / stinger(id) / voice(id) / play(id)`.
- Regenerate voices: `node tools/gen-tts.mjs [--force] [--only ann_ko]` (IOA VPN); manifest rebuilt from files on disk.
- Screenshots: shots/audio/lab-*.png (lab), race-coast-6s.png / ko-cine.png (game), *-spectrum.png (recorded mixes).

## Fix round 1
Critic issues (reviews/audio-r1-music.json, audio-r1-tech.json) → change. Checkpointed per item; [x] = done + verified.
Order: T4, T1/M7/T10, T8, T2, M1, M3, M4, M5, M6, M2, T3, then minors.
- [x] T4 flaky check: trace stores unrounded performance.now(); audio-check filters `e.ms >= Math.floor(at)`. Game check green
  (with `--stub camera`: another unit's src/camera/blend.ts throws in the frame loop right now; new `--stub` flag passes through).
- [x] T1 pause→settings: removed the flow:screen→song wiring (events-race) and system.ts SCREEN_SONG; the UI's music() calls
  (ui/flow-rules musicFor) are the single source of truth. New audio-check case: pause → settings → pause → resume keeps
  race-coast and the same SongPlayer (`state().songsStarted` unchanged) — passes.
- [x] M7 title theme: music('menu') never cuts the title theme off (system.ts music()): title plays from the title through the
  menus until the first race; the lounge 'menu' plays when coming back from races. Check: title → menu keeps 'title'.
- [x] T10 dead code: removed Band.setTrim, SongPlayer.level, SessionWatcher.dispose, SfxPlayer.has; wireRace/wireCombat
  return void (app-lifetime listeners); raceSong()/isPlayer() live on Host (one copy).
- [x] T2 race-load dropout: lookahead 3 s from flow:startRace / flow:restartRace / flow:screen 'loading' until attach(session)
  (then 0.5 s for 2 s, then 0.18 s; reset on a non-race screen, 15 s cap), pumped at once before the heavy work; SongPlayer
  skips steps > 30 ms behind the clock instead of firing past notes. Recording across a menu → race load: 0 windows below
  −55 dBFS (was 18 × 100 ms). Permanent audio-check case "music keeps playing through a race load" (longest gap ≤ 200 ms).
- [x] T6 drone when the frame loop stops: pump() sees no update() for 250 ms → watcher.halt() (loops inactive, siren off);
  next update() restores. Probe (manual mode freeze, sfx only): −23.6 dB riding → −180 dB frozen → −23.5 dB resumed.
- [x] T7 reproducible renders: noise() takes the caller's Rng (SongPlayer / Band / SfxPlayer / BikeLoops own one); the keys LCG
  is gone (Band.rng). Same song / sfx rendered twice in one page: max sample diff 0 (was 0.86 / 0.07).
- [x] T8 sfx('sting.<unknown>'): isStinger() guard + one warning (no throw, verified). KO fallback timer checks the session.
- [x] T11 first-key freeze: preload() builds the context (suspended; suspended again if autoplay started it) + graph at boot;
  unlock() only resumes (sync cost 1.9 ms, was ~254 ms); tunnel convolver built on first tunnel entry. `live` needs unlock.
- [x] M1 mix buries the melody: DEFAULT_MIX drums .9→.8, bass .85→.6, keys .5→.8, clav .32→1.7 (+ wah Q 3.2→1.6), brass .42→.84,
  lead .36→1.0, pad .26→.62; flute / synth leads matched to the wah (lead.ts); comping keys/pad/clav dip −3.5 dB under lead
  notes (Band.underLead); slap bass: sub sine .62→.3, brighter growl (settle f·3.6+280 Hz), pops/thumbs louder clicks, strip
  HP 38 Hz + peak +5 dB @ 1.1 kHz. Measured (stems vs full mix, glue comp bypassed, new src/audio/check-mix.ts + loudness.ts
  BS.1770): lead −4.1…−5.2 LU (was −10…−14.6), bass −7.1…−9.0 (was −4…−5), keys −4.7…−11.3, brass ≈ −11 (was −18), clav
  −20…−23.5 (was −35), pad −20.7…−23.5 (was −26); 60–150 Hz share 26–35 % (was 49–61 %). Hook vs rest of music + bike loops
  at 20 m/s (A2): coast +4.0 dB @ 500–1200 Hz (was −2.5), city +6.8, mountain +3.1. Peaks −1.9…−5.3 dBFS, 0 clicks.
  audio-check now gates every song: lead −7.5…−3.5 LU, bass −10.5…−6.5, low share ≤ 40 %, race hook ≥ +3 dB.
- [x] M2 repetition: race songs rewritten as 8-section loops A–A2–B–A3–S–D–B2–A4 (+ 4-bar tag T on mountain): coast 64 bars
  = 2:00, city 64 = 2:04, mountain 68 = 2:06 (were 32 bars ≈ 1:00). Each section has its own 8-bar bass line (A: root/octave
  slap line with per-bar endings, A3: 16th dead-note version, B: legato walking line with slides, S: vamp line, D: long
  notes → octave build), 3–5 kick and 9–10 snare patterns (pushed A3, half-time breakdown, four-on-the-floor B/B2), comp /
  clav / brass variations per section, 4 rotating fill variants (Section.fill accepts a list; SongPlayer counts passes),
  a solo section on a second lead voice (Section.voice: coast/mountain square synth, city wah) over a new vamp, and a
  4-bar breakdown + 4-bar build. variety.mjs (shots/audio/fix1): 4–5 progressions, 24–26 distinct bass bars (was 1),
  lead 25–27, brass 10–15 per loop. compile.ts now rejects lanes that are not whole bars.
- [x] M6 adaptive music audible: top-3 = section brass answers every bar, hook / bridge doubled an octave down, cowbell
  (new DrumKit.cowbell) + shaker/tambourine, clav 16ths, claps, band +1 dB; final stretch = one-bar build (riser + 16th
  snare roll + toms), then the stretch form B2–A4 a whole step up at +4 % tempo (Song.lift; delay / tremolo follow), +2 dB,
  driving 8th bass, double-time hats, claps (city / mountain four-on-the-floor), brass riff (B2). Same bars rendered at
  intensity 0/1/2 (final mix, glue comp on): top-3 coast +1.2 / +1.5 dB at 250 Hz–4 kHz, city +2.5 dB @ 250–1k, mountain
  +0.9 / +1.2 (+3.8 > 4 kHz); stretch +2.3 / +2.9 (coast), +1.5…1.9 dB overall (was +0.3) plus the key change and tempo.
  Shaker / tambourine / cowbell levels raised (they were 15 dB under the new mix).
- [x] M3 stingers: built in the playing song's key (Song.key parsed to tonic + mode; the final-stretch lift transposes it):
  count = the key's 5th, GO = the song's own bar-1 chord of section A, KO = tonic power stab → tonic 6/9 or m9 fall,
  SHOWTIME = IV–V–I (major) / bVI–bVII–i rips, FINISH = bVI–bVII–I, ONE MORE = V–I / bVII–i, BUSTED = chromatic slide onto
  the tonic, WRECKED = tonic power fall. Conductor.stinger() lands KO / WRECKED / ONE MORE on the song's next 8th and
  SHOWTIME / FINISH / BUSTED on the next beat (SongPlayer.grid; probe: 0 offset on all 3 race songs) and ducks the music
  −7.5 dB (5 ms attack) for the stinger's length (Engine.duckMusic). ONE MORE / BUSTED / FINISH +6 dB (velocity 2):
  vs the A2 section, 300–5000 Hz, before the duck: ONE MORE −1.1…−2.1 dB (was −7.8), BUSTED +0.4…+2.1 (was −7.5),
  FINISH +2.8…+4.8 (was −5.7), SHOWTIME −0.1…+2.7.
- [x] M4 race start: the race song starts in a 2-bar vamp (Song.vamp) during the intro flyover; on race:countdown 3 the song
  re-phases (SongPlayer.cue) so bar 1 of section A — with its crash — lands on the predicted GO (re-predicted at 2 and 1),
  and a count-in fills the 3 s (pad holds A's first chord, a bigger riser per count step, an accelerating snare roll into
  GO; music/countin.ts). Count stinger has no kick (beep on the key's 5th). Probe (coast): countdown at 3.60 / 4.60 / 5.60,
  A downbeat + crash at 6.596 s, GO event at 6.600 s (4 ms); GO stinger doubles the A chord (no second crash).
- [x] M5 KO money shot: cine:ko start → music −11 dB in 5 ms (Engine.duckMusic) + sub cut at once (band high-pass
  ≈ 154 Hz, τ 4 ms), full bass drop at the peak; ONE sub boom: ko.boom (centred for the player's KOs, on a new
  post-compressor impact bus so the glue comp can't flatten it; Host.boom high-passes any second boom within 0.4 s),
  cine.impact is crack + air only, KO / WRECKED stingers lost their kick + boom, KO crashes are high-passed. Announcer
  lines with priority ≥ 3 fade out the playing bark and block barks until they end (VoicePlayer); the KO's character lines
  (victim's hurt, rival's gloat) wait for cine:ko end. Recorded in game (coast, __br.ko): < 120 Hz the KO boom peaks
  −3.6 dBFS vs −12.2 for the music's kicks (+8.6 dB, was ≈ 3); timeline boom +8 ms, ann_ko at the peak (455 ms), the
  victim's bark at cine end (1302 ms) instead of +9 ms.

## Fix round 2
Critic issues (reviews/audio-r2-music.json, audio-r2-tech.json). [x] = done + verified, [ ] = open. Order:
B1 retrigger → TB boot without audio → T5 split system.ts → TR restart/pause sync → C1 realtime CPU → t1 mute check →
t2 voice pause → t3 trace → t4 WebKit → m2 hysteresis → m1 finish → m5 harmony → m6 cymbals → m4 menu songs → m3 voices → cross-unit notes.
- [x] B1 retrigger (blocker): dsp/env.ts tracks where each envelope-driven param settles (WeakMap: end time + value);
  anchor(p, t) = cancel-and-hold mid-envelope, else setValueAtTime(settled value, t), so every note starts AT its time.
  perc/adsr settle at 0 (adsr's sustain is now a flat ramp, so a retrigger inside it cuts cleanly too); clap / tambourine /
  flute breath / Rhodes + brass steals use anchor + settle; Pad glides only between sounding chords (else sets pitch at t),
  its filter is anchored; Band.fade anchors (+ the reverb sends are now post-fader, so fades take the reverb along);
  side-chain duck, under-lead dip and Engine.duckMusic attack with setTarget (starts from the value at its own time).
  Gates still plug in at scheduling time (safe against main-thread stalls); the VCA is pinned at 0 until the note, so it is silent.
  Regression (src/audio/check-onsets.ts, in audio-check offline): 22 instruments × 2 notes (dry strip), 7 stingers after 5 s
  idle, song stop fade. Fixed: all 150 ms pre-onset windows −200 dBFS (stingers ≤ −98), fade −1.1 dB @100 ms / −5.9 @400 ms.
  With the old begin() restored the same check fails 20/22 instruments (−0.1…−21 dBFS), 6/7 stingers, fade −16.2 dB @100 ms.
- [x] TB no AudioContext (major): preload is async; prepare() wraps context + graph creation in try/catch → one warning,
  `disabled`, returns null; unlock() resolves at once; every method already no-ops without a runtime. Permanent check
  tools/audio-check-robust.mjs (AudioContext throwing / undefined): boots, key → menu, race reachable, 0 page errors (both pass).
  audio-check.mjs split: offline part stays, in-game part → tools/audio-check-game.mjs, robustness → audio-check-robust.mjs.
- [x] T5 split: system.ts is AudioSystem + Host wiring only (355 lines); music/pump.ts = lookahead / stall policy (timer,
  loading → settling → normal, hidden tab, halt), voice/barks.ts = bark choice + distance-faded placement, debug.ts = Trace.
  Host gained place(where). Volumes re-apply from save.onChange only when master/music/sfx/voice changed (t1, system side).
- [x] TR race-start sync (major): attach(session) on the same track with its song already current → Conductor.restart():
  a fresh copy in its vamp from the running song's next bar line (0.3 s crossfade; SongPlayer.stop(fade, at)). Pause
  (external muffle ≥ 0.9) mid-countdown → Conductor.pauseCountdown(): SongPlayer.hold() back into the vamp, goAt cleared,
  so the next count re-cues GO (and re-holds the count-in pad); countdown() also re-cues when a count drifts > 60 ms from
  the prediction. New permanent check tools/audio-check-start.mjs (SongPlayer.starts + Conductor.sync() in state().sync):
  first race / pause → restart / pause 2.4 s at "2" → A starts −9 / −9 / −5 ms from GO, 0 A starts while paused.
  With restart() + pauseCountdown() disabled the same check fails (no vamp after restart; A started inside the pause).
- [x] t2 voices + pause: VoicePlayer.setPaused (from setMuffle ≥ 0.9): barks fade, the queued announcer line is dropped,
  nothing starts until resumed; barks requested while paused are dropped.
- [x] t3 trace: VoicePlayer.play() → 'started' | 'queued' | 'dropped' | 'none'; the trace entry is written by an onStart
  hook when the line really sounds (barks too). Check (audio-check-robust.mjs): ann_ko + queued ann_final → logged at
  0 / +415 ms; paused 150 ms in → ann_final never plays (paused or after resume).
- [~] C1 audio-thread CPU (major, both lenses). Resumed (fixer 2b, 10-18 14:20) from the interrupted fixer's
  tools/audio-check-cpu.mjs (CDP renderCapacity gate, `--cpu`). Profiling (scratch probes in shots/audio/fix2/:
  offline per-node / per-instrument renders, realtime A/B rotations): a running biquad costs ≈ 2 oscillators, a glide
  ≈ 3.5×, nodes that run all the time dominate. Done (each verified offline + in the realtime gate):
  · sfx/cache.ts: every one-shot is rendered once (OfflineAudioContext, 2 takes if < 0.9 s) after its first live play /
    prewarm (UI sounds at unlock, 31 race sounds at attach) → 1 buffer source + gain (pitch = playbackRate, vol = gain:
    identical sound); sounds share pan buses (0.1 steps); MAX_ACTIVE 32 → 24. Rival-burst A/B −22 %.
  · Drums: every hit (kick, snare, rim, toms, clap, hats, shaker, tambourine, ride, crash, cowbell) is a sample built
    once per page (music/instruments/drum-samples.ts + dsp/render.ts: JS biquads / glides, 67 ms at boot) → 1 source +
    gain, no oscillator glides or filter chains; hats / ride / crash gained an 808-style metallic layer, panned hits
    are stereo (m6). Slap-bass string clicks and clav mutes are samples too.
  · Keys: music/instruments/keys-sampler.ts + keys-render.ts — the Rhodes voice is rendered once (10 pitches × 2
    velocities, OfflineAudioContext at boot, async) and each note is 1 source + gain (release at note-off); long notes /
    before the bank exists use the live voices (4 now, bark gated apart). Sampled vs live: ≤ 0.3 dB in every band.
  · Bass 3 oscillators → 1 mixed wave (dsp/curves.ts mixWave), gated, strip EQ folded into the filter settle; brass 4
    saws / voice, no panners; clav double-stops (guide tones), no high-pass; undriven strips use the input as fader;
    one shared vibrato LFO per band; muffle LPs and the KO bass-drop HP are switched in only while active
    (dsp/switch.ts, 20 ms crossfade); bike-loop rates k-rate, chain high-pass dropped.
  · Reverb: the interrupted fixer's delay-line network cost 0.8 % of the audio thread (rotation A/B: delay 1.30 %,
    convolver 0.53 %, none 0.47 %) — Chromium runs a ConvolverNode's FFT work on a background thread. Back to a
    1.1 s stereo convolution plate fed in mono (level matched), dsp/reverb.ts removed.
  · Mix re-balanced (the B1 fix had removed the persistent voices' pre-onset energy, mostly hats, so the offline gate
    failed): noise hits +3.5 dB (cymbals +5.5) over the old voices, kick 0.95 → 0.76, lead 0.85, bass 0.6, clav 2.4,
    pad 0.45, per-song trims (title / coast / city / mountain / results `mix`), coast intro chords sustained. Offline gate
    green: lead −3.5…−4.2 LU, bass −7…−9.7, low 31–39 %, hooks +3.1…+6.2 dB (mountain sits near every edge).
  Realtime gate (load ≈ 7–12, before the convolver): menu 3.7–4.2 / 5.1–8.1 %, race 5.0 / 7.8–8.0, pack 6.3 / 8.4,
  stretch 6.1–6.6 / 9.2 (critic r2 at load 7: race 8.0 / 10.5, stretch 10.1 / 14.8). Next: re-measure with the plate.
- [x] t1 mute check: audio-check mutes through app.save.update (as the settings screen does), adds an unrelated save, and
  restores the saved master afterwards; system side re-applies volumes only on volume edits → −180 dBFS, check green.
- [x] t4 WebKit: prepare() sets ctx.onstatechange → suspend() whenever the context starts running before unlock (removed on
  unlock). audio-check-robust.mjs (WebKit): 'suspended' before the gesture, live after; without the handler: 'running'.
  In-game suite after the refactor: all 31 game checks green (mute −180 dBFS across an unrelated save).
- [x] m2 top-3 layers: watcher.ts follows a new place only after it held 2 s (TOP3_HOLD; the final stretch applies at once),
  SongPlayer.setIntensity applies 0 ↔ 1 on the next 2-bar line (pendingLevel at section step % 32) with a 0.6 s band fade.
- [x] m1 finish: once the player has finished (phase or mode 'finished') the watcher stops steering, so the stretch form /
  key lift / intensity 2 hold until the results crossfade; race:finishLine → 'finish' fanfare + ann_place1–3 on the podium,
  'finishLow' (bVI → V → quiet minor tonic + sagging wah) + ann_finish for 4–8; the results song opens on its gospel B
  section after a finish outside the top 3 (or a DNF), from its fanfare intro on the podium.
  New permanent check tools/audio-check-adaptive.mjs (in audio-check --game; pins the player's place / progress / mode):
  3 ↔ 4 every 0.9 s → layer never on; 3rd held → off at 1.5 s, on at 3 s, applied at section step 96 (2-bar line);
  stretch form "B2 A4" / intensity 2 unchanged 6 s after the finish; finishLow + ann_finish for 6th, finish for 1st;
  results open on B after 6th, on the intro after 1st — all green.
- [x] m5 harmony nits: menu A2 bar 6 / B bar 5 Ab5 → A5 (the 9th the Gm7b5 voicing holds); city A4 bar 8 ends B5–Ab5 over
  Db7#11 (no C6 = maj7 over the dominant); title A2/A3 bar 6 G–E–C#–C–A (no F5 over A7#9) and B bar 6 G–E–C#–Bb (no F5
  over A7b9). Reviewer harmony.mjs (copy: shots/audio/fix2/harmony.mjs): those flags are gone; what remains are
  intended 13ths / lydian #11s and passing 16ths.
- [x] m3 voices (TTS API reachable 10-18 20:05): tools/gen-tts.mjs now squeezes inner pauses to 0.15 s, speaks "……" as
  "…", time-compresses (atempo, pitch kept) any take over 2.4 s, RMS-matches clips under 0.6 s to −16 dB (no loudnorm
  short-input boost; limiter without auto-level), sloth speed 0.5 → 1.0, pigeon 1.15, and adds each character's first
  4 taunts / 2 KO / 2 hurt lines from src/data/roster.ts that had no clip (stage directions dropped, all-caps words read as
  words). 92 clips (was 66), 1.4 MB: every clip 0.28–2.39 s (sloth 1.3–2.4 s, was 3.3–7.3), countdown 三二一冲 −16…−16.7 dB
  RMS (was −10.7 / −13.9) vs −15.5…−17 for the set; src/data/voice.ts regenerated. 26 new bark lines for 10 characters.
- [x] m4 menu songs ≥ 2 min: title / menu / results rewritten as A–A2–B–A3–S–D–B2–A4 loops: title 64 bars = 2:02, menu
  64 = 2:08, results 64 = 2:06 (were 61–64 s). Every section has its own 8-bar bass line (title: A slap line, A3 16th dead
  notes, B legato walk with slides — was one bar × 8 —, B2 8th pops, S Dorian vamp, D long notes → octave build; menu:
  walking lines A / A2 (approach notes) / A3 (ghosted 16ths), B two-feel → walk, S four-to-the-bar, D whole notes → 16ths;
  results: one-chord / ii–V bar shapes, A3 dead notes, B gospel walk, S I–IV7 vamp), new comp / clav / brass per section,
  a solo on a second lead voice (title synth, menu synth, results wah), a breakdown + build, an A4 with a new last bar and
  3 rotating fills each. harmony.mjs: no sustained / on-beat clash left in menu or results (title keeps the old 16th
  passing C over Eb7#11). Offline: title peak −2.7 / −1.6 at the seam, menu −3.9 / −3.7, results −2.2 / −1.9, 0 clicks,
  leads −3.7 / −3.9 / −3.8 LU, low 37 / 31 / 33 %. Arrangement notes: Songs section above (= each song's `notes`).
- [x] m6 cymbals: hats / open hat / ride / crash = six squares at 808 metal ratios (band-pass + high-pass) blended with the
  noise sizzle, ride bell = three inharmonic partials (3.29 / 4.63 / 6.1 kHz), panned hits are decorrelated stereo takes,
  the music plate is a stereo convolution (decorrelated L / R IRs) — fixer 2b; cymbals +1.5 dB (fixer 2c). Not done:
  velocity-dependent decay (samples scale level only) and 44.1 / 48 kHz (kept at 32 kHz for the CPU budget).
- [x] m7 / t6 cross-unit → core requests (below; not audio's files). Audio side: achievement:unlock already plays ui.unlock,
  skill / SHOWTIME cut-ins and the KO slash are audio-driven; the pause opens with ui-screens' own ui.cutin slam.
- Fixer 2c (10-18 17:50) resumed: tsc clean; offline gate 1 fail (race-mountain lead −3.4 LU after the last level shifts);
  realtime gate (load 7.3) menu 3.8 / 7.6, idle 1.9 / 3.0, race 6.0 / 9.0, pack 7.2 / 10.5, stretch 7.0 / 9.3, sfx only 3.3 / 8.2.
  m1 / m2 are already in code (watcher TOP3_HOLD + frozen once finished, SongPlayer 2-bar pendingLevel, finish / finishLow,
  results consolation start) but unverified. Plan: C1 part breakdown + cuts → mountain mix → verify m1 / m2 (new check) →
  content req 9 (player barks) → m4 / m3 / m7 if time.
- C1 (fixer 2c) breakdown in a race (rotation A/B, shots/audio/fix2b/probe-*.mjs): idle engine 0.65 % (comp + clip + plate
  ≈ 0.35), sfx one-shots ≈ 0.25, bike loops ≈ 1.5 (load 17), music ≈ 3–3.8 (all voices together; no single channel
  dominates: offline min-of-5 per instrument at i2: drums 21 %, keys 10, lead 8, clav 8, bass 6, brass 4, pad 3 of the render).
  Cuts: · bike wind / chain / roll = pre-rendered loops (sfx/loop-buffers.ts, JS biquads, built at boot) rate-shifted with
  speed: 1 buffer source + gain each instead of stereo noise → biquads (+ AM osc); offline A/B vs the old chains: wind / roll
  within 0.4 dB in every octave band, chain level-matched at 15 m/s (its band now rises with cadence).
  · persistent-voice oscillators k-rate frequency (voice.ts osc()): offline render −10 %. · wah / square lead = one
  oscillator with the saw + square pair's power spectrum (dsp/curves.ts layerWave) instead of two.
  · short comping Rhodes chords (≤ 0.6 s) pre-mixed from the note samples into one buffer (LRU 64): 1 source per chord.
  · cymbals +1.5 dB (top-end air, m6) — gives the leads LU margin; mountain mix lead 0.68 → 0.67.
  Offline gate green (mountain lead −3.6 LU, low 39 %, hook +3.1 dB: still near the edges). Realtime (load 13–19!):
  race 5.4 / 8.4, pack 8.2 / 9.8, stretch 6.5 / 9.8, sfx only 2.9 / 5.1 (critic r2: race 8.0–10.8 / 10.5–16.1).
  Final gate runs (p50 / p90 %): load 11 → race 5.4 / 7.9, pack 6.4 / 9.1, stretch 6.1 / 9.0; load 17–20 → race 6.1 / 8.1,
  pack 8.4 / 10.6, stretch 6.5 / 9.0; load 28 → 8.9 / 13.7 (the meter scales with machine load; a 32 kHz oscillator
  control reads 0.1–0.6 %). STILL OPEN: ≈ 0.5–1 % over the race p50 budget and over p90 in pack / stretch on this
  shared machine. Next levers if needed: chord-level caches for brass stabs / pad chords (render once per voicing like the
  keys), drop the per-sound gain for unity-volume one-shots, re-measure on an idle machine.
- [x] content request 9 (player barks): the pelican's voiced lines now play — at most one line per 6 s is its own on a KO it
  is part of (pelican_ko_0/1 when it wins, pelican_hurt_0 when it is knocked out; released at the cinematic's end, first,
  so the bark gap drops the rival's line), and a bell that angers a rival is followed by a pelican taunt (pelican_taunt_0/1,
  8 s cooldown). audio-check-game: "player KO → pelican_ko_1", "bell → bike.bell + pelican_taunt_0" (green).
- ui-hud's old note ("h.isPlayer is not a function") is stale: Host.isPlayer exists since round 1; no such error in any run.
- Fixer 2c wrap-up (10-18 21:10): tsc clean; `node tools/audio-check.mjs` offline + game suites green (the bell-taunt check
  was made load-proof — cooldown / bark gap reset, waits for the bark — and re-run green); CPU part = warnings only (machine
  load 17–28, the gate does not fail when loaded); in-game state live, 0 __br.errors (shots/audio/fix2b/
  race-coast.jpg, lab-title.jpg). Scratch probes for this round: shots/audio/fix2b/*.mjs.

## Fix round 3
Critic issues (reviews/audio-r3-music.json = M0–M7, audio-r3-tech.json = T0–T4). [x] = done + verified, [~] = improved, still
open, [ ] = not audio's files. Scratch probes / logs: shots/audio/fix3/ (probe-*.mjs, tone.mjs, check-full-*.log).
- [x] T1 + M4 held barks: VoicePlayer.cut() ends the cut line's busy time at the fade (now + 0.07 s) and a separate
  `barkGate` (earliest next bark: bark end + 1.3 s gap, or a loud announcer line's end + 0.25 s) replaces busy.bark + GAP,
  so a bark silenced by ann_ko / pause no longer blocks anything. Lines held for a KO cinematic's end pass `wait` 1.2 s
  (Host.bark(…, wait) → Barks.say → VoiceOpts.wait): instead of 'dropped' they take the one waiting slot and start when
  the gate opens (placed where the speaker is then; first come keeps the slot, so the pelican's line still pre-empts the
  rival's). The pelican's own lines outrank rival barks (priority 2 cuts a playing rival line; the loud-announcer block
  and the bark gap are tracked apart). Clips prefetch 4 at a time, announcer → pelican → rivals. New permanent check tools/audio-check-barks.mjs (in
  audio-check --game): long sloth bark cut by ann_ko → pelican_ko_1 +0 ms after cine end; repeat KO (516 ms cinematic) →
  capybara_hurt +319 ms; player wrecked (493 ms) → pelican_hurt +460 ms. With HELD_WAIT 0 the last two FAIL (no bark).
- [x] T4: createContext() throws at once when AudioContext is undefined and retries without the 32 kHz rate only for a
  NotSupportedError; audio-check-robust asserts 0 "32 kHz" warnings in the no-constructor case (green).
- [x] T2 + an honest gate: tools/audio-check-cpu.mjs takes the weapon ids from src/data/weapons.ts (9, was a non-existent
  'fish'), fails on any '[audio] unknown' warning, and samples a control tab (one 32 kHz oscillator, second browser
  context) with every phase: an overrun FAILS while the control reads < 1 %; loadavg no longer excuses anything.
- [~] T0 / M1 audio-thread CPU. Method: paired A/B in a quiet page (toggle a part every 3 s, 8–12 pairs, mean ± s.e.).
  Measured: convolution plate +2.17 ± 0.10 % vs the new loop reverb +0.75 ± 0.08 %; a resampling buffer source ≈ 2.2× a
  unity-rate one (+0.30 vs +0.14 %); the pack burst's sounds +2.8 ± 0.5 % with random pitch, +0.6 ± 0.1 % without; any
  feedback loop renders while connected; Haas widener +0.16, lead echoes +0.25, panner +0.04, keys auto-pan +0.13,
  biquad +0.09 %. Changes: · music reverb = dsp/plate.ts (12 ms pre-delay → Σ → 16 ms truncated Schroeder allpass chain
  as a mono ConvolverNode, peak-normalised → 4.8 kHz damping → × 0.73 → 21 ms loop delay; L after the diffuser, R one loop
  later: corr ≈ 0, RT60 ≈ 0.9 s), tail 1.5 dB over the old plate's; unplugged 4 s after the last music (Engine.keepReverb
  / tick). · drums: one pre-mixed stereo buffer per bar (drum-mix.ts, DrumKit.record / flush / cut, SongPlayer.drumBar;
  same samples, takes, levels, pan law, open-hat choke). · note banks (bank.ts: the live voice rendered per pitch zone /
  velocity / articulation in one OfflineAudioContext at boot, prepareSampleBanks in banks.ts) + JS pre-mix (premix.ts:
  resample, bend-in, equal-power pan, release at the note-off) → one buffer source at rate 1 per chord / note for keys
  (every chord ≤ 2 s), pad (16 kHz bank, voices ±0.6), clav and bass (+ its string transient; monophonic: a gain closes
  the previous note in 6 ms). Solo A/B vs the live voices: pad −0.30 ± 0.06, bass −0.28 ± 0.09, clav −0.14 ± 0.09 %;
  brass measured no cheaper (its voices sleep between stabs) and stays live. Banks ≈ 18 MB (keys 6, bass 7.3, pad 3.6,
  clav 1.7). · lead2 octave doubles inside the lead voice (Lead sub oscillator). · sfx: short sounds render three takes
  with a baked ±3 % pitch, heavy hits a baked 0.9 variant; cached takes play at rate 1; caps 24 → 16 voices, 4 → 3 per id.
  · bike loops: wind / roll filter the shared noise (the wind loop was stereo + resampled), parameters move ≤ 25 Hz with
  exact ramps (a playbackRate steered towards 1 never reached it and kept resampling). Gate (p50 / p90 %, control
  0.3–0.4 %): baseline menu 4.85 / 8.63, race 5.78 / 7.76, pack 6.97 / 9.31, stretch 7.09 / 9.14. Now at load 6–9: menu
  2.6–3.1 / 3.4–7.1, race 4.1–4.7 / 5.6–6.4, pack 4.7–5.4 / 6.2–7.3, stretch 4.5–5.7 / 5.5–7.4; at load 17–21 race
  5.2–5.7, pack 6.0–6.9, stretch 5.3–6.7 → the gate passes at moderate load and still FAILS on a busy machine (a heavier
  reference graph in another tab does not inflate like the game page, so the control cannot excuse it). Still costing:
  loop reverb 0.75, glue comp 0.33 (it adds ≈ 2.7 dB make-up gain and ≈ 3 dB of peak control: kept), lead voice ≈ 0.25,
  bike loops 0.35 %. Next levers: sampled lead, keys auto-pan baked into the pre-mix, fewer engine gain stages.
- [x] M0 tonal balance (loop level, src/audio/check-tone.ts; dB vs the 125 Hz octave). Kick re-rendered (body 150 → 56 → 47
  Hz, holds ~35 ms, rings out over 0.42 s); side-chain 0.42 → 0.3; lead 0.85 → 0.45 with the wah sustain Q 3.8 → 2.2 and
  settle 1250 → 1700 Hz, flute partials 0.12 / 0.04 → 0.3 / 0.12; comping + horns dip −7.5 dB under lead notes (horns on
  their own un-ducked under-lead gain); hats −5 dB (10.5 kHz sizzle peak +6 → +3 dB), ride / crash −3 dB, tambourine
  −2 dB; the bike loops gave the hook's band back (wind centre 250 + 1100·v/20 Hz, wind −2 dB, roll −1.7, chain −2);
  per-song trims (mountain lead 0.93, keys 0.92, bass 0.74, brass / pad up). Coast before → after: 63 Hz −2.5 → +0.2,
  1 kHz −0.5 → −6.1, 8 kHz −4.5 → −10.1; all six songs: 63 −0.2…+0.4, 1 kHz −6.0…−7.5, 8 kHz −10.1…−14.3. Hook over the
  rest of the music + bike at 20 m/s (A2): coast +5.4, city +4.1, mountain +3.1 dB (gate ≥ 3). Peaks −1.28…−6 dBFS, 0
  clicks. audio-check: the lead-LU and r1 "60–150 Hz ≤ 40 %" gates are replaced by loop tone gates (63 Hz −1…+3, 31.5 Hz
  ≤ −4, 1 kHz ≤ −6, 8 kHz ≤ −10; the r3 target spectrum puts ≈ 51–56 % of the energy below 150 Hz by design); bass stem
  window −11…−5 LU. Mountain sits on several edges at once (1 kHz −6.0, hook +3.1, width −11.6).
- [x] M2 stereo: pad voices pre-mixed ±0.6, horns panned +0.4, clav −0.55, keys auto-pan depth 0.32 → 0.85, hats 0.28 →
  0.36, drum / clav reverb sends 0.11 → 0.15, lead send 0.29 → 0.38, a decorrelated reverb. Width above 200 Hz (the low
  end stays mono): −8.9…−11.9 dB S/M (coast −11.1, was ≈ −15). Full band −13.1…−16.6 dB (coast −15.8, was −12.8) with
  correlation 0.91–0.96: the louder mono kick / bass M0 asked for dominates full-band energy, so the critic's −10 dB
  full-band target conflicts with M0. Gate: S/M above 200 Hz ≥ −12 dB.
- [x] M3 macro-dynamics: Section.gainDb / shape (types.ts, compile.ts) → Band.section() at each section start, on a
  section gain + a low-pass switched in only during a breakdown: every D is `shape: 'breakdown'` (bars 1–4 −6 dB behind
  900 Hz, bars 5–8 climb in even dB steps to +2 dB as the filter opens to 14 kHz), A −3 dB (lighter opening), B2 +2 dB.
  D bars 1–4 now −7.5…−8.7 dB under B2 (was −1.3…−3.5), builds rise bar by bar, LRA 4.1–5.1 LU (was 1.6–3.5). Gates: D
  drop ≤ −6 dB, rising build, LRA ≥ 4 LU. Drum lanes moved to music/groove.ts (player.ts 371 lines).
- [x] M5 groove: city hook bars 1 / 3 / 6 and mountain bars 1 / 3 / 5 / 6 push a note per bar onto the 'a' of a beat
  (e.g. city bar 1 'G5 - Bb5 - C6 - . Eb6 - D6 - C6 Bb5 - G5 -'); lead2 follows; reviewer harmony.mjs flags unchanged.
  Lead legato glide: a note starting ≤ 60 ms after the last one ends (≤ a fifth away) slides from its pitch in 35 ms.
  Coast H1 hats 'xxOxxxOx…' → 'XoOoxoOoXoOoxoOo'.
- [x] M6 voices (TTS API reachable 10-19 03:55): gen-tts voices every roster taunt (KO / hurt lines: first 3) and matches
  every clip's active-speech RMS (20 ms frames above −50 dB, decoded PCM) to −16 dB after loudnorm / trim (WAV in
  between, one MP3 encode, limiter −2 dBFS). 181 clips (was 92), 105 of 109 roster taunts voiced (was 34; the rest are
  叮 / letter-less), 3.1 MB, active RMS −17.5…−14.5 dB (median −16.2); 三 / 二 / 一 / 冲 −16.4 / −16.4 / −16.1 / −16.5 (was
  −13.4 / −13.6 / −12.8 / −13.1); peaks ≤ −1.4 dBFS; src/data/voice.ts regenerated.
- [x] Requests to audio in other status files: content #7 / core "regenerate barks for content's new roster lines" — done
  (M6: every roster taunt + the first 3 KO / hurt lines voiced); content #9 (player barks) — done in round 2.
- [ ] M7 / T3 cross-unit: race/police.ts still calls app.audio.sfx('traffic.horn.police' / 'police.whistle' / knock);
  the request under "Core requests" stands (police:whistle event + knocks via combat:hit).
- Verification (10-19 06:10): tsc clean; `node tools/audio-check.mjs` offline + game + start + adaptive + barks + robust
  green (check-full-3.log + the bell / barks / robust re-runs after the bark-priority fix: with every taunt voiced, a
  rival bark had taken the channel before the pelican's bell taunt); in game 0 __br.errors, race mix peak −3.3…−4.1 dBFS /
  rms −19.7…−20.1 (shots/audio/fix3/race.jpg, lab.jpg). CPU part of that run: menu 2.31 / 3.09, race 5.53 / 7.40,
  pack 5.58 / 6.56, stretch 5.00 / 6.30 → race / pack p50 FAIL (T0 stays [~]).

## r3 polish (2026-10-25)
Polish round r3 against reviews/audio-r3-music.json + audio-r3-tech.json, measured on the Windows box (Ryzen 9 5950X,
Chromium/D3D11). Probes, renders and logs: shots/r3-audio/ (render-loops.mjs + analyze.py = octave bands vs 125 Hz,
tilt, LUFS, LRA, S/M, clicks; probe-*.mjs realtime / capture probes; full-2.log).
- [x] CPU (music #1, tech #0/#2): the music now plays from bars rendered ahead (music/bars.ts): each bar is
  sequenced into a fresh Band on its own OfflineAudioContext (same instruments, side-chain, sends, delay, reverb;
  notes are mixed by the render thread via premix.playMix, no JS pre-mix) and plays as one buffer into the song's
  realtime band (`out` → KO high-pass); the live graph is unplugged ~2 s later. Live only: race vamp + count-in,
  race loads (3 s lookahead), each song's first bar, offline analysis renders. Bars are sequenced in 1.5 ms
  main-thread slices. Capture check (worklet tap): bar-rendered = live path within 0.1 dB per octave, RMS +0.01 dB,
  0 ± 1 sample per bar, 0 clicks. Also: tunnel convolver (stayed plugged forever after the first tunnel, ≈ 2.5–3 %)
  → gated loop reverb matched within 1.5 dB; siren = pre-rendered loop; reverb / live tails 2.5 / 2 s; sfx cap
  16 → 12; every race sound prewarmed at race start (96 sounds, 105 s ≈ 13 MB, done 3 s into the intro: first
  plays had synthesized whole graphs live — 8–33 % spikes). Gate (p50 / p90 %, control tab 0.23–0.45 %): before
  menu 3.14 / 4.25, race 6.72 / 9.81, pack 10.03 / 13.02, stretch 8.64 / 11.56, sfx-only 3.60 / 7.34 → after
  (final code, 4 runs) menu 1.26–2.37 / 1.60–3.63, race 2.57–3.05 / 3.39–4.82, pack 2.92–3.70 / 4.85–6.60, stretch
  2.39–3.05 / 3.27–4.99, sfx-only 2.03–2.28 / 2.71–3.94. Main thread: 5.5–6.1 ms per s of music, max 9 ms per call
  (live path 7.9 ms/s, max 12.6). Final `node tools/audio-check.mjs` (shots/r3-audio/full-3.log) exit 0.
- [x] Tone (music #0), octaves vs 125 Hz, base → now: coast 250 −8.5 → −6.5, 1k −6.1 → −6.7, 2k −7.9 → −9.1, 8k
  −10.1 → −12.5 (bumpiness 2.1 → 1.4 dB); city 250 −7.5 → −6.0, 4k −12.1 → −14.3; mountain 250 −8.3 → −6.1, 8k −12.9
  → −14.8; title 1k −7.4 → −8.4; results 250 −6.8 → −4.6. Stretch layer 1k: coast −1.4 → −5.1, city −3.5 → −6.1,
  mountain −2.2 → −4.9. In-game composite (music + bike loops, 20 m/s): 1k −7.2 → −7.8, 2k −7.8 → −9.8, 4k −8.1 →
  −11.0, 8k −9.1 → −11.6. How: warmer slap bass (filter settles f·3 + 170 Hz, Q 3.5), keys +3.4 dB, pad +8 dB with a
  1 kHz top, a −4 dB / 1.1 kHz dip on the comping bed, lead −1.6 dB (a further −2.5 dB in the stretch), fatter snare
  body / tamer wires, clap 1150 → 1500 Hz Q 0.7 −2.4 dB, cowbell −7.5 dB, hats / ride / crash / shaker / tambourine
  −1.3…−2.1 dB, stretch hats accented; bike wind ≈ 370 Hz at race speed (was ≈ 1.3 kHz), chain −5 dB, roll band-passed.
  New gate: race songs' stretch tone (1 kHz ≤ −4, 8 kHz ≤ −8).
- [x] Width / dynamics (music #2/#3): brass in two pairs (±0.3), Haas width send on lead + horns, louder pad bed:
  S/M above 200 Hz −8.6…−11.5 → −7.1…−9.7 dB, correlation 0.91–0.96 → 0.86–0.93; breakdown −8 dB, A sections −4.5 dB:
  LRA 4.1–5.1 → 4.4–5.7 LU, D bars 1–4 −6.9…−9.4 dB under B2, builds rising.
- [x] Voices (tech #1, music #4/#6): cut() fix was in; the 1.3 s bark gap no longer blocks a line that outranks the
  last bark, and the pelican's held line takes the waiting slot over from a rival's (an AI-vs-AI KO had taken it).
  Countdown words measured −16.1…−16.5 dB active RMS vs the set's −16.2 median (already matched).
- [x] Police (music #7, tech #3): police:whistle / police:knock / police:horn are placed and rate-limited (knock
  'none' = hit.none + bike.bump); new hit.baton; unknown weapons fall back to hit.none.
- Tools: every audio-check-*.mjs runs standalone; the WebKit case is skipped when that WebKit has no WebAudio
  (Playwright WebKit on Windows); KO-quip case starts from a clean slate (the race's own fights could hold the line).
