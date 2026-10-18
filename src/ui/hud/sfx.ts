// UI sounds for the HUD's own cut-ins. The audio unit already voices the countdown, skills, SHOWTIME,
// KO / WRECKED cinematics, BUSTED, FINISH and incoming projectiles, so the HUD only adds the sounds of
// what it alone shows: intro calling cards, place callouts, FINAL STRETCH, the BUSTED stamp + ticket
// countdown and achievement chips.
import type { AudioSystem } from '../../core/contracts';

export type Sfx = (id: string, opts?: { volume?: number; pitch?: number }) => void;

/** A guarded `audio.sfx`: a failing audio unit costs the sound (logged once), never the HUD frame. */
export function hudSfx(audio: AudioSystem): Sfx {
  let warned = false;
  return (id, opts) => {
    try {
      audio.sfx(id, opts);
    } catch (err) {
      if (warned) return;
      warned = true;
      console.warn(`[ui-hud] audio.sfx('${id}') failed; HUD sounds may be missing`, err);
    }
  };
}
