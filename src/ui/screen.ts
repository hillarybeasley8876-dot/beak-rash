// Screen plumbing shared by every screen module: the context a screen receives, the instance it
// returns, and the common chrome (full-bleed background + 1920×1080 stage + header + hint bar).
import type { Action } from '../core/input';
import type { AppContext, ScreenId, ScreenProps, Session } from '../core/contracts';
import { h, ransom, hintBar, type Hint } from './p5';
import type { Nav } from './nav';
import type { RaceTracker } from './race-tracker';

export interface ScreenCtx {
  readonly app: AppContext;
  readonly props: ScreenProps;
  /** Screen we came from (for back navigation decisions). */
  readonly from: ScreenId;
  session(): Session | null;
  /** Achievements unlocked in the attached (or most recent) race. */
  readonly tracker: RaceTracker;
  sfx(id: string): void;
  go(screen: ScreenId, props?: ScreenProps): void;
  toast(text: string, kind?: 'info' | 'warn' | 'meme'): void;
  confirm(title: string, text: string, yes?: string, no?: string): Promise<boolean>;
  /** Milliseconds since the latest key / pad press (or click on a menu screen) of any action (mash detection). */
  sincePress(): number;
  /** Make a Nav that the shell routes actions to while this screen is active. */
  nav<T extends Nav>(nav: T): T;
}

export interface ScreenInstance {
  readonly root: HTMLElement;
  /** Return true when the action was consumed (stops the same key's sibling actions). */
  onAction?(a: Action): boolean;
  /** Real-time tick while the screen is up. */
  update?(dtReal: number): void;
  /** Resolves when the screen may be replaced (boot splash). */
  ready?: Promise<void>;
  /** After the wipe has revealed the screen. */
  entered?(): void;
  /** Before the screen is replaced; the shell waits for it (loading keeps its card up a beat). */
  leave?(): Promise<void>;
  dispose?(): void;
}

export type ScreenFactory = (ctx: ScreenCtx) => ScreenInstance;

export interface FrameOpts {
  id: string;
  bg?: HTMLElement;
  /** Big skewed header: ransom Chinese title + English sub. */
  title?: { cn: string; en: string };
  hints?: Hint[];
  passive?: boolean;
}

export interface Frame {
  root: HTMLDivElement;
  bg: HTMLDivElement;
  stage: HTMLDivElement;
}

export function frame(o: FrameOpts): Frame {
  const root = h('div', { class: `br-screen br-scr-${o.id}${o.passive ? ' is-passive' : ''}`, data: { screen: o.id } });
  const bg = h('div', { class: 'br-bg' });
  if (o.bg) bg.append(o.bg);
  const stage = h('div', { class: 'br-stage' });
  if (o.title) stage.append(header(o.title.cn, o.title.en));
  if (o.hints?.length) stage.append(hintBar(o.hints));
  root.append(bg, stage);
  return { root, bg, stage };
}

/** Top-left screen header: black jagged band, ransom-note Chinese title, and the English word as a ghost
 * fill inside the band, starting right after the Chinese glyphs (clipped by the band, never the screen). */
export function header(cn: string, en: string): HTMLDivElement {
  const el = h('div', { class: 'br-header', vars: { '--cn-n': [...cn].length, '--en-n': en.length } });
  el.append(
    h('div', { class: 'br-header-band br-anim-left' }, h('span', { class: 'br-header-en', text: en })),
    ransom(cn, { seed: cn, slam: true, className: 'br-header-cn', fonts: 'block', first: 'wr' }),
  );
  return el;
}
