// Meme text for billboards, road signs, grades and achievements (content unit expands).
export const BILLBOARD_LINES: string[] = [
  '鹈鹕牌沙丁鱼罐头 一口一个', 'V我50 小鱼干', '前方大鹅出没 请绕行', '禁止投喂鹈鹕',
  '珍爱生命 远离大鹅', '今日宜：撞人', '全场五折 鸽子不来', '卡皮巴拉温泉 情绪稳定 包月价',
  '海鸥：你的薯条 我的了', '人生苦短 骑车要猛', '本路段已被 AI 画过 请谨慎骑行',
];
export const ROAD_SIGNS: string[] = ['限速：随缘', '注意落鱼', '鹈鹕出没', '内卷车道 →', '← 躺平车道', '前方连续弯道 弯弯有大鹅'];

export interface Grade { grade: 'S' | 'A' | 'B' | 'C' | 'D'; title: string }
export const GRADES: Grade[] = [
  { grade: 'S', title: '鹈鹕之神' }, { grade: 'A', title: '鱼塘霸主' }, { grade: 'B', title: '普通鹈鹕' },
  { grade: 'C', title: '鸽了' }, { grade: 'D', title: '咸鱼' },
];

export interface AchievementDef { id: string; name: string; desc: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'comeback', name: '咸鱼翻身', desc: '从最后一名逆袭夺冠' },
  { id: 'double', name: '一鱼两吃', desc: '一次连续击倒两名对手' },
  { id: 'goose', name: '和平从来不是选项', desc: '击倒鹅霸' },
  { id: 'pacifist', name: '情绪稳定', desc: '不出手一次完成比赛' },
  { id: 'pigeon', name: '下次一定', desc: '被隐身的鸽子超车' },
  { id: 'corgi', name: '腿短不是借口', desc: '甩掉柯基警官' },
  { id: 'gulp', name: '吃了吗您', desc: '用大嘴吞噬吞下一名对手' },
  { id: 'showtime', name: 'SHOWTIME', desc: '用鹈鹕天降一次击倒三名对手' },
];
