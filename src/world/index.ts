// Track unit entry. Contract: createTrack(app, id, rng, opts?) → Track (core/contracts.ts), optional preload.
import { TRACK_ORDER } from '../data/tracks';
import { COAST_SIGN_TEXTS } from './dressing/coast/index';
import { warmFonts } from './fonts';
import { roadWords } from './road/marks';
import { warmBillboardArt } from './scenery/signs/art';

export { createTrack } from './track';
export { ALLOWED, GRIP, resolveWeather, weatherLook } from './weather';

/** Boot warm-up: start loading the sign / road-word fonts and decoding the billboard art in the background, so
 *  the first track build finds them ready. Returns at once (core awaits unit preloads before the title). */
export function preload(): Promise<void> {
  warmFonts([...COAST_SIGN_TEXTS, 'START', 'FINISH', ...TRACK_ORDER.flatMap((id) => roadWords(id).flat())]);
  warmBillboardArt();
  return Promise.resolve();
}
