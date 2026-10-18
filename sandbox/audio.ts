// Audio sandbox: every song / stinger / sfx / voice on a button, live meters, and the offline
// render-check API (window.__audioCheck) used by tools/audio-check.mjs.
import { renderAllSfx, renderSfx, renderSong, renderStinger, formSeconds, songInfo } from '../src/audio/check';
import { hookMask, stems } from '../src/audio/check-mix';
import { tone } from '../src/audio/check-tone';
import { fadeOutCheck, retriggerChecks, stingerIdleChecks } from '../src/audio/check-onsets';
import { SFX } from '../src/audio/sfx/bank';
import { mountLab } from '../src/audio/lab/panel';
import { SONGS } from '../src/audio/music/songs';
import { STINGERS } from '../src/audio/music/stingers';
import { AUDIO_RATE } from '../src/audio/engine';
import { prepareSampleBanks } from '../src/audio/music/instruments/banks';

declare global {
  interface Window {
    __audioCheck?: {
      ready: boolean;
      songs: string[];
      stingers: string[];
      renderSong: typeof renderSong;
      renderStinger: typeof renderStinger;
      formSeconds: typeof formSeconds;
      songInfo: typeof songInfo;
      sfx: string[];
      renderSfx: typeof renderSfx;
      renderAllSfx: typeof renderAllSfx;
      stems: typeof stems;
      hookMask: typeof hookMask;
      tone: typeof tone;
      retriggerChecks: typeof retriggerChecks;
      stingerIdleChecks: typeof stingerIdleChecks;
      fadeOutCheck: typeof fadeOutCheck;
    };
  }
}

window.__audioCheck = {
  ready: false,
  songs: Object.keys(SONGS),
  stingers: Object.keys(STINGERS),
  renderSong,
  renderStinger,
  formSeconds,
  songInfo,
  sfx: Object.keys(SFX),
  renderSfx,
  renderAllSfx,
  stems,
  hookMask,
  tone,
  retriggerChecks,
  stingerIdleChecks,
  fadeOutCheck,
};

// Renders use the game's sampled instruments: ready once the note banks exist.
void prepareSampleBanks(AUDIO_RATE).then(() => {
  if (window.__audioCheck) window.__audioCheck.ready = true;
});

const root = document.getElementById('app');
if (root) mountLab(root);
