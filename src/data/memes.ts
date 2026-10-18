// Meme text for billboards, road signs and grades (content unit). Billboards ≤ 14 字 (a space is the
// preferred line break), signs ≤ 10 字. Achievements live in data/achievements.ts (re-exported here).
import type { TrackId } from '../core/types';

export { ACHIEVEMENTS, type AchievementDef } from './achievements';

/** Fake ads and public notices that fit any track. */
export const BILLBOARD_LINES: string[] = [
  '鹈鹕牌沙丁鱼罐头 免嚼', 'V我50 小鱼干', '前方大鹅出没 请绕行', '禁止投喂鹈鹕',
  '珍爱生命 远离大鹅', '今日宜：撞人', '全场五折 树懒排队中', '卡皮巴拉温泉 泡到不急',
  '海鸥：你的薯条 我的了', '人生苦短 骑车要猛', '鹈鹕骑车 3D 版 已上线',
  '班味退散 骑车解压', '摸鱼专区 请勿打扰', '大鹅驾校 包教包会 包挨啄', '鸽子快递 下次一定送达',
  '哈基米猫粮 吃了会转圈', '狗头保险 保命专用', '树懒外卖 预计送达：明年', '柯基交警 提醒您：戴头盔',
  '失物招领 其实都在海鸥那', '二八大杠 祖传三代 不卖', '本店咸鱼 均可翻身', '小鱼干银行 存鱼送鱼',
  '鹈鹕餐厅 只卖鱼 不卖萌', '骑车别看广告 看路', '广告位招租 电话打不通', '卡皮同款柚子帽 今日上新',
  '多吃鱼 少生气', '信鸽驿站 已读必回', '拒绝内卷 从我做起', '神烦狗墨镜 像素级防晒',
  'OIIA 健身房 转圈减肥', '认准鹈鹕 拒绝山寨', '骑车不规范 柯基两行泪', '今日特价：大鹅不在家',
  '吃鱼补脑 骑车不倒', '只要嘴够大 没有吃不下的鱼', '鸽子的承诺 有效期 0 秒', '鹈鹕牌喉囊 加大号 不漏水',
  '滑总冰淇淋 吃了就想滑', '树懒瑜伽 一个动作一小时', '晒鱼干中 请勿触摸', '搭子招募 一起蹭尾流',
];

/** Track-themed extras (track unit may mix these into its own dressing). */
export const TRACK_BILLBOARDS: Record<TrackId, string[]> = {
  coast: [
    '鹈鹕湾 欢迎你', '海鲜市场 今日鲜鱼', '灯塔下 禁止喂鸥', '防晒霜 大嘴加量装',
    '冲浪？不如骑车', '海风三级 适合飙车', '帆船出租 鹈鹕优先', '海边薯条 请勿单手拿',
  ],
  city: [
    '夜猫子骑行团 招新', '通宵鱼档 越夜越鲜', '夜骑三件套 灯铃头盔', '雨天路滑 漂移更远',
    'City不City？ 很City！', '赛博鹈鹕 今夜上线', '加班到几点？到夺冠', '凌晨的风 适合冲线',
  ],
  mountain: [
    '弯道多 漂移券免费领', '落日很美 但别看太久', '山顶有亭 亭里有鹅', '日落打卡点 出片率100%',
    '上坡靠腿 下坡靠胆', '隧道是山的喉囊', '海拔越高 鱼越贵', '观景台 前方 2 公里',
  ],
};

/**
 * Road signs. The first six are positional (world/dressing reads them as
 * [speed limit, falling fish, pelican crossing, lane right, lane left, curves]): keep their order.
 * [8] is read as the sharp-bend sign by mountain marks; coast looks for the one starting with 急弯.
 */
export const ROAD_SIGNS: string[] = [
  '限速：随缘', '注意落鱼', '鹈鹕出没', '内卷车道 →', '← 躺平车道', '连续弯道 漂起来',
  '禁止鹅叫', '禁止放鸽子', '急弯 别急', '前方测速 柯基执勤', '小心海鸥抢食', '树懒过街 请耐心',
  '鹈鹕专用道', '此处易翻车', '掉头？想都别想', '终点：还远着呢', '前方收费站：一条鱼', '请戴好头盔',
  '猫咪出没 注意杯子', '卡皮巴拉休息区', '允许超车 不许超鹅', '保持车距 尾流除外',
];

/** Track-themed sign extras (mountain is positional: [downhill, tunnel, viewpoint, rocks]). */
export const TRACK_SIGNS: Record<TrackId, string[]> = {
  coast: ['海滩 → 别冲', '码头 鱼多', '灯塔 ←', '浪大 慢骑'],
  city: ['单行道 别回头', '霓虹路段 注意反光', '地铁口 鸽子多', '积水路段 水花加分'],
  mountain: ['连续下坡 别躺平', '前方隧道 请开灯', '观景台 鹅已就位', '落石区 其实是落鱼'],
};

export interface Grade { grade: 'S' | 'A' | 'B' | 'C' | 'D'; title: string }
export const GRADES: Grade[] = [
  { grade: 'S', title: '鹈鹕之神' }, { grade: 'A', title: '鱼塘霸主' }, { grade: 'B', title: '普通鹈鹕' },
  { grade: 'C', title: '鸽了' }, { grade: 'D', title: '咸鱼' },
];
