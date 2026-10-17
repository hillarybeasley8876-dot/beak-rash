// Audio sandbox: every song / stinger / sfx / voice on a button, live meters, and the offline
// render-check API (window.__audioCheck) used by tools/audio-check.mjs.
import { renderAllSfx, renderSfx, renderSong, renderStinger, formSeconds, songInfo } from '../src/audio/check';
import { hookMask, stems } from '../src/audio/check-mix';
import { SFX } from '../src/audio/sfx/bank';
import { mountLab } from '../src/audio/lab/panel';
import { SONGS } from '../src/audio/music/songs';
import { STINGERS } from '../src/audio/music/stingers';

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
    };
  }
}

window.__audioCheck = {
  ready: true,
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
};

const root = document.getElementById('app');
if (root) mountLab(root);
