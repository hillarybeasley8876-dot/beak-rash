// Skill catalogue (SPEC §7, r6 §24). Behaviour lives in gameplay/combat/skills/<id>.ts (combat unit); UI/audio read this.
// Kinds: signature skills belong to one character (pelican: slots 1–3, rivals: 'sig'); 'pool' skills anyone may
// equip; 'ult' skills cost SP (owner null = any character may equip it, SHOWTIME stays the pelican's).
import type { CharacterId, Element } from '../core/types';

/** What a skill is for (the loadout picker's tabs, SPEC §24). */
export type SkillCategory = 'attack' | 'control' | 'move' | 'defense' | 'summon' | 'trap' | 'gag';

export interface SkillDef {
  id: string;
  /** The character a signature skill belongs to; null = the shared pool (or a shared ult). */
  owner: CharacterId | null;
  slot: 1 | 2 | 3 | 'ult' | 'sig' | 'pool';  // pelican 1–3 + ult; rivals 'sig'; r6 'pool' = anyone
  name: string;
  nameEn: string;                   // P5 cut-in text
  desc: string;
  cooldown: number;                 // s
  spCost: number;                   // 0..100
  glyph: string;                    // short HUD glyph (1–2 chars)
  category: SkillCategory;
  /** The element the skill puts on whoever it hits (SPEC §24 reactions). */
  element?: Element;
}

export const CATEGORY_CN: Record<SkillCategory, string> = {
  attack: '攻击', control: '控制', move: '位移', defense: '防御', summon: '召唤', trap: '陷阱', gag: '整活',
};

export const ELEMENT_CN: Record<Element, string> = { fire: '火', ice: '冰', thunder: '雷', water: '水', wind: '风' };

type Row = Omit<SkillDef, 'id'>;
const sig = (owner: CharacterId, r: Omit<Row, 'owner' | 'slot' | 'spCost'>): Row => ({ owner, slot: 'sig', spCost: 0, ...r });
const pool = (r: Omit<Row, 'owner' | 'slot' | 'spCost'>): Row => ({ owner: null, slot: 'pool', spCost: 0, ...r });
const ult = (r: Omit<Row, 'owner' | 'slot' | 'spCost' | 'cooldown'>): Row => ({ owner: null, slot: 'ult', spCost: 100, cooldown: 0, ...r });

const ROWS: Record<string, Row> = {
  // ---- the pelican's kit
  'pelican.torpedo': { owner: 'pelican', slot: 1, name: '咸鱼鱼雷', nameEn: 'FISH TORPEDO', desc: '吐出一条会追踪的咸鱼，命中眩晕。', cooldown: 6, spCost: 0, glyph: '鱼', category: 'attack' },
  'pelican.gulp': { owner: 'pelican', slot: 2, name: '大嘴吞噬', nameEn: 'BIG GULP', desc: '张开喉囊：吞掉飞来的东西，小个子对手也一口吞下再吐到身后。', cooldown: 10, spCost: 0, glyph: '吞', category: 'defense' },
  'pelican.wing': { owner: 'pelican', slot: 3, name: '翼展冲刺', nameEn: 'WING DASH', desc: '张开翅膀乘风冲刺，撞开挡路的一切。', cooldown: 12, spCost: 0, glyph: '翼', category: 'move' },
  'pelican.ult': { owner: 'pelican', slot: 'ult', name: '鹈鹕天降', nameEn: 'SHOWTIME', desc: 'SP 满时发动：腾空俯冲，冲击波横扫前方所有对手。', cooldown: 0, spCost: 100, glyph: '天', category: 'attack' },
  // ---- rival signatures
  'goose.honk': sig('goose', { name: '无差别鹅叫', nameEn: 'HONK', desc: '前方扇形范围内的对手被吓到原地哆嗦。', cooldown: 9, glyph: '嘎', category: 'control' }),
  'capybara.chill': sig('capybara', { name: '情绪稳定领域', nameEn: 'CHILL ZONE', desc: '周围的人都被感染得不想用力蹬了。', cooldown: 12, glyph: '稳', category: 'control' }),
  'cat.spin': sig('cat', { name: 'OIIA 大回旋', nameEn: 'OIIA SPIN', desc: '原地转圈，把身边的人和东西都扫下去。', cooldown: 8, glyph: '转', category: 'attack' }),
  'shiba.doge': sig('shiba', { name: '狗头保命', nameEn: 'DOGE SHIELD', desc: '狗头护体，短时间无敌并加速。', cooldown: 11, glyph: '狗', category: 'defense' }),
  'pigeon.ghost': sig('pigeon', { name: '放鸽子', nameEn: 'NO SHOW', desc: '原地消失，再出现时已经在前面了。', cooldown: 12, glyph: '咕', category: 'move' }),
  'penguin.slide': sig('penguin', { name: '肚皮滑行', nameEn: 'BELLY SLIDE', desc: '趴下滑行：更快，且不会被打中。', cooldown: 10, glyph: '滑', category: 'move' }),
  'seagull.steal': sig('seagull', { name: '薯条抢劫', nameEn: 'MINE!', desc: '抢走附近对手的武器和 SP。', cooldown: 10, glyph: '抢', category: 'gag' }),
  'sloth.flash': sig('sloth', { name: '闪电', nameEn: 'FLASH', desc: '平时很慢，发动后快得离谱。', cooldown: 14, glyph: '电', category: 'move' }),
  'corgi.whistle': sig('corgi', { name: '哔——！', nameEn: 'WHISTLE', desc: '交警吹哨：前方违法车辆减速。', cooldown: 6, glyph: '哔', category: 'control' }),
  // ---- r6 meme roster signatures (SPEC §23)
  'bananacat.peel': sig('bananacat', { name: '香蕉皮', nameEn: 'BANANA PEEL', desc: '身后丢下三块香蕉皮，踩中的原地打滑、方向错乱。', cooldown: 9, glyph: '蕉', category: 'trap' }),
  'cryingcat.tears': sig('cryingcat', { name: '泪如雨下', nameEn: 'TEAR RAIN', desc: '头顶下起小雨：周围的人被淋湿减速，自己哭着加速。', cooldown: 12, glyph: '泪', category: 'control', element: 'water' }),
  'xinxian.fresh': sig('xinxian', { name: '五秒真香', nameEn: 'FIVE-SECOND RULE', desc: '五秒内吸走身边所有道具，每吃一个就更快一点。', cooldown: 14, glyph: '鲜', category: 'move' }),
  'moodeng.bounce': sig('moodeng', { name: 'Q弹冲击', nameEn: 'BOUNCE SLAM', desc: '弹到半空，一屁股砸在前方：范围伤害加眩晕。', cooldown: 10, glyph: '弹', category: 'attack' }),
  'pedro.trash': sig('pedro', { name: '垃圾桶盲盒', nameEn: 'TRASH LOTTERY', desc: '转个圈翻垃圾桶：随机掏出飞弹、武器、小鱼干或臭气。', cooldown: 10, glyph: '桶', category: 'gag' }),
  'hamster.violin': sig('hamster', { name: '悲伤小提琴', nameEn: 'SAD VIOLIN', desc: '拉起悲伤的小提琴：周围的人难过得放不出技能。', cooldown: 13, glyph: '琴', category: 'control' }),
  // ---- r6 shared pool (SPEC §24): anyone may equip these
  'pool.firebreath': pool({ name: '喷火', nameEn: 'FIRE BREATH', desc: '朝前方喷出一道火焰，烧到的人持续掉血。', cooldown: 9, glyph: '火', category: 'attack', element: 'fire' }),
  'pool.icelance': pool({ name: '冰锥', nameEn: 'ICE LANCE', desc: '射出追踪冰锥：冻两层寒冷，叠满三层直接冻住。', cooldown: 7, glyph: '冰', category: 'attack', element: 'ice' }),
  'pool.thunder': pool({ name: '天打雷劈', nameEn: 'THUNDERBOLT', desc: '一道天雷劈中前方对手；下雨天会连成一串。', cooldown: 10, glyph: '雷', category: 'attack', element: 'thunder' }),
  'pool.watergun': pool({ name: '滋水枪', nameEn: 'WATER GUN', desc: '一股水柱把前面的人滋开，顺便淋湿。', cooldown: 6, glyph: '滋', category: 'control', element: 'water' }),
  'pool.tornado': pool({ name: '龙卷风', nameEn: 'TORNADO', desc: '放出一股旋风沿路卷过去，还会把身上的元素吹给旁人。', cooldown: 11, glyph: '旋', category: 'summon', element: 'wind' }),
  'pool.boomerang': pool({ name: '回旋咸鱼', nameEn: 'BOOMERANG FISH', desc: '扔出一条会飞回来的咸鱼，去一下回一下。', cooldown: 8, glyph: '回', category: 'attack' }),
  'pool.pie': pool({ name: '画大饼', nameEn: 'BIG PIE', desc: '朝前面的人扔一张大饼，对方会停下来先吃饼。', cooldown: 12, glyph: '饼', category: 'gag' }),
  'pool.brainfight': pool({ name: '左右脑互搏', nameEn: 'BRAIN FIGHT', desc: '周围的人方向键左右颠倒，越想躲越往里撞。', cooldown: 13, glyph: '乱', category: 'control' }),
  'pool.rocket': pool({ name: '窜天猴', nameEn: 'BOTTLE ROCKET', desc: '屁股点火往前窜，身后留下一道烫脚的火线。', cooldown: 12, glyph: '窜', category: 'move', element: 'fire' }),
  'pool.blink': pool({ name: '闪现', nameEn: 'BLINK', desc: '原地一闪，直接出现在十几米外。', cooldown: 10, glyph: '闪', category: 'move' }),
  'pool.bubble': pool({ name: '泡泡护盾', nameEn: 'BUBBLE SHIELD', desc: '吹个泡泡罩住自己，挡下一次攻击，破掉时溅湿旁人。', cooldown: 14, glyph: '泡', category: 'defense', element: 'water' }),
  'pool.thermos': pool({ name: '枸杞保温杯', nameEn: 'GOJI THERMOS', desc: '喝口枸杞茶：回血，还能清掉身上的负面状态。', cooldown: 16, glyph: '杯', category: 'defense' }),
  'pool.ducks': pool({ name: '鸭鸭大军', nameEn: 'DUCK ARMY', desc: '放出五只小黄鸭往前冲，撞谁谁晃。', cooldown: 12, glyph: '鸭', category: 'summon' }),
  'pool.firecracker': pool({ name: '二踢脚', nameEn: 'FIRECRACKER', desc: '在身后放个二踢脚，有人靠近就炸。', cooldown: 10, glyph: '炮', category: 'trap', element: 'fire' }),
  'pool.popup': pool({ name: '开屏广告', nameEn: 'POP-UP AD', desc: '给前面的人弹个开屏广告，挡住视线好几秒。', cooldown: 12, glyph: '广', category: 'gag' }),
  'pool.warsong': pool({ name: '战歌起', nameEn: 'WAR SONG', desc: '战歌一响：自己加速，拳头也更重。', cooldown: 15, glyph: '歌', category: 'gag' }),
  'pool.snowball': pool({ name: '大雪球', nameEn: 'SNOWBALL', desc: '抛出一个大雪球，砸中一片人并冻上两层寒冷。', cooldown: 9, glyph: '雪', category: 'attack', element: 'ice' }),
  // ---- r6 shared ults (SPEC §24): SP 100, any character
  'ult.timestop': ult({ name: '时间暂停', nameEn: 'TIME STOP', desc: 'SP 满时发动：除了你，所有人定格三秒；这期间的伤害解除时一起结算。', glyph: '停', category: 'control' }),
  'ult.meteor': ult({ name: '陨石雨', nameEn: 'METEOR SHOWER', desc: 'SP 满时发动：前方路面下起陨石雨，砸中的人着火。', glyph: '陨', category: 'attack', element: 'fire' }),
  'ult.storm': ult({ name: '雷暴', nameEn: 'THUNDERSTORM', desc: 'SP 满时发动：前方一片雷雨，淋湿所有人再一道道劈下去。', glyph: '暴', category: 'attack', element: 'thunder' }),
};

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(Object.entries(ROWS).map(([id, r]) => [id, { id, ...r }]));

/** The pelican's default kit (and the HOW TO page's cards). */
export const PLAYER_SKILLS = ['pelican.torpedo', 'pelican.gulp', 'pelican.wing'] as const;
export const PLAYER_ULT = 'pelican.ult';

/** Every skill a character may put in a U / I / O slot: its own signature skills and the shared pool. */
export function equippable(character: CharacterId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.slot !== 'ult' && (s.owner === character || s.slot === 'pool'));
}

/** Every ult a character may put in the P slot: the shared ults and its own. */
export function equippableUlts(character: CharacterId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.slot === 'ult' && (s.owner === null || s.owner === character));
}
