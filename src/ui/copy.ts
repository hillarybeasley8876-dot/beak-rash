// UI copy owned by ui-screens (menu blurbs, career cups). Kind, meme-flavoured; credits, how-to and
// calendar copy come from the content unit's data/strings.ts.
import type { ScreenId } from '../core/contracts';
import type { Weather } from '../core/types';

export interface MenuEntry { cn: string; en: string; to: ScreenId; blurb: string; padBlurb?: string }

// The main-menu stair. tools/ui-tour.mjs walks it by NAME (the entry names are stable), so a new entry may
// go anywhere; the order below keeps the race modes together: 巡回赛 · 快速比赛 · 联机 · 车库 · 成就 · 角色 · 设置.
export const MENU: MenuEntry[] = [
  { cn: '巡回赛', en: 'CAREER', to: 'career', blurb: '三杯九站，从菜鸟杯一路卷到鹈鹕神杯。' },
  { cn: '快速比赛', en: 'QUICK RACE', to: 'trackSelect', blurb: '随便挑条路，先撞了再说。' },
  { cn: '联机', en: 'ONLINE', to: 'online', blurb: '拉上朋友，一个房间号就开跑。' },
  { cn: '车库', en: 'GARAGE', to: 'garage', blurb: '从二八大杠到死飞，总有一辆配得上你的嘴。' },
  { cn: '成就', en: 'RECORDS', to: 'records', blurb: '奖杯、彩蛋、毕生战绩，都挂在这儿。' },
  { cn: '角色', en: 'ROSTER', to: 'roster', blurb: '选谁骑车？技能也在这儿配。' },
  { cn: '设置', en: 'CONFIG', to: 'settings', blurb: '音量、画质、震动，还有慢镜头的浓度。' },
  { cn: '操作', en: 'HOW TO', to: 'howto', blurb: 'J 往左扇，L 往右扇，K 用力扇。', padBlurb: 'X 往左扇，B 往右扇，Y 用力扇。' },
  { cn: '致谢', en: 'CREDITS', to: 'credits', blurb: '感谢所有把链条画在鹈鹕脖子上的大模型。' },
];

/** Desktop shell only (AppContext.quit): the stair's last, smaller step; asks first. */
export const MENU_QUIT = {
  cn: '退出游戏', en: 'QUIT', blurb: '存档随时自动保存，放心下班。',
  ask: '退出游戏？', askText: '存档已经自动保存。鹈鹕也是要下班的。', yes: '退出', no: '再骑会',
};

/** Weather names (SPEC §20): the quick-race picker, the career chips and the loading card. */
export const WEATHER_CN: Record<Weather, string> = {
  clear: '晴', rain: '雨', snow: '雪', fog: '雾', dusk: '黄昏',
};

/** The picker's extra entry: the race rolls one of the track's own weathers. */
export const WEATHER_RANDOM_CN = '随机';

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

/** The online screens (SPEC §28): the 联机 screen (name, create, join) and the lobby (the room, its members). */
export const ONLINE = {
  title: { cn: '联机', en: 'ONLINE' },
  /** The name a player who never typed one rides under. */
  defaultName: '骑手',
  name: '你的名字',
  nameHint: '房间里的朋友看到的就是这个名字',
  create: '创建房间',
  join: '加入房间',
  code: '房间号',
  codeHint: '4 个字母，字母表里没有 I O 0 1 L',
  hint: '房间号是 4 个字母，别把 I 和 1 搞混了。',
};

/** The lobby (SPEC §28): the room code, the members and the host's controls. */
export const LOBBY = {
  title: { cn: '房间', en: 'LOBBY' },
  codeLabel: '房间号',
  share: '把房间号发给朋友',
  members: '成员',
  track: '赛道',
  weather: '天气',
  reverse: '方向',
  forward: '正向',
  backward: '反向',
  host: '房主',
  ready: '准备好了',
  you: '你',
  readyBtn: '准备',
  cancelReady: '取消准备',
  change: '换角色',
  start: '开始比赛',
  waitHost: '等房主开赛',
  waitOthers: '等大家都准备好',
  leave: { ask: '离开房间？', text: '退出后房间就散了，朋友得重新进来。', yes: '离开', no: '再等等' },
  gone: '房间没了（房主走了？）。',
};
