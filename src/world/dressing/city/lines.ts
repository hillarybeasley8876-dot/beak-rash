// City text: shop names for neon fascias / blade signs, extra night-city meme lines (same tone as
// data/memes.ts: light, kind, no brands or real people), gantry and landmark captions.
import { BILLBOARD_LINES, ROAD_SIGNS, TRACK_BILLBOARDS, TRACK_SIGNS } from '../../../data/memes';

/** Shop names (2–5 字) for fascias over storefronts. */
export const SHOPS: string[] = [
  '鹈鹕烧烤', '卡皮奶茶', '通宵鱼档', '咕咕驿站', '哈基米猫咖', '神烦眼镜', '树懒外卖', '滑总冰淇淋',
  '薯条炸鸡', '鹅霸火锅', '深夜拉面', '鱼丸粗面', '小鱼干银行', '二八车行', '喉囊五金', '柯基警务亭',
  '夜宵大排档', '网咖 24H', '卡拉OK', '饺子馆', '麻辣烫', '煎饼果子', '鸽子照相馆', '大鹅理发',
  '便利店', '寿司', '糖水铺', '烤红薯', '豆浆油条', '电玩城',
];

/** Vertical blade signs (2–4 字). */
export const BLADES: string[] = [
  '烧烤', '奶茶', '拉面', '夜宵', '鱼档', '网咖', '旅馆', '火锅', '按摩椅', '咸鱼', '炸鸡', '电玩', '唱片', '饺子',
];

/** Night-city meme lines (≤ 14 字, a space is the preferred break). */
export const CITY_LINES: string[] = [
  '霓虹夜城 鹈鹕不睡', '凌晨三点 鹅还在卷', '夜宵第二份 半价', '奶茶三分糖 人生七分苦', '赛博朋克 但是鹈鹕',
  '霓虹灯下 不许内卷', '夜跑不如夜骑', '末班地铁 已被鸽了', '城市很大 鱼很贵', '加完班 骑车回家',
  '路灯为你亮 别骑太快', '本店无 WiFi 请和鹅聊天', '今晚吃鱼 明天再卷',
];

/** Big rooftop lines: generic meme billboards + the city extras. */
export const ROOF_LINES: string[] = [...TRACK_BILLBOARDS.city, ...CITY_LINES, ...BILLBOARD_LINES.slice(0, 18)];

/** P5-style red/black boards (ransom-note lettering). */
export const P5_LINES: string[] = ['SHOWTIME!', '暴力鹈鹕', 'KNOCK OUT!', '今日宜：撞人', 'ONE MORE!', '霓虹夜城'];

/** The calling-card mural (original wording). */
export const MURAL = { title: '预告函', body: '今晚 我要偷走 你的第一名', sign: '—— 暴力鹈鹕' };

export const CITY_SIGNS: string[] = [...TRACK_SIGNS.city, ROAD_SIGNS[0] ?? '限速：随缘', '禁止鹅叫', '前方测速 柯基执勤'];

export const GANTRY = {
  start: { word: 'START', sub: '暴力鹈鹕 · 霓虹夜城', back: 'BEAK RASH', backSub: '夜骑请开灯 鹅在暗处' },
  finish: { word: 'FINISH', sub: '终点 · 夜宵在等你', back: 'GG', backSub: '霓虹夜城 欢迎再来' },
};

/** Every string the city draws (font preload). */
export const ALL_CITY_TEXT: string[] = [
  ...SHOPS, ...BLADES, ...ROOF_LINES, ...P5_LINES, ...CITY_SIGNS, MURAL.title, MURAL.body, MURAL.sign,
  ...Object.values(GANTRY).flatMap((g) => [g.word, g.sub, g.back, g.backSub]), '地铁 METRO 出口 公交站 鹈鹕大道 霓虹 环岛 河滨',
];
