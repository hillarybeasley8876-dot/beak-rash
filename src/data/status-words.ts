// What the HUD calls a status over the rider who has it (r7 SPEC §29: every rider a skill affects shows the effect
// the moment it takes hold), its chip glyph, its colour, and whether the player gets a banner when it is theirs.
// Read by the HUD (ui/hud/world) and by the feel audit (tools/r7/feel-check.mjs). Content, not code: edit freely.
import type { StatusId } from '../core/types';

export interface StatusWord {
  /** The word popped over the rider when the status takes hold (2–4 characters). */
  word: string;
  /** One character for the chip over the rider while it lasts. */
  glyph: string;
  /** Ink colour (P5: the word is inked in it on black). */
  color: string;
  /** Bad for whoever has it (red-framed chip) — or good (boost, shield…). */
  bad: boolean;
  /** The player gets a banner with a countdown while it lasts (control that changes how the bike handles). */
  banner: boolean;
}

export const STATUS_WORDS: Record<StatusId, StatusWord | null> = {
  stun: { word: '眩晕', glyph: '晕', color: '#ffe14d', bad: true, banner: true },
  slow: { word: '减速', glyph: '慢', color: '#7fb8ff', bad: true, banner: true },
  chill: { word: '躺平', glyph: '躺', color: '#ffd36b', bad: true, banner: true },
  boost: { word: '加速', glyph: '速', color: '#5cff9d', bad: false, banner: false },
  shield: { word: '护盾', glyph: '盾', color: '#9be7ff', bad: false, banner: false },
  invisible: { word: '隐身', glyph: '隐', color: '#d6d6ff', bad: false, banner: false },
  intangible: { word: '虚化', glyph: '虚', color: '#d6d6ff', bad: false, banner: false },
  blind: { word: '致盲', glyph: '盲', color: '#ffffff', bad: true, banner: false },
  wobble: null,   // every bump wobbles: no word, no chip
  gulped: { word: '被吞', glyph: '吞', color: '#ffb347', bad: true, banner: true },
  angry: null,    // AI mood, not an effect
  oiled: { word: '打滑', glyph: '滑', color: '#c9a400', bad: true, banner: true },
  wet: { word: '淋湿', glyph: '湿', color: '#3aa0ff', bad: true, banner: false },
  burn: { word: '着火', glyph: '火', color: '#ff6a1e', bad: true, banner: false },
  frozen: { word: '冻住', glyph: '冻', color: '#7fd8ff', bad: true, banner: true },
  cold: { word: '寒冷', glyph: '寒', color: '#bfe9ff', bad: true, banner: false },
  charged: { word: '带电', glyph: '电', color: '#ffe14d', bad: true, banner: false },
  confused: { word: '左右颠倒', glyph: '乱', color: '#c08bff', bad: true, banner: true },
  rooted: { word: '吃饼中', glyph: '饼', color: '#ffb347', bad: true, banner: true },
  silenced: { word: '沉默', glyph: '默', color: '#b0b0b0', bad: true, banner: true },
  halted: { word: '时停', glyph: '停', color: '#ffffff', bad: true, banner: true },
};
