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
};
