// Screen-flow rules: which changes get the shard wipe, which music plays, when the HUD shows.
import type { ScreenId, ScreenProps, Session } from '../core/contracts';

/** Screens without DOM: the race view (HUD only). */
export const isRaceView = (id: ScreenId): boolean => id === 'race' || id === 'intro';

/** Overlays that sit on top of a paused race snap in without a wipe. */
const SNAP: Array<[ScreenId, ScreenId]> = [
  ['race', 'pause'], ['intro', 'pause'], ['pause', 'race'], ['pause', 'intro'],
];

export function useWipe(from: ScreenId, to: ScreenId): boolean {
  if (from === to) return false;
  if (from === 'boot' && to === 'boot') return false;
  return !SNAP.some(([a, b]) => a === from && b === to);
}

const MENU_MUSIC: Partial<Record<ScreenId, string>> = {
  title: 'title', menu: 'menu', career: 'menu', trackSelect: 'menu', garage: 'menu',
  howto: 'menu', credits: 'menu', settings: 'menu', results: 'results',
};

/**
 * Music to request for a screen, or undefined to keep whatever plays now
 * (pause / settings over a live race keep the muffled race song; loading keeps the menu song).
 */
export function musicFor(id: ScreenId, props: ScreenProps, session: Session | null): string | undefined {
  if (isRaceView(id)) return `race-${session?.config.trackId ?? props.config?.trackId ?? 'coast'}`;
  if (session && (id === 'pause' || id === 'settings' || id === 'howto')) return undefined;
  return MENU_MUSIC[id];
}
