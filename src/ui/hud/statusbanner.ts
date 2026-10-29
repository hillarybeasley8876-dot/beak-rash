// The player's own control status (r7, SPEC §29): under the place block a banner — 「沉默 2.4s」 with a
// countdown bar — for the strongest status the player carries that asks for one, plus its screen cue
// (左右颠倒 / 沉默 / 冻住 / 眩晕). Every cue is edge-only: nothing it draws sits over the road.
import './css/status.css';
import { clamp01 } from '../../core/math';
import type { RiderState, StatusId } from '../../core/types';
import { STATUS_WORDS } from '../../data/status-words';
import { el, w, type W } from './dom';

/** Banner priority, strongest first (frozen > stun > rooted > confused > silenced > …). */
const BANNER_ORDER: readonly StatusId[] = [
  'frozen', 'halted', 'stun', 'rooted', 'confused', 'silenced', 'gulped', 'chill', 'slow', 'oiled',
];
/** The statuses with a screen cue of their own. */
const CUES: readonly StatusId[] = ['confused', 'silenced', 'frozen', 'stun'];
/** The mark a cue stamps on the screen (only 左右颠倒 has one). */
const CUE_MARK: Partial<Record<StatusId, string>> = { confused: '⇄' };

/** What the banner shows right now. */
export interface BannerState {
  status: StatusId;
  text: string;
  left: number;
}

export class StatusBanner {
  readonly root: HTMLDivElement;
  private rootW: W;
  private word: W;
  private secs: W;
  private fill: W;
  private cueW: W;
  private mark: W;
  /** The banner and the cue on screen (null = none), and the longest time seen per live status. */
  private shown: BannerState | null = null;
  private cueId: StatusId | null = null;
  private life = new Map<StatusId, number>();

  constructor(parent: HTMLElement, cueParent: HTMLElement) {
    this.root = el('div', 'st-banner', parent);
    this.rootW = w(this.root);
    const row = el('div', 'stb-w', this.root);
    this.word = w(el('span', 'stb-t', row));
    this.secs = w(el('b', 'stb-s', row, '0.0s'));
    this.fill = w(el('i', '', el('div', 'stb-bar', this.root)));
    // The cue layer sits under every corner module (it is the first child of the HUD layer).
    const cue = el('div', 'st-cue');
    cueParent.prepend(cue);
    this.cueW = w(cue);
    el('div', 'stc-edge', cue);
    this.mark = w(el('div', 'stc-mark', cue, ''));
  }

  /** A new race: nothing is carried over. */
  reset(): void {
    this.life.clear();
    this.shown = null;
    this.setCue(null);
    this.rootW.cls('on', false);
  }

  /** The banner on screen (null = none). */
  banner(): BannerState | null {
    return this.shown;
  }

  /** The screen cue on screen (null = none). */
  cue(): StatusId | null {
    return this.cueId;
  }

  update(r: RiderState): void {
    const live = new Set<StatusId>();
    for (const st of r.statuses) {
      if (st.time <= 0 || !STATUS_WORDS[st.id]) continue;
      live.add(st.id);
      this.life.set(st.id, Math.max(this.life.get(st.id) ?? 0, st.time));
    }
    for (const id of [...this.life.keys()]) if (!live.has(id)) this.life.delete(id);
    const id = BANNER_ORDER.find((s) => live.has(s)) ?? null;
    const time = id === null ? 0 : r.statuses.find((s) => s.id === id)?.time ?? 0;
    this.setBanner(id, time);
    this.setCue(CUES.find((s) => live.has(s)) ?? null);
  }

  /** 「沉默 2.4s」 + the draining bar; the strongest status only. */
  private setBanner(id: StatusId | null, time: number): void {
    const word = id === null ? null : STATUS_WORDS[id];
    this.shown = word && id ? { status: id, text: `${word.word} ${time.toFixed(1)}s`, left: time } : null;
    this.rootW.cls('on', this.shown !== null);
    if (!this.shown || !word || !id) return;
    this.rootW.style('--sc', word.color);
    this.word.text(word.word);
    this.secs.text(`${time.toFixed(1)}s`);
    this.fill.tf(`scaleX(${clamp01(time / Math.max(0.1, this.life.get(id) ?? time)).toFixed(3)})`);
  }

  private setCue(id: StatusId | null): void {
    if (id === this.cueId) return;
    this.cueId = id;
    this.cueW.cls('on', id !== null);
    this.cueW.attr('data-cue', id ?? '');
    this.mark.text(id === null ? '' : CUE_MARK[id] ?? '');
  }
}
