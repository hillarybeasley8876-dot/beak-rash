// records: the standalone 成就 screen (SPEC §26). The same sheet the career screen opens as a modal,
// but full size: every achievement in the grid, the focused one's full text in the detail strip, the
// 彩蛋 column and the lifetime stats. ←→↑↓ walk the grid (the pad's d-pad does the same), Esc / pad B
// goes back to the menu.
import './records.css';
import { HINT_BACK, HINT_NAV, backdrop } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { recordsSheet } from './records';

export const recordsScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'black', seed: 'records', star: { x: '82%', y: '26%', size: 1500, color: '#17171e', spin: 70 } });
  const f = frame({ id: 'records', bg, hints: [HINT_NAV, HINT_BACK] });
  const sheet = recordsSheet(ctx.app.save, { onClose: () => undefined, sfx: ctx.sfx, mode: 'screen' });
  f.stage.append(sheet.el);
  return {
    root: f.root,
    onAction: (a) => {
      // Esc / pad B: back to the menu. The arrows walk the achievement grid.
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      return sheet.handle(a);
    },
    dispose: () => sheet.dispose(),
  };
};
