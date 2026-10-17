// settings: volumes, quality, shake, auto-pedal, slow-mo, reset save. ↑↓ row, ←→ value, Enter cycles /
// confirms; changes save at once (volumes and auto-pedal apply live). Esc → menu (or pause mid-race).
import './settings.css';
import { Nav } from '../nav';
import { HINT_BACK, HINT_LR, HINT_NAV, backdrop, h, jagged, portrait } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { ROWS, applySettings, rowWidget, type RowWidget } from './settings-rows';

export const settingsScreen: ScreenFactory = (ctx) => {
  const { app } = ctx;
  const backTo = ctx.from === 'pause' ? 'pause' : 'menu';
  const bg = backdrop({ tone: 'black', seed: 'settings', star: { x: '86%', y: '70%', size: 1200, color: '#17171e', spin: 70 },
    bands: [{ top: '8%', height: 20, color: '#e5191c', rotate: -4 }] });
  const f = frame({ id: 'settings', bg, title: { cn: '设置', en: 'CONFIG' }, hints: [HINT_NAV, HINT_LR, HINT_BACK] });
  const desc = h('p', { class: 'br-set-desc-text' });
  const list = h('div', { class: 'br-set-list' });
  let qualityWarned = false;
  const widgets: RowWidget[] = [];
  const changed = (i: number): void => {
    widgets[i]?.sync();
    applySettings(app);
    const def = ROWS[i];
    if (def?.kind === 'choice' && def.key === 'quality' && !qualityWarned) {
      qualityWarned = true;
      ctx.toast('画质设置会在重启游戏后生效', 'info');
    }
  };
  const pick = (i: number, dir: -1 | 1): void => {
    nav.focus(i, true);
    if (widgets[i]?.step(dir)) {
      ctx.sfx('ui.move');
      changed(i);
    }
  };
  const reset = async (): Promise<void> => {
    const ok = await ctx.confirm('重置存档？', '小鱼干、车辆和进度都会消失，无法撤销。', '清空', '算了');
    if (!ok) return;
    app.save.reset();
    applySettings(app);
    widgets.forEach((w) => w.sync());
    ctx.toast('存档已重置。重新做回一只普通鹈鹕。', 'meme');
  };
  ROWS.forEach((def, i) => {
    const w = rowWidget(app, def, (dir) => pick(i, dir));
    w.el.style.setProperty('--i', String(i));
    w.sync();
    widgets.push(w);
    list.append(w.el);
  });
  f.stage.append(list, h('div', { class: 'br-set-desc' },
    h('div', { class: 'br-set-desc-box', vars: { '--clip': jagged('setdesc', { jx: 2, jy: 5, notches: 2 }) } }, h('span', { class: 'br-tag is-red', text: 'INFO' }), desc),
    portrait('pelican', { mood: 'smug', className: 'br-set-pelican' })));
  const nav = ctx.nav(new Nav(ROWS.map((def, i) => ({
    el: widgets[i]!.el,
    left: () => pick(i, -1),
    right: () => pick(i, 1),
    confirm: () => (def.kind === 'action' ? void reset() : pick(i, 1)),
    onFocus: () => {
      desc.textContent = def.desc;
    },
  })), { layout: 'vertical', sfx: ctx.sfx }));
  return {
    root: f.root,
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go(backTo);
        return true;
      }
      return nav.handle(a);
    },
  };
};
