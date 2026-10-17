// Racers. Text is the content unit's; numbers are tuned by combat/sim owners via stats.
// Voice clips (data/voice.ts) match bubble text exactly: never reword a line that has a clip.
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
  taunts: string[];      // speech bubbles while racing (12)
  koLines: string[];     // when this rider KOs someone (6)
  hurtLines: string[];   // when knocked out (6)
  victoryLines: string[]; // podium / results when this rider wins (4)
  defeatLines: string[]; // results when this rider loses (4)
  skillLines: string[];  // shouted when casting the signature skill (3; pelican: torpedo, gulp, wing)
  racer: boolean;        // false = not on the grid (police)
}

export const ROSTER: Record<CharacterId, CharacterDef> = {
  pelican: {
    id: 'pelican', name: '阿鹕', codename: 'BIGMOUTH', title: '海滨公路之王（自封）',
    colors: { primary: '#f4f1ea', secondary: '#f59a23', accent: '#e5191c' },
    stats: { power: 4, speed: 4, handling: 4, weight: 3, hp: 4 },
    skill: 'pelican.torpedo', defaultBike: 'roadbike', scale: 1,
    tagline: '这条路上的鱼，都归我的嘴。',
    taunts: [
      '嘴大吃四方！', '让一让，鹈鹕要过了！', '叮铃铃——', '我的嘴，就是后备箱。',
      '鱼呢？我闻到鱼了！', '这条路，我承包了。', '别慌，我只吃鱼。', '超车？我嘴先过线。',
      '翅膀扇人，嘴巴装鱼。', 'SVG 里的我可没这么帅。', '一嘴入魂！', '前面的，鱼掉了！',
    ],
    koLines: ['一口一个！', '下一位！', '承让承让。', '这一嘴，叫专业。', '吃我一记大嘴！', '躺好，鱼归我了。'],
    hurtLines: ['我的嘴……', '鱼……我的鱼……', '嘴……嘴歪了……', '喉囊漏气了……', '我只是想吃鱼啊！', '说好的主角光环呢？'],
    victoryLines: ['冠军的嘴，就是这么大。', '今晚吃鱼，我请客！', '这才叫鹈鹕骑自行车。', '鱼和冠军，我全都要！'],
    defeatLines: ['鱼没吃饱，发挥失常。', '下一站，嘴会更大。', '不算，我嘴先到的！', '今天风大，翅膀飘了。'],
    skillLines: ['咸鱼鱼雷，发射！', '张嘴！全吞了！', '翅膀张开，起飞！'],
    racer: true,
  },
  goose: {
    id: 'goose', name: '鹅霸', codename: 'HONK', title: '村口一霸',
    colors: { primary: '#ffffff', secondary: '#ff8a00', accent: '#222222' },
    stats: { power: 5, speed: 3, handling: 3, weight: 3, hp: 4 },
    skill: 'goose.honk', defaultBike: 'erba', scale: 0.92,
    tagline: '和平？从来不是选项。',
    taunts: [
      'HONK!!!', '嘎！！', '看什么看，没见过鹅骑车？', '这条路，鹅说了算！',
      '大鹅出没，速速让道！', '你瞅啥？再瞅一个？', '铁锅炖我？先追上我！', '别惹鹅，鹅会记仇。',
      'HONK! 不服来战！', '咬你哦！真咬！', '鹅鹅鹅，曲项向你冲！', '村口那条狗都怕我。',
    ],
    koLines: ['HONK HONK!', '鹅的地盘！', '还有谁？！', '鹅生巅峰！', '服不服？嘎！', '下次见鹅绕道走。'],
    hurtLines: ['嘎……？', '这不可能！', '鹅……鹅记住你了！', '我的羽毛！我的发型！', '你等着，鹅会回来的！', '偷袭！卑鄙的鹈鹕！'],
    victoryLines: ['鹅霸，永远的神！', '冠军是鹅，鹅是冠军！', '全村的鹅都为我骄傲！', 'HONK！这就是实力！'],
    defeatLines: ['不可能！重赛！', '这局不算，鹅没热身！', '我会带全村的鹅回来！', '嘎……（愤怒地拍翅膀）'],
    skillLines: ['无差别鹅叫！HONK！', '都给我哆嗦！', '听鹅一声吼！'],
    racer: true,
  },
  capybara: {
    id: 'capybara', name: '卡皮', codename: 'CHILL', title: '情绪稳定大师',
    colors: { primary: '#a8754a', secondary: '#7a5233', accent: '#ffb000' },
    stats: { power: 3, speed: 3, handling: 3, weight: 5, hp: 5 },
    skill: 'capybara.chill', defaultBike: 'shared', scale: 1.05,
    tagline: '急什么，终点又不会跑。',
    taunts: [
      '那咋了。', '不急，不急。', '（头顶柚子，岁月静好）', '赢了又怎样呢。',
      '你骑你的，我晒我的。', '柚子很重，你不懂。', '内卷？那是什么。', '情绪稳定，是一种天赋。',
      '慢一点，风景很好。', '我只是路过，顺便比赛。', '泡温泉吗？', '嗯，挺好。',
    ],
    koLines: ['不好意思，我没急。', '躺赢。', '哦，你掉了。', '我什么都没做啊。', '顺其自然吧。', '别生气，泡个澡。'],
    hurtLines: ['……嗯。', '也行吧。', '躺一会儿也好。', '柚子没掉就行。', '没事，我不急。', '摔得挺舒服的。'],
    victoryLines: ['原来赢了啊。', '第一名，也就那样。', '不争，就是争。', '奖杯能当澡盆吗？'],
    defeatLines: ['名次而已，柚子还在。', '输了？那就输了吧。', '慢慢来，比较快。', '今天的风，很温柔。'],
    skillLines: ['大家，冷静一下。', '情绪稳定，全员生效。', '深呼吸——'],
    racer: true,
  },
  cat: {
    id: 'cat', name: '哈基米', codename: 'OIIA', title: '转圈圈冠军',
    colors: { primary: '#f2a03d', secondary: '#fff4e0', accent: '#d9534f' },
    stats: { power: 3, speed: 4, handling: 5, weight: 2, hp: 3 },
    skill: 'cat.spin', defaultBike: 'fixie', scale: 0.85,
    tagline: '桌上的东西，都该掉下去。',
    taunts: [
      '哈基米~', 'O-I-I-A-I!', '喵（不屑）', '本喵允许你超车了吗？',
      '你看起来很好推。', '叫主子。', '罐罐呢？罐罐在哪？', '我只是路过，顺手推你。',
      '喵喵拳，了解一下？', '哼，愚蠢的鸟类。', '转起来！OIIA！', '让本喵先过。',
    ],
    koLines: ['推下去了喵。', '下一个杯子是谁？', '掉下去了，好看。', '喵~（舔爪）', '是它自己掉下去的。', '这就是猫的天性。'],
    hurtLines: ['喵呜！', '哈！！', '本喵的毛乱了！', '你、你给我等着喵！', '要罐罐才能好……', '呜……要抱抱。'],
    victoryLines: ['第一名？本喵应得的。', '冠军奖杯，推下去！', '叫一声主子听听。', 'OIIA OIIA！赢喵！'],
    defeatLines: ['本喵只是不想赢。', '哼，不好玩。（扭头）', '比赛哪有纸箱好玩。', '我要去睡十六个小时。'],
    skillLines: ['OIIA OIIA OIIA！', '转转转——！', '本喵转起来谁都拦不住！'],
    racer: true,
  },
  shiba: {
    id: 'shiba', name: '神烦狗', codename: 'DOGE', title: '狗头保命专家',
    colors: { primary: '#e8a35c', secondary: '#fff7ea', accent: '#2b2b2b' },
    stats: { power: 3, speed: 4, handling: 4, weight: 3, hp: 3 },
    skill: 'shiba.doge', defaultBike: 'mtb', scale: 0.9,
    tagline: 'much speed. very wow.',
    taunts: [
      'such fast.', '[狗头]', '汪！（墨镜反光）', 'very bike. wow.',
      'much speed. so 快.', 'wow. 你好慢。', '此路是我开 [狗头]', 'so 卷. very 累.',
      '墨镜一戴，谁也不爱。', '汪汪？（意味深长）', 'amaze. 你追不上。', 'many 对手. no 威胁.',
    ],
    koLines: ['very ko. wow.', '[狗头保命]', 'such win. much wow.', '汪！（推墨镜）', 'bye bye. 汪。', 'you lose. 我 win.'],
    hurtLines: ['much pain.', '呜汪……', 'so ouch. very 疼.', '墨镜……墨镜歪了……', 'not wow. 一点也不。', '狗头……保不住了……'],
    victoryLines: ['such champion. wow.', '狗头，永不倒下。', 'very 第一. much 骄傲.', '汪！（墨镜闪光）'],
    defeatLines: ['such sad. 很 sad.', '狗头保命，名次不保。', 'no wow today.', '墨镜挡住了我的眼泪。'],
    skillLines: ['狗头护体！', 'shield. wow.', '狗头保命，启动！'],
    racer: true,
  },
  pigeon: {
    id: 'pigeon', name: '咕咕', codename: 'GUGU', title: '鸽王',
    colors: { primary: '#8e98a8', secondary: '#5d6b80', accent: '#3fbf8f' },
    stats: { power: 2, speed: 5, handling: 4, weight: 1, hp: 2 },
    skill: 'pigeon.ghost', defaultBike: 'roadbike', scale: 0.75,
    tagline: '下次一定。',
    taunts: [
      '咕咕咕。', '在路上了在路上了。', '下次一定！', '已经出门了，真的。',
      '快到了，就差一点。', '我先咕一会儿。', '说好的？什么说好的。', '等我，马上就来。',
      '别催，在穿鞋了。', '回头一定超你。', '今天状态不好，改天。', '咕？',
    ],
    koLines: ['咕！', '鸽了你。', '咕咕，你被鸽了。', '下次一定扶你起来。', '这次没鸽，意外吧？', '咕——再见！'],
    hurtLines: ['咕……', '我会回来的（大概）', '下次……一定……躲开……', '羽毛，掉了一地……', '这把先鸽了……', '咕呜……约好的呢……'],
    victoryLines: ['准时到达，就这一次。', '第一名，没鸽！', '这次，我没迟到！', '咕咕！意不意外？'],
    defeatLines: ['下次一定赢。', '冠军？在路上了。', '咕……改天再比。', '我鸽了我自己。'],
    skillLines: ['放鸽子！', '我先走一步，咕。', '看不见我，看不见我。'],
    racer: true,
  },
  penguin: {
    id: 'penguin', name: '滑总', codename: 'SLIDE', title: '南极漂移之神',
    colors: { primary: '#1d1f2b', secondary: '#ffffff', accent: '#ffcc00' },
    stats: { power: 3, speed: 4, handling: 3, weight: 4, hp: 4 },
    skill: 'penguin.slide', defaultBike: 'kidbike', scale: 0.88,
    tagline: '能滑就别骑。',
    taunts: [
      '滑就完事了。', '冰面太少，差评。', '（摇摇摆摆）', '冷静，我比冰还冷。',
      '能滑着，绝不蹬着。', '南极来的，不怕摔。', '摩擦力？过时了。', '这路面，滑度不够。',
      '穿西装骑车，礼貌。', '低调地超个车。', '优雅，永不过时。', '让一让，滑过来了。',
    ],
    koLines: ['滑铲成功！', '冷静点。', '冰镇一下你。', '太慢了，像在融化。', '这叫专业滑铲。', '出发前，记得打蜡。'],
    hurtLines: ['冰……冰呢……', '啪叽。', '西装……弄脏了……', '这地，不够滑……', '我只是滑倒了，不是输了。', '冷静……我很冷静……'],
    victoryLines: ['冠军，一滑到底。', '优雅地赢，才叫赢。', '南极为我骄傲。', '保持冷静，保持第一。'],
    defeatLines: ['今天的路面不配我。', '没冰，发挥不出来。', '冷静，只是热身。', '优雅地输，也是优雅。'],
    skillLines: ['肚皮滑行，启动！', '趴下，起飞！', '滑——————'],
    racer: true,
  },
  seagull: {
    id: 'seagull', name: '薯条大盗', codename: 'MINE', title: '海滨惯犯',
    colors: { primary: '#f4f6f8', secondary: '#9aa4b2', accent: '#ffd23f' },
    stats: { power: 3, speed: 4, handling: 4, weight: 2, hp: 3 },
    skill: 'seagull.steal', defaultBike: 'roadbike', scale: 0.82,
    tagline: '你的，就是我的。',
    taunts: [
      'MINE!', '薯条交出来！', '这条路也是我的。', '全部都是 MINE！',
      '你的鱼，现在是我的。', '看什么？我捡的。', '借我玩玩，不还。', '海鸥的事，能叫抢吗？',
      '番茄酱也给我！', '好东西！我的了！', '我只是借，永久的那种。', '我眼神很真诚的。',
    ],
    koLines: ['MINE MINE MINE!', '谢谢款待。', '你的名次，我拿走了。', '顺手的事。', '战利品+1！', '多谢惠顾！'],
    hurtLines: ['我的薯条！', '啊啊啊——', '战利品掉了！', '我还会回来抢的！', '这不公平，我还没抢！', '谁偷了我的薯条？！'],
    victoryLines: ['冠军？也是我的。', '奖杯，我收下了！', '全场最佳，抢来的。', '第一名也是 MINE！'],
    defeatLines: ['今天手气不好。', '下次，连冠军一起抢。', '薯条没了，名次也没了。', '我只是没找到好东西。'],
    skillLines: ['归我了！MINE!', '交出来吧你！', '打劫！别动！'],
    racer: true,
  },
  sloth: {
    id: 'sloth', name: '闪电', codename: 'FLASH', title: '慢……慢……来',
    colors: { primary: '#9c8466', secondary: '#d9c8a9', accent: '#3a2e22' },
    stats: { power: 2, speed: 2, handling: 2, weight: 4, hp: 5 },
    skill: 'sloth.flash', defaultBike: 'tandem', scale: 0.95,
    tagline: '我……很……快……的。',
    taunts: [
      '你……好……', '马……上……到……', '（打了个哈欠）', '我……在……加……速……',
      '等……我……一……下……', '让……一……让……', '别……急……', '天……气……真……好……',
      '你……超……我……了？', '我……是……闪……电……', '慢……就……是……快……', '（缓缓地眨了一下眼）',
    ],
    koLines: ['哈……哈……哈……', '早……说……了……', '你……倒……了……', '我……没……用……力……', '抱……歉……啊……', '慢……慢……躺……'],
    hurtLines: ['哎……呀……', '……', '（三秒后）好……痛……', '我……先……躺……会……', '没……关……系……', '被……打……了……吗……'],
    victoryLines: ['我……赢……了……？', '第……一……名……耶……', '冠……军……是……我……', '从……不……迟……到……'],
    defeatLines: ['下……次……吧……', '比……完……了……？', '我……刚……热……身……', '不……重……要……'],
    skillLines: ['闪电！！！', '全速前进！！', '看好了，这才是闪电！'],
    racer: true,
  },
  corgi: {
    id: 'corgi', name: '柯基警官', codename: 'POLICE', title: '交警（腿短但执法严格）',
    colors: { primary: '#e89a4f', secondary: '#ffffff', accent: '#1f4fd1' },
    stats: { power: 3, speed: 5, handling: 4, weight: 3, hp: 5 },
    skill: 'corgi.whistle', defaultBike: 'mtb', scale: 0.8,
    tagline: '腿短不影响执法！',
    taunts: [
      '靠边停车！', '哔——！', '驾驶证、行车证、鱼证！', '前方车辆，请减速！',
      '腿短，但我追得上！', '超速了啊，朋友！', '我站起来也就这么高。', '骑车不戴头盔？哦你戴了。',
      '依法执行，请配合。', '别跑！我腿短我不怕！', '你被监控拍到了！', '谁乱扔咸鱼？',
    ],
    koLines: ['抓到你了！', '依法拦截！', '请配合执法。', '这叫执法到位。', '法网恢恢！', '记一次违章！'],
    hurtLines: ['袭警？！', '我……我腿短不是错！', '记下来，袭警一次！', '帽子！我的警帽！', '呼叫支援！汪！', '我的哨子呢？！'],
    victoryLines: ['执法第一，速度第一！', '腿短，照样第一。', '交通安全，人人有责！', '本警官，从不迟到。'],
    defeatLines: ['今天先放你一马。', '腿……真的太短了……', '记住你了，等着罚单！', '我去写报告了。'],
    skillLines: ['哔——！全体减速！', '前方车辆，靠边！', '吹哨执法！'],
    racer: false,
  },
};

/** 柯基警官's police chase lines (race unit picks by phase; ≤ 12 字, shown as toasts). */
export interface PoliceLines { alert: string[]; chase: string[]; busted: string[]; lost: string[] }

export const POLICE_LINES: PoliceLines = {
  alert: [
    '哔——！前方车辆靠边！', '接到举报：有鹈鹕超速！', '收到！马上出警！', '别动！交警！',
    '呼叫总部：发现目标。', '就是你，大嘴的那个！',
  ],
  chase: [
    '别跑！腿短也能追上你！', '再跑就罚双倍！', '跑得了鹈鹕，跑不了庙！', '我的腿在努力了！',
    '请立即停车接受检查！', '你逃不出我的手掌心！',
  ],
  busted: [
    '罚款！小鱼干交出来！', '抓到了！请配合检查。', '超速加袭击，罚！', '这是罚单，收好。',
    '下次注意交通安全！', '证件齐全，但小鱼干要交。',
  ],
  lost: [
    '可恶……腿太短了……', '让你跑了……下回见！', '呼叫支援……算了。', '算你跑得快！',
    '我会记住你的嘴！', '收队，写报告去了。',
  ],
};

export const RACER_POOL: CharacterId[] = (Object.keys(ROSTER) as CharacterId[]).filter(
  (id) => ROSTER[id].racer && id !== 'pelican',
);
