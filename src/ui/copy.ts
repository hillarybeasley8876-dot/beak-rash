// UI copy owned by ui-screens (menu blurbs, career cups). Kind, meme-flavoured; credits, how-to and
// calendar copy come from the content unit's data/strings.ts.
import type { ScreenId } from '../core/contracts';

export interface MenuEntry { cn: string; en: string; to: ScreenId; blurb: string; padBlurb?: string }

export const MENU: MenuEntry[] = [
  { cn: '巡回赛', en: 'CAREER', to: 'career', blurb: '三杯九站，从菜鸟杯一路卷到鹈鹕神杯。' },
  { cn: '快速比赛', en: 'QUICK RACE', to: 'trackSelect', blurb: '随便挑条路，先撞了再说。' },
  { cn: '车库', en: 'GARAGE', to: 'garage', blurb: '从二八大杠到死飞，总有一辆配得上你的嘴。' },
  { cn: '设置', en: 'CONFIG', to: 'settings', blurb: '音量、画质、震动，还有慢镜头的浓度。' },
  { cn: '操作', en: 'HOW TO', to: 'howto', blurb: 'J 往左扇，L 往右扇，K 用力扇。', padBlurb: 'X 往左扇，B 往右扇，Y 用力扇。' },
  { cn: '致谢', en: 'CREDITS', to: 'credits', blurb: '感谢所有把链条画在鹈鹕脖子上的大模型。' },
];

/** Desktop shell only (AppContext.quit): the stair's last, smaller step; asks first. */
export const MENU_QUIT = {
  cn: '退出游戏', en: 'QUIT', blurb: '存档随时自动保存，放心下班。',
  ask: '退出游戏？', askText: '存档已经自动保存。鹈鹕也是要下班的。', yes: '退出', no: '再骑会',
};

export interface Cup { tier: 1 | 2 | 3; cn: string; en: string; motto: string }

export const CUPS: Cup[] = [
  { tier: 1, cn: '菜鸟杯', en: 'ROOKIE CUP', motto: '大家都是第一次骑车，别紧张。' },
  { tier: 2, cn: '内卷杯', en: 'GRIND CUP', motto: '对手开始带武器了，还会记仇。' },
  { tier: 3, cn: '鹈鹕神杯', en: 'PELICAN GOD CUP', motto: '传说中只有嘴最大的才能夺冠。' },
];

/** Credits as the career finale (results → 通关!). */
export const FINALE = {
  title: '巡回赛通关',
  en: 'CAREER CLEAR',
  line: '三杯九站，全部拿下。鹈鹕神杯，归你了！',
  bubble: '嘴最大的，果然是我。谢谢你一路陪骑！',
};
