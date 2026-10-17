// Skill catalogue. Behaviour lives in gameplay/combat/skills/<id>.ts (combat unit); UI/audio read this.
import type { CharacterId } from '../core/types';

export interface SkillDef {
  id: string;
  owner: CharacterId;
  slot: 1 | 2 | 3 | 'ult' | 'sig';  // pelican uses 1–3 + ult; rivals have one 'sig'
  name: string;
  nameEn: string;                   // P5 cut-in text
  desc: string;
  cooldown: number;                 // s
  spCost: number;                   // 0..100
  glyph: string;                    // short HUD glyph (1–2 chars)
}

export const SKILLS: Record<string, SkillDef> = {
  'pelican.torpedo': { id: 'pelican.torpedo', owner: 'pelican', slot: 1, name: '咸鱼鱼雷', nameEn: 'FISH TORPEDO', desc: '吐出一条会追踪的咸鱼，命中眩晕。', cooldown: 6, spCost: 0, glyph: '鱼' },
  'pelican.gulp': { id: 'pelican.gulp', owner: 'pelican', slot: 2, name: '大嘴吞噬', nameEn: 'BIG GULP', desc: '张开喉囊：吞掉飞来的东西，小个子对手也一口吞下再吐到身后。', cooldown: 10, spCost: 0, glyph: '吞' },
  'pelican.wing': { id: 'pelican.wing', owner: 'pelican', slot: 3, name: '翼展冲刺', nameEn: 'WING DASH', desc: '张开翅膀乘风冲刺，撞开挡路的一切。', cooldown: 12, spCost: 0, glyph: '翼' },
  'pelican.ult': { id: 'pelican.ult', owner: 'pelican', slot: 'ult', name: '鹈鹕天降', nameEn: 'SHOWTIME', desc: 'SP 满时发动：腾空俯冲，冲击波横扫前方所有对手。', cooldown: 0, spCost: 100, glyph: '天' },
  'goose.honk': { id: 'goose.honk', owner: 'goose', slot: 'sig', name: '无差别鹅叫', nameEn: 'HONK', desc: '前方扇形范围内的对手被吓到原地哆嗦。', cooldown: 9, spCost: 0, glyph: '嘎' },
  'capybara.chill': { id: 'capybara.chill', owner: 'capybara', slot: 'sig', name: '情绪稳定领域', nameEn: 'CHILL ZONE', desc: '周围的人都被感染得不想用力蹬了。', cooldown: 12, spCost: 0, glyph: '稳' },
  'cat.spin': { id: 'cat.spin', owner: 'cat', slot: 'sig', name: 'OIIA 大回旋', nameEn: 'OIIA SPIN', desc: '原地转圈，把身边的人和东西都扫下去。', cooldown: 8, spCost: 0, glyph: '转' },
  'shiba.doge': { id: 'shiba.doge', owner: 'shiba', slot: 'sig', name: '狗头保命', nameEn: 'DOGE SHIELD', desc: '狗头护体，短时间无敌并加速。', cooldown: 11, spCost: 0, glyph: '狗' },
  'pigeon.ghost': { id: 'pigeon.ghost', owner: 'pigeon', slot: 'sig', name: '放鸽子', nameEn: 'NO SHOW', desc: '原地消失，再出现时已经在前面了。', cooldown: 12, spCost: 0, glyph: '咕' },
  'penguin.slide': { id: 'penguin.slide', owner: 'penguin', slot: 'sig', name: '肚皮滑行', nameEn: 'BELLY SLIDE', desc: '趴下滑行：更快，且不会被打中。', cooldown: 10, spCost: 0, glyph: '滑' },
  'seagull.steal': { id: 'seagull.steal', owner: 'seagull', slot: 'sig', name: '薯条抢劫', nameEn: 'MINE!', desc: '抢走附近对手的武器和 SP。', cooldown: 10, spCost: 0, glyph: '抢' },
  'sloth.flash': { id: 'sloth.flash', owner: 'sloth', slot: 'sig', name: '闪电', nameEn: 'FLASH', desc: '平时很慢，发动后快得离谱。', cooldown: 14, spCost: 0, glyph: '电' },
  'corgi.whistle': { id: 'corgi.whistle', owner: 'corgi', slot: 'sig', name: '哔——！', nameEn: 'WHISTLE', desc: '交警吹哨：前方违法车辆减速。', cooldown: 6, spCost: 0, glyph: '哔' },
};

export const PLAYER_SKILLS = ['pelican.torpedo', 'pelican.gulp', 'pelican.wing'] as const;
export const PLAYER_ULT = 'pelican.ult';
