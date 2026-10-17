# Unit: audio (audio/) — wave 1
Read SPEC.md first (§0–2, §11 is your spec, events in core/events-map.ts). You own `src/audio/**`,
`public/assets/voice/**`, `src/data/voice.ts`, `tools/gen-tts.mjs`, `sandbox/audio.*`.
Contract: `createAudio(app) → AudioSystem` (+ optional preload that fetches voice mp3s lazily).

## Deliverables
1. Engine: AudioContext created lazily; `unlock()` resumes it (browsers need a gesture); buses
   (music/sfx/voice → compressor → master) with volumes from app.save settings; `setMuffle` (low-pass +
   duck) used during slow-mo (listen to cine:ko / cine:ult and clock scale) and pause; voice ducks music.
2. Procedural ORIGINAL music (`audio/music/`): lookahead scheduler; instruments built from oscillators,
   noise, FM and filters (slap bass, FM Rhodes chords, swung drums, brass stabs, wah lead, vinyl crackle);
   songs as pattern data (sections A/B, fills): title, menu, race-coast (sunny funk), race-city (night acid
   jazz), race-mountain (driving), results; adaptive layers (final stretch / top-3 intensity; muffled
   during slow-mo); stingers (countdown beeps, GO, ko, showtime, busted, finish). Musical quality
   matters: real chord progressions (ii–V–I, minor 9ths, tritone subs), grooves with swing and ghost
   notes, catchy hooks, proper mixing (no clipping, kick/bass balance). P5-inspired energy, original notes.
3. SFX (`audio/sfx/`): everything in SPEC §11, synthesized; speed-linked loops for the player's bike
   (chain whirr, freewheel ticks when coasting, wind), surfaces; rival sounds panned/attenuated using
   positions (project via camera or track space); event-driven auto-triggers from the bus (combat:hit
   by weapon, ko, crash, land, drift, boost, skill casts per id, pickup, police siren loop, traffic honk,
   countdown) — the rest of the game should not need to call sfx() for gameplay sounds. UI calls
   `sfx('ui.move'|'ui.confirm'|'ui.back'|'ui.cutin'|'ui.coin')`.
4. Voices: `tools/gen-tts.mjs` generates Chinese lines via the internal TTS API (SPEC §11; try voice_id
   values for a hype announcer and fun character barks; skip gracefully if the API is unreachable),
   writes `public/assets/voice/<id>.mp3` + `src/data/voice.ts` manifest. Play announcer lines on events
   (countdown, KO, double KO, SHOWTIME, perfect landing, finish places, busted, final stretch), barks on
   taunts/KO/skill for nearby rivals. Never at runtime over network; missing files = silent.
5. `sandbox/audio.html`: buttons for every song/stinger/sfx/voice; an OfflineAudioContext render check
   script `tools/audio-check.mjs` that renders 20 s of each song and reports peak/RMS/clipping + checks
   no errors. Critics can't hear: document each song's progression/tempo/arrangement in status.

## Quality bar
No clicks/pops (envelopes everywhere), no clipping (peaks < −1 dBFS), music loops seamlessly, sounds
react within one frame, total CPU < 5 % on M1, nothing plays before unlock, no errors when muted.
