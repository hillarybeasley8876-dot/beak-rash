// ScreenId → factory. 'race'/'intro' have no DOM (the HUD layer shows instead).
import type { ScreenId } from '../../core/contracts';
import { backdrop, h } from '../p5';
import { frame, type ScreenCtx, type ScreenFactory, type ScreenInstance } from '../screen';
import { bootScreen } from './boot';
import { careerScreen } from './career';
import { creditsScreen } from './credits';
import { garageScreen } from './garage';
import { howtoScreen } from './howto';
import { loadingScreen } from './loading';
import { menuScreen } from './menu';
import { pauseScreen } from './pause';
import { recordsScreen } from './records-screen';
import { resultsScreen } from './results';
import { settingsScreen } from './settings';
import { titleScreen } from './title';
import { trackSelectScreen } from './track-select';

/** Last-resort screen when a factory throws: says so and offers a way back. */
export function errorScreen(ctx: ScreenCtx, id: ScreenId): ScreenInstance {
  const f = frame({ id: 'error', bg: backdrop({ tone: 'black', star: false }) });
  f.stage.append(h('div', { class: 'br-err', text: `这个界面摔车了（${id}）` },
    h('small', {}, h('span', { class: 'br-kb-only', text: '按 Esc / Enter 回主菜单' }), h('span', { class: 'br-pad-only', text: '按 B / A 回主菜单' }))));
  return {
    root: f.root,
    onAction: (a) => {
      if (a !== 'back' && a !== 'confirm') return false;
      ctx.go('menu');
      return true;
    },
  };
}

export const SCREENS: Record<ScreenId, ScreenFactory> = {
  boot: bootScreen,
  title: titleScreen,
  menu: menuScreen,
  career: careerScreen,
  trackSelect: trackSelectScreen,
  garage: garageScreen,
  loading: loadingScreen,
  pause: pauseScreen,
  results: resultsScreen,
  settings: settingsScreen,
  howto: howtoScreen,
  credits: creditsScreen,
  race: (ctx) => errorScreen(ctx, 'race'),
  intro: (ctx) => errorScreen(ctx, 'intro'),
  // r6 (SPEC §23, §26): the roster screen is another job's; the records screen is here.
  roster: (ctx) => errorScreen(ctx, 'roster'),
  records: recordsScreen,
};
