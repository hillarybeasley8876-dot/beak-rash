// Remembers focus per screen for the session, so backing out lands where you left (no persistence).
const focus = new Map<string, number>();

export const recall = (key: string, fallback = 0): number => focus.get(key) ?? fallback;
export const remember = (key: string, index: number): void => {
  focus.set(key, index);
};
