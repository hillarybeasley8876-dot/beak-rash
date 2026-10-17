// UI copy owned by ui-screens (menu blurbs, career cups, settings help, credits). Kind, meme-flavoured.
import type { ScreenId } from '../core/contracts';

export interface MenuEntry { cn: string; en: string; to: ScreenId; blurb: string }

export const MENU: MenuEntry[] = [
  { cn: '巡回赛', en: 'CAREER', to: 'career', blurb: '三杯九站，从菜鸟杯一路卷到鹈鹕神杯。' },
  { cn: '快速比赛', en: 'QUICK RACE', to: 'trackSelect', blurb: '随便挑条路，先撞了再说。' },
  { cn: '车库', en: 'GARAGE', to: 'garage', blurb: '从二八大杠到死飞，总有一辆配得上你的嘴。' },
  { cn: '设置', en: 'CONFIG', to: 'settings', blurb: '音量、画质、震动，还有慢镜头的浓度。' },
  { cn: '操作', en: 'HOW TO', to: 'howto', blurb: 'J 往左扇，L 往右扇，K 用力扇。' },
  { cn: '致谢', en: 'CREDITS', to: 'credits', blurb: '感谢所有把链条画在鹈鹕脖子上的大模型。' },
];

export interface Cup { tier: 1 | 2 | 3; cn: string; en: string; motto: string }

export const CUPS: Cup[] = [
  { tier: 1, cn: '菜鸟杯', en: 'ROOKIE CUP', motto: '大家都是第一次骑车，别紧张。' },
  { tier: 2, cn: '内卷杯', en: 'GRIND CUP', motto: '对手开始带武器了，还会记仇。' },
  { tier: 3, cn: '鹈鹕神杯', en: 'PELICAN GOD CUP', motto: '传说中只有嘴最大的才能夺冠。' },
];

export const CREDITS: Array<[string, string]> = [
  ['总导演', '一只想吃鱼的鹈鹕'],
  ['物理顾问', '牛顿的苹果（未到场）'],
  ['大鹅协调员', '职位空缺（没人敢应聘）'],
  ['卡皮巴拉情绪管理', '卡皮巴拉本人'],
  ['首席转圈官', '哈基米'],
  ['墨镜赞助', '神烦狗的私人收藏'],
  ['准时到场率统计', '咕咕（下次一定）'],
  ['冰面采购', '滑总（至今未到货）'],
  ['餐饮', '薯条大盗（已自行取用）'],
  ['进度管理', '闪电（马……上……好……）'],
  ['交通安全顾问', '柯基警官'],
  ['链条位置审核', '所有画过鹈鹕骑车的大模型'],
  ['咸鱼供应', '鹈鹕湾海鲜市场'],
  ['拖鞋提供', '每一位妈妈'],
  ['测试员', '摔了 999 次的阿鹕'],
  ['特别感谢', '正在玩这个游戏的你'],
];

export const CREDIT_OUTRO = '本游戏中没有任何真实鹈鹕受到伤害。大鹅表示保留追究的权利。';
