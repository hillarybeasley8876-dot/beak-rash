// Track unit entry. Contract: createTrack(app, id, rng) → Track (core/contracts.ts), optional preload.
import { COAST_SIGN_TEXTS } from './dressing/coast/index';
import { warmFonts } from './fonts';
import { warmBillboardArt } from './scenery/signs/art';

export { createTrack } from './track';

/** Boot warm-up: start loading the sign fonts and decoding the billboard art in the background, so the
 *  first track build finds them ready. Returns at once (core awaits unit preloads before the title). */
export function preload(): Promise<void> {
  warmFonts([...COAST_SIGN_TEXTS, 'START', 'FINISH']);
  warmBillboardArt();
  return Promise.resolve();
}
