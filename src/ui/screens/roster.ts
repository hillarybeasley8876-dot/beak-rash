// roster (SPEC §23): pick any racer and edit its kit. A grid of every racer (portrait, 中文名, codename),
// the focused one's detail (title, tagline, the five stat bars, its signature skill) and its loadout
// (U / I / O + P), which the player edits here. The pick is saved (SaveData.character) and the next race
// is ridden as that character; 「盲盒」 rolls a random kit every race instead of the saved one.
import './roster.css';
import type { CharacterId, SkillLoadout } from '../../core/types';
import { CATEGORY_CN, ELEMENT_CN, SKILLS, equippable, equippableUlts } from '../../data/skills';
import { validLoadout } from '../../data/loadouts';
import { RACERS, ROSTER, type CharacterDef } from '../../data/roster';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, backdrop, h, portrait, ransom, statBar, type Hint } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { openSkillPicker, type SkillPicker } from './roster-picker';

/** The grid is five wide; the fifteen racers make three rows. */
const COLS = 5;
/** The loadout row: the slot, its in-race key (keyboard) and its pad button. */
const SLOTS: ReadonlyArray<{ id: '1' | '2' | '3' | 'ult'; key: string; pad: string }> = [
  { id: '1', key: 'U', pad: 'LB' },
  { id: '2', key: 'I', pad: '✚↑' },
  { id: '3', key: 'O', pad: '✚↓' },
  { id: 'ult', key: 'P', pad: 'R3' },
];
/** The five stat bars (SPEC §23): the racer's own numbers. */
const STATS: ReadonlyArray<[keyof CharacterDef['stats'], string]> = [
  ['power', '力量'], ['speed', '速度'], ['handling', '操控'], ['weight', '体重'], ['hp', '体力'],
];
const HINT_PICK: Hint = { kb: 'ENTER', pad: 'A', label: '出战', action: 'confirm' };
const HINT_EDIT: Hint = { kb: 'ENTER', pad: 'A', label: '改技能' };
/** The 盲盒 line: what the toggle does. */
const BLIND_NOTE = '每场比赛随机三个技能和一个大招';

export const rosterScreen: ScreenFactory = (ctx) => {
  const { save } = ctx.app;
  const bg = backdrop({ tone: 'black', seed: 'roster', star: { x: '80%', y: '26%', size: 1400, color: '#191921', spin: 70 } });
  const f = frame({ id: 'roster', bg, title: { cn: '角色', en: 'ROSTER' }, hints: [HINT_NAV, HINT_PICK, HINT_EDIT, HINT_BACK] });

  // ---- the grid: one card per racer, in RACERS order
  const grid = h('div', { class: 'br-rs-grid', vars: { '--cols': COLS, '--rows': Math.ceil(RACERS.length / COLS) } });
  const cards = RACERS.map((id) => {
    const def = ROSTER[id];
    const el = h('div', { class: 'br-rs-card', data: { roster: id }, attrs: { role: 'button', 'aria-label': `${def.name} ${def.codename}` } },
      h('div', { class: 'br-rs-pic' }, portrait(id, { mood: 'main' })),
      h('div', { class: 'br-rs-cname', text: def.name }),
      h('div', { class: 'br-rs-ccode', text: def.codename }),
      h('div', { class: 'br-rs-badge', text: '出战' }));
    grid.append(el);
    return el;
  });

  // ---- the detail panel: the focused racer, in full
  const dPic = h('div', { class: 'br-rs-dpic' });
  const dName = h('div', { class: 'br-rs-dname' });
  const dCode = h('div', { class: 'br-rs-dcode' });
  const dTitle = h('div', { class: 'br-rs-dtitle' });
  const dTag = h('div', { class: 'br-rs-dtag' });
  const dStats = h('div', { class: 'br-rs-dstats' });
  const sGlyph = h('div', { class: 'br-rs-sglyph' });
  const sName = h('b', { class: 'br-rs-sname' });
  const sEn = h('span', { class: 'br-rs-sen' });
  const sDesc = h('p', { class: 'br-rs-sdesc' });
  const sMeta = h('div', { class: 'br-rs-smeta' });
  const detail = h('div', { class: 'br-rs-detail', data: { rosterDetail: '1' } },
    h('div', { class: 'br-rs-dtop' }, dPic, h('div', { class: 'br-rs-did' }, dName, dCode, dTitle, dTag)),
    dStats,
    h('div', { class: 'br-rs-dsig' }, sGlyph, h('div', { class: 'br-rs-stext' }, sName, sEn, sDesc), sMeta));

  // ---- the loadout row: four slots (U / I / O + P) of the focused racer's kit
  const slotParts = SLOTS.map((s) => {
    const glyph = h('div', { class: 'br-rs-slot-glyph' });
    const name = h('div', { class: 'br-rs-slot-name' });
    const el = h('div', { class: 'br-rs-slot', data: { slot: s.id }, attrs: { role: 'button' } },
      glyph, name,
      h('div', { class: 'br-rs-slot-key br-kb-only', text: s.key }),
      h('div', { class: 'br-rs-slot-key br-pad-only', text: s.pad }));
    return { el, glyph, name };
  });
  const slotEls = slotParts.map((s) => s.el);
  const slotsBox = h('div', { class: 'br-rs-slots' }, ...slotEls);

  // ---- 盲盒: roll a random kit every race instead of the saved one
  const blindState = h('span', { class: 'br-rs-blind-state' });
  const blind = h('div', { class: 'br-rs-blind', data: { blindbox: '1' }, attrs: { role: 'button' } },
    h('span', { class: 'br-rs-blind-tag', text: '盲盒' }),
    h('span', { class: 'br-rs-blind-note', text: BLIND_NOTE }),
    blindState);

  f.stage.append(grid, h('div', { class: 'br-rs-side' }, detail, slotsBox, blind));

  // ---- what the panel shows: the focused racer, in full
  const showDetail = (c: CharacterId): void => {
    const def = ROSTER[c];
    dPic.replaceChildren(portrait(c, { mood: 'smug' }));
    dName.replaceChildren(ransom(def.name, { seed: `rs-${c}`, fonts: 'block', first: 'wb', className: 'br-rs-rn' }));
    dCode.textContent = def.codename;
    dTitle.textContent = def.title;
    dTag.textContent = def.tagline;
    dStats.replaceChildren(...STATS.map(([k, label]) => statBar(label, def.stats[k], 5)));
    const sig = SKILLS[def.skill];
    sGlyph.textContent = sig?.glyph ?? '—';
    sName.textContent = sig?.name ?? '';
    sEn.textContent = sig?.nameEn ?? '';
    sDesc.textContent = sig?.desc ?? '';
    sMeta.textContent = sig
      ? [CATEGORY_CN[sig.category], sig.element ? ELEMENT_CN[sig.element] : ''].filter(Boolean).join(' · ')
      : '';
  };

  /** The kit the focused racer carries: its saved one, validated (an invalid slot falls back). */
  const kitOf = (c: CharacterId): SkillLoadout => validLoadout(save.data.loadouts[c], c);

  const showSlots = (c: CharacterId): void => {
    const l = kitOf(c);
    const ids: Array<string | null> = [l.slots[0], l.slots[1], l.slots[2], l.ult];
    slotParts.forEach((part, i) => {
      const id = ids[i] ?? null;
      const def = id ? SKILLS[id] : null;
      part.el.dataset.skill = id ?? '';
      part.el.classList.toggle('is-empty', !def);
      part.glyph.textContent = def?.glyph ?? '—';
      part.name.textContent = def?.name ?? '空槽';
    });
  };

  // ---- 出战 / 盲盒
  const markPicked = (): void => {
    cards.forEach((el, i) => el.classList.toggle('is-picked', RACERS[i] === save.data.character));
  };
  const showBlind = (): void => {
    blind.classList.toggle('is-on', save.data.blindBox);
    blindState.textContent = save.data.blindBox ? '开' : '关';
  };
  const toggleBlind = (): void => {
    save.update((d) => { d.blindBox = !d.blindBox; });
    ctx.sfx('ui.move');
    ctx.toast(save.data.blindBox ? '盲盒开：每场比赛随机三个技能和一个大招。' : '盲盒关：用你自己配的技能。', 'info');
  };
  blind.addEventListener('click', (e) => { e.stopPropagation(); toggleBlind(); });

  /** Put a skill in a slot: a skill that sits in another slot swaps with it (no duplicates). */
  function equip(c: CharacterId, slotId: string, skillId: string): void {
    const cur = kitOf(c);
    const next: [string | null, string | null, string | null] = [cur.slots[0], cur.slots[1], cur.slots[2]];
    let ult = cur.ult;
    if (slotId === 'ult') ult = skillId;
    else {
      const i = Number(slotId) - 1;
      const other = next.indexOf(skillId);
      if (other >= 0 && other !== i) next[other] = next[i];
      next[i] = skillId;
    }
    const valid = validLoadout({ slots: next, ult }, c);
    save.update((d) => { d.loadouts[c] = valid; });
    showSlots(c);
    ctx.toast(`装备 ${SKILLS[skillId]?.name ?? skillId}`, 'info');
  }
  // ---- the two focus groups: the grid and the slot row
  let gridIndex = Math.max(0, RACERS.indexOf(save.data.character));
  let mode: 'grid' | 'slots' = 'grid';
  let picker: SkillPicker | null = null;
  let booting = true;

  function toGrid(): void {
    mode = 'grid';
    slotEls.forEach((el) => el.classList.remove('is-focus'));
    gridNav.focus(gridIndex, true);
  }
  function toSlots(i: number): void {
    mode = 'slots';
    cards.forEach((el) => el.classList.remove('is-focus'));
    slotNav.focus(i, true);
  }
  function pick(c: CharacterId): void {
    save.update((d) => { d.character = c; });
    ctx.toast(`${ROSTER[c].name} 出战！`, 'meme');
    toSlots(0);
  }
  function openPicker(i: number): void {
    const c = RACERS[gridIndex];
    const slot = SLOTS[i];
    const l = kitOf(c);
    picker = openSkillPicker(f.stage, {
      title: slot.id === 'ult' ? '大招 ULT' : `技能 ${slot.id} · ${slot.key}`,
      character: c,
      current: slot.id === 'ult' ? l.ult : l.slots[i],
      skills: slot.id === 'ult' ? equippableUlts(c) : equippable(c),
      onPick: (id) => equip(c, slot.id, id),
      onClose: () => { picker = null; },
      sfx: ctx.sfx,
    });
  }

  const gridNav = ctx.nav(new Nav(cards.map((el, i) => ({
    el,
    confirm: () => pick(RACERS[i]),
    onFocus: () => {
      gridIndex = i;
      showDetail(RACERS[i]);
      showSlots(RACERS[i]);
      if (mode === 'slots') toGrid();   // touching the grid takes the focus back
    },
  })), { layout: 'grid', columns: COLS, start: gridIndex, sfx: ctx.sfx }));
  const slotNav = ctx.nav(new Nav(slotEls.map((el, i) => ({
    el,
    confirm: () => openPicker(i),
    onFocus: () => {
      if (!booting && mode === 'grid') toSlots(i);
    },
  })), { layout: 'horizontal', sfx: ctx.sfx }));
  booting = false;
  slotEls.forEach((el) => el.classList.remove('is-focus'));   // the slot row waits for the grid to hand over

  markPicked();
  showBlind();
  const offSave = save.onChange(() => { markPicked(); showBlind(); });

  return {
    root: f.root,
    onAction: (a) => {
      if (picker) return picker.handle(a);
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      if (a === 'bell') { toggleBlind(); return true; }
      if (mode === 'grid') {
        // Pad START picks like A (the keyboard's Esc sends 'pause' too, so this is gamepad-only).
        if (a === 'pause' && ctx.app.input.lastDevice === 'gamepad') return gridNav.handle('confirm');
        // ↓ on the last card steps down into the slot row (the grid's bottom-right corner).
        if (a === 'down' && gridIndex === RACERS.length - 1) { toSlots(0); return true; }
        return gridNav.handle(a);
      }
      if (a === 'up') { toGrid(); return true; }
      return slotNav.handle(a);
    },
    dispose: () => {
      offSave();
      picker?.close();
    },
  };
};
