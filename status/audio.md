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
- CPU: frequent instruments are persistent voices (only pitch / filter / VCA automated per note) that unplug when silent;
  k-rate filters / vibrato; strips and instruments created lazily; sfx voice limits (32 total, per-id caps) steal the
  quietest sound first. Offline net render cost per song 1.7–3.4 % of one core (busiest = final-stretch layer) measured on
  a heavily loaded shared machine; bike loops + sfx add < 1 %; main-thread scheduling 0.6 %.

## Songs (critics can't listen — arrangement notes)
- **title** — "BEAK RASH! (Main Theme)" · 126 bpm · D Dorian · lead wah · form [intro, A, A2, B, A3] (loops back to A)
  D Dorian funk at 126 bpm, 16th swing 0.10. Intro: Rhodes + pad + vinyl crackle, reverse-cymbal swell and tom fill. A (8): Dm9–G13 Dorian vamp ×2, Bbmaj7–A7#9, Dm9, Eb7#11 (tritone sub of A7) turning back to Dm9. Slap bass thumb/pop octaves with dead notes, ghost-note snare, open hat on the & of 4, syncopated Rhodes comp, brass punches on bars 4/8. A2 adds the wah-lead hook (call A–D–F–E–D / answer B–A–G–E–D, climbing to C6, bluesy C over A7#9) + clavinet chops. B (8, bridge): ii–V–I in F (Gm9–C13–Fmaj9–Bbmaj7) then minor ii–V to Dm (Em7b5–A7b9–Dm9) and Bb13–A7#9 turnaround; half-time ride feel for 4 bars, then full groove, lyrical counter-melody, brass swells, rip + fall into A3. A3: hook doubled an octave down, busier brass answers, shaker/tambourine. Loops A→A2→B→A3.
- **menu** — "Hideout Café" · 120 bpm · F minor / Ab major · lead flute · form [intro, A, A2, B, A2] (loops back to A)
  Lounge acid jazz for the menus, 120 bpm, heavy 16th swing (0.24), vinyl crackle. A (8): the circle progression Fm9–Bbm9–Eb13–Abmaj9–Dbmaj9–Gm7b5–C7b9–Fm9 (vi–ii–V–I–IV–vii–III7–vi in Ab). Rim-click backbeat with ghost notes, soft kick, 8th hats, shaker on the &s, walking-ish legato slap bass (1–5–8–7–5–3), sustained Rhodes comping. A2 adds the breathy flute melody (C6 down to G5, answered over Bbm9, a b9 Db6 over C7b9). B (bridge): Bbm9–Eb13–Abmaj9–Dbmaj7#11 then Gm7b5–C7alt–Fm9 and a Gb7#11 tritone-sub back to Fm9; ride cymbal, warm pad, soft brass swells, flute counter-line. Loops A→A2→B→A2.
- **race-coast** — "Sunny Side Sprint" · 128 bpm · A major · lead wah · form [intro, A, A2, B, A2] (loops back to A)
  Sunny disco-funk, 128 bpm, light swing 0.08, A major. A (8): Amaj9 | Bm9–E13 | Amaj9 | C#m7–F#7#9 | Bm9 | Dmaj9–Dm6 (minor plagal colour) | C#m7–F#7alt | Bm9–E13 (ii–V home). Four-on-the-floor kick, ghosted backbeat, 16th hats with open hats on the off-beats, syncopated slap bass (root–octave pop–5–6), off-beat Rhodes, clavinet chicken-scratch, brass punches every other bar. A2: wah-lead hook (E–C#–E–F#–E … climbing to D6, bluesy A over F#7#9). B (chorus): Dmaj9–E13–C#m9–F#m9–Bm9–E13–Amaj9 + Bb7#11 tritone sub back to A; anthemic lead, pad, brass riff. Adaptive: top-3 adds shaker + tambourine; final stretch jumps to B→A2 at the next bar with a crash, 16th shaker, claps and the hook doubled an octave down.
- **race-city** — "Neon Pursuit" · 124 bpm · C minor · lead flute · form [intro, A, A2, B, A2] (loops back to A)
  Night acid jazz, 124 bpm, swing 0.14, C minor. A (8): Cm9 | Fm9 | Cm9 | Ab7#11–G7#9 | Cm9 | Fm9 | Dm7b5–G7b9 (minor ii–V) | Cm9–Db7#11 (tritone sub of G7 back to Cm9). Broken-beat kick, ghost snares, 16th hats with open hats on the & of 1 and 4, slap bass with octave pops and b7 runs, Rhodes comp, brass punches on bars 4/8. A2: flute hook rising G–Bb–C–Eb–D, Ab7#11 colour (D = #11), bluesy B–Bb–G over G7#9; clavinet chops. B (bridge): Abmaj9–Gm7–Fm9–Bbm9/Eb13–Abmaj9–Dbmaj7#11–Dm7b5–G7alt with ride, pad and brass swells. Adaptive: top-3 adds 8th shaker; final stretch jumps to B→A2 with tambourine/claps and the hook doubled an octave down.
- **race-mountain** — "Sunset Switchbacks" · 130 bpm · A Dorian · lead wah · form [intro, A, A2, B, A2] (loops back to A)
  Driving sunset rock-funk, 130 bpm, nearly straight (swing 0.04), A Dorian. A (8): Am9 | Fmaj9 (lydian #11 in the melody) | G13 | Em7 | Am9 | Fmaj9 | Dm9–G13 | Cmaj9–E7#9 (V7#9 back to Am). Kick on 1, &2, 3, &4, backbeat with a ghost before 4, 8th hats, straight-8th octave slap bass, half-note Rhodes, brass hits on 1/& of 2/3. A2: soaring wah hook (A–G–E–G–A–C, B over Fmaj9, climbing D–E–G–A–B–D over G13). B (bridge): Dm9–G13–Cmaj9–Fmaj7#11 then minor ii–V Bm7b5–E7b9–Am9 and Fmaj7#11–E7alt turnaround; four-on-the-floor, ride, pad, brass swells and rips. Adaptive: top-3 adds quarter tambourine; final stretch jumps to B→A2 with 16th hats, claps, shaker and octave-doubled hook.
- **results** — "Victory Lap" · 122 bpm · F major · lead synth · form [intro, A, A2, B, A2] (loops back to A)
  Results / victory lap, 122 bpm, swing 0.16, F major. Intro: brass rip + crash fanfare and a tom fill. A (8): Fmaj9 | Em7–A7#9 | Dm9 | Cm9–F13 (ii–V to IV) | Bbmaj9 | Bbm6 (minor plagal) | Am7–D7b9 | Gm9–C13 (ii–V home). Shuffled kick/ghost-snare groove, slap bass 1–5–8–5–3–5–6, Rhodes comp, brass punches. A2: bright synth-brass melody (A–C … C#–C over A7#9, Db over Bbm6) + shaker/tambourine. B (gospel bridge): Bbmaj9–C13–Am7–Dm9–Gm9–C9sus–Fmaj9 with a Gb7#11 tritone sub turnaround, claps on 2 & 4, pad, brass swells. Loops A→A2→B→A2.
- **Stingers**: count (880 Hz beep + kick), GO (beep + E6/9 brass fall + crash), KO (Dm stab → Dm(b13) fall, boom, low tom),
  SHOWTIME (tom roll + rising A → B → C# brass rips into Dmaj9 hit + synth A5 + crash), BUSTED (sad wah Bb–A–Ab–G),
  FINISH (tom pickup, Bb → C → Dmaj9/E fall + D6 lead), WRECKED (Fm fall + boom), ONE MORE (G → A rip + clap).
- Mix: kick side-chains bass / keys / pad / clav; bass driven + high-passed at 32 Hz; music reverb 1.5 s plate-ish IR;
  dotted-8th band-passed delay on keys / clav / lead; keys 8th-note auto-pan. Peaks −1.9…−4.2 dBFS, RMS ≈ −15…−17 dB.

## Known issues / gaps
- Can't be judged by ear in this environment: timbres were tuned by spectrum / level analysis only.
- Voices exist only for the lines generated (see tools/gen-tts.mjs LINES); new roster lines fall back to animal calls
  until `node tools/gen-tts.mjs` is rerun (needs IOA VPN; skips existing files, --force regenerates).
- Offline CPU numbers are wall-clock on a shared machine (load-aware: warnings instead of failures when loaded).

## Core requests
- (done by core) `AudioSystem.attach?(session)` is now called by game.ts; AudioRuntime implements it (window.__br.session()
  remains only as a fallback before the first attach).

## How to test
- `node tools/audio-check.mjs` — offline (every song 20 s + loop seam + final-stretch layer, 8 stingers, 98 sfx: peak < −1 dBFS,
  0 clipped, 0 clicks, 0 dropouts, CPU) then in-game (nothing before unlock, countdown, loops, mix peak, 11 event→sound
  mappings within one frame, KO cinematic muffle / bass drop / voice, pause, mute, screen music, no errors).
  `--offline`, `--game`, `--only race-city`, `--sfx --verbose`.
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
