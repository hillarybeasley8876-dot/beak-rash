// The skill picker (SPEC §24): the skills a character may put in a slot, grouped by category, one row
// each. ↑↓ walk the rows, Enter equips (a skill that already sits in another slot swaps with it) and
// closes, Esc closes without a change. The list scrolls when it is taller than the panel.
import type { Action } from '../../core/input';
import type { CharacterId } from '../../core/types';
import { CATEGORY_CN, ELEMENT_CN, type SkillCategory, type SkillDef } from '../../data/skills';
import { ROSTER } from '../../data/roster';
import { Nav } from '../nav';
import { h, jagged, keyGlyph } from '../p5';

export interface SkillPickerOpts {
  /** The slot's caption: 「技能 2 · I」 or 「大招 ULT」. */
  title: string;
  character: CharacterId;
  /** The skill in the slot the picker was opened for (the focused row starts there). */
  current: string | null;
  /** Every skill the character may put in this slot. */
  skills: SkillDef[];
  onPick(skillId: string): void;
  /** Called when the picker closes (a pick, Esc or a teardown). */
  onClose?(): void;
  sfx(id: string): void;
}

export interface SkillPicker {
  /** Route an action to the picker; it eats everything while it is open. */
  handle(a: Action): boolean;
  close(): void;
}

/** The categories in the order the picker lists them (SPEC §24). */
const CATS: readonly SkillCategory[] = ['attack', 'control', 'move', 'defense', 'summon', 'trap', 'gag'];

export function openSkillPicker(host: HTMLElement, o: SkillPickerOpts): SkillPicker {
  const list = h('div', { class: 'br-rs-pick-list' });
  const rows: Array<{ el: HTMLElement; id: string }> = [];
  for (const cat of CATS) {
    const inCat = o.skills.filter((s) => s.category === cat);
    if (!inCat.length) continue;
    list.append(h('div', { class: 'br-rs-pick-cat', data: { pickCat: cat }, text: CATEGORY_CN[cat] }));
    for (const s of inCat) {
      const row = h('div', { class: 'br-rs-pick-row', data: { pick: s.id }, attrs: { role: 'button' } },
        h('div', { class: 'br-rs-pick-glyph', text: s.glyph }),
        h('div', { class: 'br-rs-pick-text' },
          h('b', { class: 'br-rs-pick-name', text: s.name }),
          h('span', { class: 'br-rs-pick-en', text: s.nameEn }),
          h('p', { class: 'br-rs-pick-desc', text: s.desc })),
        h('div', { class: 'br-rs-pick-cd', text: s.slot === 'ult' ? `SP ${s.spCost}` : `冷却 ${s.cooldown}s` }),
        s.element ? h('div', { class: 'br-rs-pick-el', text: ELEMENT_CN[s.element] }) : null);
      list.append(row);
      rows.push({ el: row, id: s.id });
    }
  }

  /** Keep the focused row in sight: the list is the only thing that scrolls. */
  const keepVisible = (el: HTMLElement): void => {
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = Math.max(0, top - 10);
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 10;
  };

  const panel = h('div', { class: 'br-rs-pick' },
    h('div', { class: 'br-rs-pick-panel br-panel is-black', vars: { '--clip': jagged(`pick${o.title}`, { jx: 2, jy: 6, notches: 2 }) } },
      h('div', { class: 'br-rs-pick-head' },
        h('b', { text: o.title }),
        h('span', { class: 'br-rs-pick-char', text: ROSTER[o.character].name })),
      list,
      h('div', { class: 'br-rs-pick-foot' },
        ...keyGlyph('↑↓', '✚'), h('span', { text: '选择' }),
        ...keyGlyph('ENTER', 'A'), h('span', { text: '装备' }),
        ...keyGlyph('ESC', 'B'), h('span', { text: '关闭' }))));
  host.append(panel);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    nav.dispose();
    panel.remove();
    o.onClose?.();
  };
  const start = Math.max(0, rows.findIndex((r) => r.id === o.current));
  const nav = new Nav(rows.map((row, i) => ({
    el: row.el,
    confirm: () => {
      const id = rows[i]?.id;
      close();
      if (id) o.onPick(id);
    },
    onFocus: () => keepVisible(row.el),
  })), { layout: 'vertical', start, sfx: o.sfx });
  keepVisible(rows[start]?.el ?? panel);

  return {
    handle(a) {
      if (closed) return false;
      // Esc sends 'pause' and 'back' together: the picker answers the 'back' twin, so the pause is
      // left unconsumed (the shell would drop the 'back' otherwise).
      if (a === 'back') { close(); return true; }
      return nav.handle(a);
    },
    close,
  };
}
