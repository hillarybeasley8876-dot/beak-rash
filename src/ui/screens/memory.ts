// Remembers focus per screen, so backing out lands where you left. The main-menu entry and the quick-race
// track also survive a reload (own localStorage key, like p5/motion-pref.ts: the save has no UI section).
const KEY = 'beak-rash.ui-focus';
const PERSISTED: ReadonlySet<string> = new Set(['menu', 'trackSelect']);

function load(): Map<string, number> {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}');
    if (raw === null || typeof raw !== 'object') return new Map();
    return new Map(Object.entries(raw).filter((e): e is [string, number] =>
      PERSISTED.has(e[0]) && typeof e[1] === 'number' && Number.isInteger(e[1]) && e[1] >= 0));
  } catch (err) {
    console.warn('[ui] remembered focus unreadable, starting fresh', err);
    return new Map();
  }
}

const focus = load();

function persist(): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(Object.fromEntries([...focus].filter(([k]) => PERSISTED.has(k)))));
  } catch (err) {
    console.warn('[ui] remembered focus not saved', err);
  }
}

export const recall = (key: string, fallback = 0): number => focus.get(key) ?? fallback;
export const remember = (key: string, index: number): void => {
  if (focus.get(key) === index) return;
  focus.set(key, index);
  if (PERSISTED.has(key)) persist();
};
