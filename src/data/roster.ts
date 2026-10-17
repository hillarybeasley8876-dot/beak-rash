// Racers. Text is the content unit's; numbers are tuned by combat/sim owners via stats.
import type { BikeId, CharacterId } from '../core/types';

export interface CharacterDef {
  id: CharacterId;
  name: string;          // 中文名
  codename: string;      // P5-style English code name for cut-ins
  title: string;         // epithet shown on intro cards
  colors: { primary: string; secondary: string; accent: string };
  /** 1..5 ratings; sim/combat map them to numbers. */
  stats: { power: number; speed: number; handling: number; weight: number; hp: number };
  skill: string;         // signature skill id (data/skills.ts)
  defaultBike: BikeId;
  scale: number;         // body size relative to the pelican
  tagline: string;       // calling-card line on the VS screen
  taunts: string[];      // speech bubbles while racing
  koLines: string[];     // when this rider KOs someone
  hurtLines: string[];   // when knocked out
  racer: boolean;        // false = not on the grid (police)
}

export const ROSTER: Record<CharacterId, CharacterDef> = {
  pelican: {
    id: 'pelican', name: '阿鹕', codename: 'BIGMOUTH', title: '海滨公路之王（自封）',
    colors: { primary: '#f4f1ea', secondary: '#f59a23', accent: '#e5191c' },
    stats: { power: 4, speed: 4, handling: 4, weight: 3, hp: 4 },
    skill: 'pelican.torpedo', defaultBike: 'roadbike', scale: 1,
    tagline: '这条路上的鱼，都归我的嘴。',
    taunts: ['嘴大吃四方！', '让一让，鹈鹕要过了！', '叮铃铃——'],
    koLines: ['一口一个！', '下一位！'], hurtLines: ['我的嘴……', '鱼……我的鱼……'],
    racer: true,
  },
  goose: {
    id: 'goose', name: '鹅霸', codename: 'HONK', title: '村口一霸',
    colors: { primary: '#ffffff', secondary: '#ff8a00', accent: '#222222' },
    stats: { power: 5, speed: 3, handling: 3, weight: 3, hp: 4 },
    skill: 'goose.honk', defaultBike: 'erba', scale: 0.92,
    tagline: '和平？从来不是选项。',
    taunts: ['HONK!!!', '嘎！！', '看什么看，没见过鹅骑车？'],
    koLines: ['HONK HONK!', '鹅的地盘！'], hurtLines: ['嘎……？', '这不可能！'],
    racer: true,
  },
  capybara: {
    id: 'capybara', name: '卡皮', codename: 'CHILL', title: '情绪稳定大师',
    colors: { primary: '#a8754a', secondary: '#7a5233', accent: '#ffb000' },
    stats: { power: 3, speed: 3, handling: 3, weight: 5, hp: 5 },
    skill: 'capybara.chill', defaultBike: 'shared', scale: 1.05,
    tagline: '急什么，终点又不会跑。',
    taunts: ['那咋了。', '不急，不急。', '（头顶柚子，岁月静好）'],
    koLines: ['不好意思，我没急。', '躺赢。'], hurtLines: ['……嗯。', '也行吧。'],
    racer: true,
  },
  cat: {
    id: 'cat', name: '哈基米', codename: 'OIIA', title: '转圈圈冠军',
    colors: { primary: '#f2a03d', secondary: '#fff4e0', accent: '#d9534f' },
    stats: { power: 3, speed: 4, handling: 5, weight: 2, hp: 3 },
    skill: 'cat.spin', defaultBike: 'fixie', scale: 0.85,
    tagline: '桌上的东西，都该掉下去。',
    taunts: ['哈基米~', 'O-I-I-A-I!', '喵（不屑）'],
    koLines: ['推下去了喵。', '下一个杯子是谁？'], hurtLines: ['喵呜！', '哈！！'],
    racer: true,
  },
  shiba: {
    id: 'shiba', name: '神烦狗', codename: 'DOGE', title: '狗头保命专家',
    colors: { primary: '#e8a35c', secondary: '#fff7ea', accent: '#2b2b2b' },
    stats: { power: 3, speed: 4, handling: 4, weight: 3, hp: 3 },
    skill: 'shiba.doge', defaultBike: 'mtb', scale: 0.9,
    tagline: 'much speed. very wow.',
    taunts: ['such fast.', '[狗头]', '汪！（墨镜反光）'],
    koLines: ['very ko. wow.', '[狗头保命]'], hurtLines: ['much pain.', '呜汪……'],
    racer: true,
  },
  pigeon: {
    id: 'pigeon', name: '咕咕', codename: 'GUGU', title: '鸽王',
    colors: { primary: '#8e98a8', secondary: '#5d6b80', accent: '#3fbf8f' },
    stats: { power: 2, speed: 5, handling: 4, weight: 1, hp: 2 },
    skill: 'pigeon.ghost', defaultBike: 'roadbike', scale: 0.75,
    tagline: '下次一定。',
    taunts: ['咕咕咕。', '在路上了在路上了。', '下次一定！'],
    koLines: ['咕！', '鸽了你。'], hurtLines: ['咕……', '我会回来的（大概）'],
    racer: true,
  },
  penguin: {
    id: 'penguin', name: '滑总', codename: 'SLIDE', title: '南极漂移之神',
    colors: { primary: '#1d1f2b', secondary: '#ffffff', accent: '#ffcc00' },
    stats: { power: 3, speed: 4, handling: 3, weight: 4, hp: 4 },
    skill: 'penguin.slide', defaultBike: 'kidbike', scale: 0.88,
    tagline: '能滑就别骑。',
    taunts: ['滑就完事了。', '冰面太少，差评。', '（摇摇摆摆）'],
    koLines: ['滑铲成功！', '冷静点。'], hurtLines: ['冰……冰呢……', '啪叽。'],
    racer: true,
  },
  seagull: {
    id: 'seagull', name: '薯条大盗', codename: 'MINE', title: '海滨惯犯',
    colors: { primary: '#f4f6f8', secondary: '#9aa4b2', accent: '#ffd23f' },
    stats: { power: 3, speed: 4, handling: 4, weight: 2, hp: 3 },
    skill: 'seagull.steal', defaultBike: 'roadbike', scale: 0.82,
    tagline: '你的，就是我的。',
    taunts: ['MINE!', '薯条交出来！', '这条路也是我的。'],
    koLines: ['MINE MINE MINE!', '谢谢款待。'], hurtLines: ['我的薯条！', '啊啊啊——'],
    racer: true,
  },
  sloth: {
    id: 'sloth', name: '闪电', codename: 'FLASH', title: '慢……慢……来',
    colors: { primary: '#9c8466', secondary: '#d9c8a9', accent: '#3a2e22' },
    stats: { power: 2, speed: 2, handling: 2, weight: 4, hp: 5 },
    skill: 'sloth.flash', defaultBike: 'tandem', scale: 0.95,
    tagline: '我……很……快……的。',
    taunts: ['你……好……', '马……上……到……', '（打了个哈欠）'],
    koLines: ['哈……哈……哈……', '早……说……了……'], hurtLines: ['哎……呀……', '……'],
    racer: true,
  },
  corgi: {
    id: 'corgi', name: '柯基警官', codename: 'POLICE', title: '交警（腿短但执法严格）',
    colors: { primary: '#e89a4f', secondary: '#ffffff', accent: '#1f4fd1' },
    stats: { power: 3, speed: 5, handling: 4, weight: 3, hp: 5 },
    skill: 'corgi.whistle', defaultBike: 'mtb', scale: 0.8,
    tagline: '腿短不影响执法！',
    taunts: ['靠边停车！', '哔——！', '驾驶证、行车证、鱼证！'],
    koLines: ['抓到你了！'], hurtLines: ['袭警？！'],
    racer: false,
  },
};

export const RACER_POOL: CharacterId[] = (Object.keys(ROSTER) as CharacterId[]).filter(
  (id) => ROSTER[id].racer && id !== 'pelican',
);
