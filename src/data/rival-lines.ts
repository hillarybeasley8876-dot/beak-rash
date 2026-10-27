// Rival lines of the r4 rivals (SPEC §18): the nemesis speaks with its own lines (the grudge is personal),
// the alliance has its own shout, and the betrayal has its own meme. Kind voice, no real people, no brands.
import type { CharacterId } from '../core/types';

/** The 8 rival species (the pelican is the player, the corgi is the police). */
export const RIVAL_SPECIES: readonly CharacterId[] = [
  'goose', 'capybara', 'cat', 'shiba', 'pigeon', 'penguin', 'seagull', 'sloth',
];

/** 宿敌 lines: what a rival says when it is this race's nemesis (4 per species). */
export const NEMESIS_LINES: Record<CharacterId, string[]> = {
  pelican: ['又是你？行吧，来吧。', '今天这条赛道，归我了。'],
  goose: ['还记得村口那一下吗？', '鹅记仇，官方认证。', '别跑，账还没算完！', '今天这条街，鹅说了算。'],
  capybara: ['我是有耐心的人，但我不慢。', '上次的账，我记着呢。', '别催，我这就来。', '输赢不重要，反正会记仇。'],
  cat: ['本喵等这一天等很久了。', '上次你推的那下，还给你。', '转圈之前，先算账。', '本喵的记性，可比你好。'],
  shiba: ['such 复仇. very 认真.', '上次那笔账，我记下了。', '狗头记仇，从不迟到。', 'amaze. 这次换我咬。'],
  pigeon: ['上次放你鸽子，这次不放了。', '我回来了，账也带来了。', '说好的下次，就是现在。', '这次真的不鸽，骗你是鹈鹕。'],
  penguin: ['滑总记仇，用的是冰。', '上次那跤，我记着呢。', '这次我滑得更快一点。', '西装着地，账也记着。'],
  seagull: ['MINE 回来啦！', '你的鱼，我记下了。', '上次顺走的，这次一起算。', '薯条可以给你，鱼不行。'],
  sloth: ['我……记得……那件事……', '慢……但是……会到的……', '这次……不会让你跑掉……', '急什么……账……又不会跑……'],
  corgi: ['又是你？站住！', '执法记录仪开着呢！'],
  bananacat: ['上次你让我哭了，这次换你。', '香蕉皮，专门给你留的。', '哭着也要追上你！', '这笔账，泪里记着。'],
  cryingcat: ['我没记仇……（记了）', '大拇指收回，账还没算。', '含泪也要讨个说法。', '这次，轮到你掉眼泪。'],
  xinxian: ['上次抢我饭的，是你吧？', '这口气，我趁热出。', '五秒之内，追上你。', '新鲜的仇，最好报。'],
  moodeng: ['上次那下，我咬住不放。', '小河马，记性很大。', '这次，弹到你脸上。', '别跑，我脾气还没消。'],
  pedro: ['你扔的东西，我都记着。', '这次转圈，绕着你转。', '垃圾桶里，翻出了旧账。', '跳完这支舞，就算账。'],
  hamster: ['小提琴为你拉响了。', '我难过，你也别想开心。', '那天的事，我腮帮子里存着。', '这一曲，叫复仇。'],
};

/** 围剿: the shout when the rivals gang up on the player. */
export const ALLIANCE_LINES: Record<CharacterId, string> = {
  pelican: '别跑！',
  goose: '围上！别让它跑了！',
  capybara: '大家一起上……应该没问题。',
  cat: '本喵们 coordinated 一下。',
  shiba: 'such 团队. very 团结.',
  pigeon: '说好了一起鸽的呢？',
  penguin: '排队，一个一个来。',
  seagull: '今天的鱼，全归我们！',
  sloth: '大家……一起上……虽然很慢……',
  corgi: '全体注意！',
  bananacat: '大家一起，把它弄哭！',
  cryingcat: '一起上，我给大家点赞。',
  xinxian: '趁热，围上去！',
  moodeng: '一起压上去，弹扁它！',
  pedro: '围起来，转起来！',
  hamster: '大家……一起悲伤地围上去。',
};

/** 塑料友谊: an ally that hits an ally. */
export const BETRAYAL_LINE = '塑料友谊！';

/** 宿敌 KO 玩家: the nemesis gets the player back. */
export const NEMESIS_STRIKE_LINE = '这只是开始。';

/** The nemesis KO'd by the player: the grudge is settled (for now). */
export const NEMESIS_DOWN_LINES: Record<CharacterId, string> = {
  pelican: '算你狠。',
  goose: '嘎……下次鹅再来！',
  capybara: '嗯……这次算你的。',
  cat: '本喵记住了，喵！',
  shiba: 'such ko. will remember.',
  pigeon: '这次没鸽，下次一定。',
  penguin: '滑总……记住了。',
  seagull: 'MINE 还在我这儿呢！',
  sloth: '慢……会还的……',
  corgi: '记下了！',
  bananacat: '呜哇……这次算你赢！',
  cryingcat: '没事……我很好……（泪）',
  xinxian: '凉了……下次趁热来。',
  moodeng: '哼唧！下次咬回来！',
  pedro: '转晕了……先记着。',
  hamster: '小提琴……下次再拉。',
};

/** The intro card line of the nemesis (a grudge line). */
export const GRUDGE_LINES: Record<CharacterId, string> = {
  pelican: '宿敌登场。',
  goose: '村口那只鹅，来了。',
  capybara: '不急，但来了。',
  cat: '本喵回来了。',
  shiba: '老对手了。',
  pigeon: '这次不鸽。',
  penguin: '滑总来讨个说法。',
  seagull: '顺路抢个鱼。',
  sloth: '慢……但还是来了。',
  corgi: '旧账新算。',
  bananacat: '哭包回来报仇了。',
  cryingcat: '含泪归来。',
  xinxian: '新鲜的仇，趁热。',
  moodeng: '小河马，没消气。',
  pedro: '垃圾桶之王驾到。',
  hamster: '小提琴响起来了。',
};
