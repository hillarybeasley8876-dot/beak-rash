// Meme text for billboards, road signs and grades (content unit). Billboards ≤ 14 字 (a space is the
// preferred line break), signs ≤ 10 字. Achievements live in data/achievements.ts (re-exported here).
import type { TrackId } from '../core/types';

export { ACHIEVEMENTS, type AchievementDef } from './achievements';

/** Fake ads and public notices that fit any track. */
export const BILLBOARD_LINES: string[] = [
  '鹈鹕牌沙丁鱼罐头 一口一个', 'V我50 小鱼干', '前方大鹅出没 请绕行', '禁止投喂鹈鹕',
  '珍爱生命 远离大鹅', '今日宜：撞人', '全场五折 大鹅免进', '卡皮巴拉温泉 情绪稳定 包月价',
  '海鸥：你的薯条 我的了', '人生苦短 骑车要猛', '本路段已被 AI 画过',
  '喉囊扩容 限时特惠', '咸鱼翻身 指日可待', '大鹅驾校 包教包会 包挨啄', '鸽子快递 下次一定送达',
  '哈基米猫粮 吃了会转圈', '狗头保险 保命专用', '树懒外卖 预计送达：明年', '柯基驾校 腿短也能考',
  '薯条失窃 请联系海鸥', '二八大杠 祖传三代 不卖', '本店咸鱼 均可翻身', '小鱼干银行 存鱼送鱼',
  '嘴大吃四方 鹈鹕餐厅', '骑车别看广告 看路', '广告位招租 大鹅勿扰', '卡皮同款柚子帽 今日上新',
  '多吃鱼 少生气', '鸽子的话 不能信', '拒绝内卷 从我做起', '神烦狗墨镜 像素级防晒',
  'OIIA 健身房 转圈减肥', '认准鹈鹕 拒绝山寨', '骑车不规范 柯基两行泪', '今日特价：大鹅不在家',
  '吃鱼补脑 骑车不倒', '只要嘴够大 没有吃不下的鱼', '鸽子的承诺 有效期 0 秒', '鹈鹕牌喉囊 加大号 不漏水',
  '滑总冰淇淋 吃了就想滑', '慢行 前方有树懒', '海风很大 鱼很咸', '链条不接脖子 正规鹈鹕车行',
];

/** Track-themed extras (track unit may mix these into its own dressing). */
export const TRACK_BILLBOARDS: Record<TrackId, string[]> = {
  coast: [
    '鹈鹕湾 欢迎你', '海鲜市场 今日鲜鱼', '灯塔下 禁止喂鸥', '防晒霜 鹈鹕专用',
    '冲浪？不如骑车', '海风三级 适合飙车', '帆船出租 鹈鹕优先', '小心海鸥 看好薯条',
  ],
  city: [
    '霓虹夜城 不夜之鹅', '通宵鱼档 越夜越鲜', '夜骑请开灯 鹅在暗处', '雨天路滑 大鹅更凶',
    '城市套路深 我要回海边', '赛博鹈鹕 今夜上线', '加班到几点？到夺冠', '霓虹灯下 没有无辜的鸟',
  ],
  mountain: [
    '山路十八弯 弯弯有大鹅', '落日很美 但别看太久', '山顶有亭 亭里有鹅', '小心落石 其实是落鱼',
    '登山不易 骑车更难', '隧道里 请勿鹅叫', '秋名山？不，落日山', '观景台 前方 2 公里',
  ],
};

/**
 * Road signs. The first six are positional (world/dressing reads them as
 * [speed limit, falling fish, pelican crossing, lane right, lane left, curves]): keep their order.
 */
export const ROAD_SIGNS: string[] = [
  '限速：随缘', '注意落鱼', '鹈鹕出没', '内卷车道 →', '← 躺平车道', '连续弯道 弯弯有鹅',
  '禁止鹅叫', '禁止放鸽子', '急弯 别急', '前方测速 柯基执勤', '小心海鸥抢食', '树懒过街 请耐心',
  '鹈鹕专用道', '此处易翻车', '掉头？不存在的', '终点：还远着呢', '前方收费站：一条鱼', '请戴好头盔',
  '猫咪出没 注意杯子', '卡皮巴拉休息区', '允许超车 不许超鹅', '注意：路面有咸鱼',
];

/** Track-themed sign extras. */
export const TRACK_SIGNS: Record<TrackId, string[]> = {
  coast: ['海滩 → 别冲', '码头 鱼多', '灯塔 ←', '浪大 慢骑'],
  city: ['夜间限速：看心情', '霓虹路段 注意反光', '地铁口 鸽子多', '雨天 鹅更滑'],
  mountain: ['连续下坡 别躺平', '前方隧道 请开灯', '观景台 鹅已就位', '落石区 其实是落鱼'],
};

export interface Grade { grade: 'S' | 'A' | 'B' | 'C' | 'D'; title: string }
export const GRADES: Grade[] = [
  { grade: 'S', title: '鹈鹕之神' }, { grade: 'A', title: '鱼塘霸主' }, { grade: 'B', title: '普通鹈鹕' },
  { grade: 'C', title: '鸽了' }, { grade: 'D', title: '咸鱼' },
];
