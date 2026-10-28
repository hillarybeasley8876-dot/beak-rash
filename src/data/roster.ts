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
    tagline: '这条路上的鱼，都归我这张嘴。',
    taunts: [
      '嘴大吃四方！', '让一让，鹈鹕要过了！', '叮铃铃——', '我的喉囊，就是后备箱。',
      '鱼呢？我闻到鱼了！', '泼天的鱼，轮到我了！', '别慌，我只吃鱼。', '脚蹼踩踏板，稳得很。',
      '翅膀扇人，嘴巴装鱼。', 'SVG 里的我可没这么帅。', '鹈鹕骑车，这对吗？对！', '前面的，鱼掉了！',
    ],
    koLines: ['一口一个！', '下一位！', '承让承让。', '躺好，鱼归我了。', '下车歇会，鱼我替你吃。', 'KO 一个，加餐一条。'],
    hurtLines: ['我的嘴……', '鱼……我的鱼……', '翅膀……抽筋了……', '喉囊漏气了……', '就想吃口鱼，这么难吗？', '说好的主角光环呢？'],
    victoryLines: ['这才叫鹈鹕骑自行车。', '今晚的鱼，我请客！', '鱼和冠军，打包带走！', '主角，从不跑龙套。'],
    defeatLines: ['鱼没吃饱，发挥失常。', '不算，我嘴先到的！', '逆风局，鹈鹕也会累。', '下一站，羽毛梳好再来。'],
    skillLines: ['咸鱼快递，到付！', '张嘴！全吞了！', '借过！翅膀比路宽！'],
    racer: true,
  },
  goose: {
    id: 'goose', name: '鹅霸', codename: 'HONK', title: '村口一霸',
    colors: { primary: '#ffffff', secondary: '#ff8a00', accent: '#222222' },
    stats: { power: 5, speed: 3, handling: 3, weight: 3, hp: 4 },
    skill: 'goose.honk', defaultBike: 'erba', scale: 0.92,
    tagline: '村口规矩：鹅先走。',
    taunts: [
      'HONK!!!', '嘎！！', '看什么看，没见过鹅骑车？', '硬控你！HONK！',
      '铁锅炖我？先追上我！', '你瞅啥？再瞅一个试试？', '菜就多练，嘎！', '别惹鹅，鹅会记仇。',
      '咬你哦！真咬！', '鹅鹅鹅，曲项向你冲！', '村口那条狗都怕我。', '先别开香槟，鹅还在！',
    ],
    koLines: ['HONK HONK!', '鹅的地盘！', '鹅生巅峰！', '服不服？嘎！', '下次见鹅绕道走。', '拧一下，长记性！'],
    hurtLines: ['嘎……？', '这不可能！', '鹅……鹅已老实……', '我的羽毛！我的发型！', '谁？！谁偷袭鹅？！', '绷不住了，嘎！'],
    victoryLines: ['冠军是鹅，鹅是冠军！', 'HONK！这就是实力！', '村口大喇叭：鹅赢了！', '领奖台，也得给鹅让道。'],
    defeatLines: ['不可能！重赛！', '赛道有问题，鹅没问题。', '鹅的复仇，从今晚开始。', '嘎……（愤怒地拍翅膀）'],
    skillLines: ['无差别鹅叫！HONK！', '全体，原地哆嗦！', '听鹅一声吼！'],
    racer: true,
  },
  capybara: {
    id: 'capybara', name: '卡皮', codename: 'CHILL', title: '松弛感大师',
    colors: { primary: '#a8754a', secondary: '#7a5233', accent: '#ffb000' },
    stats: { power: 3, speed: 3, handling: 3, weight: 5, hp: 5 },
    skill: 'capybara.chill', defaultBike: 'shared', scale: 1.05,
    tagline: '急什么，终点又不会跑。',
    taunts: [
      '那咋了。', '不急，不急。', '（头顶柚子，岁月静好）', '赢了又怎样呢。',
      '你骑你的，我晒我的。', '柚子很重，你不懂。', '内卷？没听说过。', '松弛感，懂吗？',
      '慢一点，风景很好。', '淡人，不争第一。', '泡温泉吗？', '嗯，挺好。',
    ],
    koLines: ['不好意思，我没急。', '躺赢。', '哦，你掉了。', '我什么都没做啊。', '顺其自然吧。', '别生气，泡个澡。'],
    hurtLines: ['……嗯。', '也行吧。', '躺一会儿也好。', '柚子没掉就行。', '就当做了个瑜伽。', '摔得挺舒服的。'],
    victoryLines: ['原来赢了啊。', '第一名，也就那样。', '不争，就是争。', '奖杯能当澡盆吗？'],
    defeatLines: ['名次而已，柚子还在。', '输了？那就输了吧。', '慢慢来，比较快。', '今天的风，很温柔。'],
    skillLines: ['大家，冷静一下。', '全员，进入养生模式。', '深呼吸——'],
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
      '你看起来很好推。', '叫主子。', '罐罐呢？罐罐在哪？', '尊嘟假嘟？你在追我？',
      '猫猫拳，一秒十拳！', '哼，愚蠢的鸟类。', '转起来！OIIA！', '本喵，就是显眼包。',
    ],
    koLines: ['推下去了喵。', '下一个杯子是谁？', '这一推，很有艺术感。', '喵~（舔爪）', '是它自己掉下去的。', '这就是猫的天性。'],
    hurtLines: ['喵呜！', '哈！！', '本喵的毛乱了！', '这不是本喵的错！', '要罐罐才能好……', '呜……要抱抱。'],
    victoryLines: ['第一名？本喵应得的。', '冠军奖杯，推下去！', '奖杯归我，罐罐也归我。', 'OIIA OIIA！赢了喵！'],
    defeatLines: ['本喵让你的，懂？', '哼，不好玩。（扭头）', '比赛哪有纸箱好玩。', '我要去睡十六个小时。'],
    skillLines: ['OIIA OIIA OIIA！', '转转转——！', '本喵转起来谁都拦不住！'],
    racer: true,
  },
  shiba: {
    id: 'shiba', name: '神烦狗', codename: 'DOGE', title: '狗头军师',
    colors: { primary: '#e8a35c', secondary: '#fff7ea', accent: '#2b2b2b' },
    stats: { power: 3, speed: 4, handling: 4, weight: 3, hp: 3 },
    skill: 'shiba.doge', defaultBike: 'mtb', scale: 0.9,
    tagline: 'much speed. very wow.',
    taunts: [
      'such fast.', '[狗头]', '汪！（墨镜反光）', 'very bike. wow.',
      'much speed. so 快.', 'wow. 你好慢.', '此路是我开 [狗头]', 'so 卷. very 累.',
      'deal with it. 汪.', '汪汪？（意味深长）', 'amaze. 你追不上.', 'many 对手. no 威胁.',
    ],
    koLines: ['very ko. wow.', '[狗头保命]', 'such win. much wow.', 'wow.（侧目）', 'bye bye. 汪.', 'you lose. 我 win.'],
    hurtLines: ['much pain.', '呜汪……', 'so ouch. very 疼.', '墨镜……墨镜歪了……', 'not wow. 一点也不.', '狗头……保不住了……'],
    victoryLines: ['such champion. wow.', 'very 第一. much 骄傲.', 'wow. 领奖台 很稳.', '狗头，永不倒下.'],
    defeatLines: ['such sad. 很 sad.', '名次不保. 狗头还在.', 'no wow today.', '墨镜挡住了我的眼泪.'],
    skillLines: ['狗头护体！', 'shield. wow.', 'such 反弹. very 弹.'],
    racer: true,
  },
  pigeon: {
    id: 'pigeon', name: '咕咕', codename: 'GUGU', title: '鸽王',
    colors: { primary: '#8e98a8', secondary: '#5d6b80', accent: '#3fbf8f' },
    stats: { power: 2, speed: 5, handling: 4, weight: 1, hp: 2 },
    skill: 'pigeon.ghost', defaultBike: 'roadbike', scale: 0.75,
    tagline: '鸽王驾到——下次。',
    taunts: [
      '咕咕咕。', '在路上了在路上了。', '下次一定！', '赛鸽血统，懂？',
      '已读，下次回。', '信鸽出身，认路！', '说好的？什么说好的。', '头一点，速度就来。',
      '别催，在穿鞋了。', '这身绿紫，叫高级感。', '偷感拉满，咕。', '咕？',
    ],
    koLines: ['咕！', '鸽了你。', '下次一定扶你起来。', '这次没鸽，意外吧？', '咕——再见！', '一点头，你就没了。'],
    hurtLines: ['咕……', '我会回来的（大概）', '天旋地转，咕……', '羽毛，掉了一地……', '脖子的光泽……没了……', '地图……没显示这个……'],
    victoryLines: ['准时到达，就这一次。', '第一名，没鸽！', '我爷爷是信鸽，真的。', '咕咕！冠军已送达。'],
    defeatLines: ['冠军？先欠着。', '我鸽了我自己。', '风太大，翅膀偏航了。', '广场还有面包，先撤。'],
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
      '滑就完事了。', '冰面太少，差评。', '（摇摇摆摆）', '班味？我只有冰味。',
      '能滑着，绝不蹬着。', '南极来的，不怕摔。', '摩擦力？过时了。', '西装革履，顺路超车。',
      'i 人，只想安静地赢。', '肚皮比轮子靠谱。', '你蹬十下，我滑一下。', '（张开鳍，保持平衡）',
    ],
    koLines: ['滑铲成功！', '冷静点。', '冰镇一下你。', '太慢了，像在融化。', '借过，不送。', '出发前，记得打蜡。'],
    hurtLines: ['冰……冰呢……', '啪叽。', '西装……弄脏了……', '鳍……鳍麻了……', '摔也要摔出南极范儿。', '冷静……我很冷静……'],
    victoryLines: ['冠军，一滑到底。', '领奖台要是冰的，更好。', '全程没蹬，就赢了。', '这就是正装的速度。'],
    defeatLines: ['输了也要保持队形。', '明天，我自带滑板。', '输了，但西装没皱。', '优雅地输，也是优雅。'],
    skillLines: ['肚皮着地，起滑！', '趴下，起飞！', '滑——————'],
    racer: true,
  },
  seagull: {
    id: 'seagull', name: '薯条大盗', codename: 'MINE', title: '海滨惯犯',
    colors: { primary: '#f4f6f8', secondary: '#9aa4b2', accent: '#ffd23f' },
    stats: { power: 3, speed: 4, handling: 4, weight: 2, hp: 3 },
    skill: 'seagull.steal', defaultBike: 'roadbike', scale: 0.82,
    tagline: '你的，就是我的。',
    taunts: [
      'MINE!', '薯条交出来！', '这条路也是我的。', '古希腊掌管薯条的神。',
      '你的鱼，现在是我的。', '看什么？我捡的。', '借我玩玩，不还。', '海鸥的事，能叫抢吗？',
      '番茄酱也给我！', '主打一个顺手。', '先到先得，后到看我。', '我眼神很真诚的。',
    ],
    koLines: ['MINE MINE MINE!', '谢谢款待。', '你的名次，我拿走了。', '小票不用了。', '战利品+1！', '收工，下一单。'],
    hurtLines: ['我的薯条！', '啊啊啊——', '我的口袋……空了……', '赃……战利品撒了一地！', '这不公平，我还没抢！', '黑吃黑？！'],
    victoryLines: ['冠军，归我保管了。', '奖杯，我收下了！', '全场最佳，抢来的。', '领奖台上，薯条管够！'],
    defeatLines: ['今天手气不好。', '下次，连冠军一起抢。', '薯条没了，名次也没了。', '今天的海风，偏心。'],
    skillLines: ['归我了！MINE!', '顺走！不用谢！', '打劫！别动！'],
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
      '等……我……一……下……', '卷……不……动……', '别……急……', '天……气……真……好……',
      '你……超……我……了？', '我……是……闪……电……', '慢……就……是……快……', '（缓缓地眨了一下眼）',
    ],
    koLines: ['哈……哈……哈……', '早……说……了……', '你……倒……了……', '我……没……用……力……', '抱……歉……啊……', '慢……慢……躺……'],
    hurtLines: ['哎……呀……', '……', '（三秒后）好……痛……', '我……先……躺……会……', '没……关……系……', '被……打……了……吗……'],
    victoryLines: ['我……赢……了……？', '第……一……名……耶……', '冠……军……是……我……', '奖……杯……好……重……'],
    defeatLines: ['下……次……吧……', '比……完……了……？', '我……睡……着……了……', '不……重……要……'],
    skillLines: ['闪电！！！', '加载完毕，冲！！', '看好了，这才是闪电！'],
    racer: true,
  },
  corgi: {
    id: 'corgi', name: '柯基警官', codename: 'POLICE', title: '交警（腿短但执法严格）',
    colors: { primary: '#e89a4f', secondary: '#ffffff', accent: '#1f4fd1' },
    stats: { power: 3, speed: 5, handling: 4, weight: 3, hp: 5 },
    skill: 'corgi.whistle', defaultBike: 'mtb', scale: 0.8,
    tagline: '腿短不影响执法！',
    taunts: [
      '靠边停车！', '哔——！', '驾驶证、行车证、鱼证！', '情绪价值给到，罚单照开。',
      '我的耳朵，听得见超速。', '哨子一响，全场肃静。', '我站起来也就这么高。', '骑车不戴头盔？哦你戴了。',
      '执法记录仪，开着呢。', '别跑！腿短，但我执着！', '你被监控拍到了！', '谁乱扔咸鱼？',
    ],
    koLines: ['抓到你了！', '依法拦截！', '法网恢恢！', '记一次违章！', '扣你三条小鱼干。', '安全第一，你第二。'],
    hurtLines: ['袭警？！', '腿短……也是会摔的……', '这个摔法，不合规……', '帽子！我的警帽！', '呼叫支援！汪！', '我的哨子呢？！'],
    victoryLines: ['执法第一，速度第一！', '腿短，照样第一。', '交通安全，人人有责！', '出警速度：第一名。'],
    defeatLines: ['今天先放你一马。', '腿……真的太短了……', '记住你了，等着罚单！', '我去申请一辆长腿车。'],
    skillLines: ['哔——！全体减速！', '前方车辆，靠边！', '吹哨执法！'],
    racer: false,
  },
  // ---- r6 meme roster (SPEC §23): racer false until their species models land (then the lead flips them) ----
  bananacat: {
    id: 'bananacat', name: '香蕉猫', codename: 'BANANA', title: '香蕉里的哭包',
    colors: { primary: '#ffd84a', secondary: '#fff3b0', accent: '#6b4a1e' },
    stats: { power: 3, speed: 4, handling: 4, weight: 2, hp: 3 },
    skill: 'bananacat.peel', defaultBike: 'kidbike', scale: 0.8,
    tagline: '哭归哭，蹬车不能停。',
    taunts: [
      '呜哇——（边哭边蹬）', '香蕉皮是我的战袍。', '别看我，我在哭。', '眼泪是燃料，懂吗？',
      '我哭得越大声，蹬得越快。', '谁敢剥我，我就哭。', '一边哭一边超你车。', '香蕉味的眼泪，尝尝？',
      '今天也是委屈的一天。', '哭完这段，下段接着哭。', '呜呜呜，前面让个道。', '黄色，是最勇敢的颜色。',
    ],
    koLines: ['对不起……呜哇！', '我不是故意的！哭！', '你摔了，我先哭为敬。', '眼泪擦干，下一个。', '踩到香蕉皮了吧？', '赢了也要哭一下。'],
    hurtLines: ['哇啊啊啊——！', '我的香蕉皮破了……', '本来就想哭，这下好了。', '呜……没人疼我……', '眼泪……不够用了……', '香蕉，熟透了……'],
    victoryLines: ['赢了！感动到哭！', '喜极而泣，香蕉版。', '冠军的眼泪，是甜的。', '奖杯湿了，是我哭的。'],
    defeatLines: ['输了，哭得更大声了。', '哭够了再来比。', '没关系，本来就在哭。', '香蕉皮，也会被踩扁的。'],
    skillLines: ['香蕉皮，接好了！', '滑倒吧，陪我一起哭！', '剥一个，扔一个！'],
    racer: true,
  },
  cryingcat: {
    id: 'cryingcat', name: '泪眼猫猫', codename: 'TEARY', title: '含泪竖大拇指',
    colors: { primary: '#d9d4cc', secondary: '#8fd3ff', accent: '#ffb3c1' },
    stats: { power: 2, speed: 4, handling: 4, weight: 2, hp: 4 },
    skill: 'cryingcat.tears', defaultBike: 'shared', scale: 0.82,
    tagline: '我很好，真的。（泪）',
    taunts: [
      '我没事，我很好。（泪）', '（含泪点赞）', '眼眶湿了，车还稳。', '委屈，但是超车。',
      '再超我，我就掉小珍珠。', '大拇指给你，眼泪给我。', '哭着骑，也是骑。', '这风好大，吹得我眼酸。',
      '我不哭，是汗。', '眼泪不值钱，名次值钱。', '点个赞，然后超了你。', '猫猫只是路过……顺便赢。',
    ],
    koLines: ['对不住了，点个赞。', '你哭吧，我陪你哭。', '含泪拿下。', '给你一个大拇指。', '摔疼了吧？我懂。', '下一个，别让我哭。'],
    hurtLines: ['呜……就知道会这样。', '我很好……才怪。', '大拇指……也折了……', '眼泪掉下来了……', '哭也没用了……', '谁来抱抱猫猫……'],
    victoryLines: ['冠军！给自己点个赞。', '感动的泪，咸咸的。', '原来赢的时候也想哭。', '领奖台好高，有点怕。'],
    defeatLines: ['没事的，真的没事。（泪）', '输了，拇指照样竖着。', '哭一场，明天再比。', '猫猫尽力了……'],
    skillLines: ['泪水攻势，发动！', '都别动，我要哭了！', '泪如雨下——！'],
    racer: true,
  },
  xinxian: {
    id: 'xinxian', name: '新鲜哥', codename: 'FRESH', title: '只吃五秒内的饭',
    colors: { primary: '#f08a24', secondary: '#fff1dc', accent: '#3a9b4a' },
    stats: { power: 3, speed: 5, handling: 3, weight: 2, hp: 3 },
    skill: 'xinxian.fresh', defaultBike: 'erba', scale: 0.84,
    tagline: '过了五秒，就不新鲜了。',
    taunts: [
      '倒计时五秒，开吃！', '喂食器一响，我就到。', '凉了的饭，不吃。', '这条赛道，还算新鲜。',
      '冷饭？拿走拿走。', '第六秒的饭，归别人。', '我挑食，但我不挑路。', '咔嚓一响，饭来了！',
      '流浪惯了，路都熟。', '新鲜的风，新鲜的我。', '橘猫的胃，很讲究。', '快点快点，饭要凉了！',
    ],
    koLines: ['你，过期了。', '五秒到，下桌。', '不新鲜，不要了。', '新鲜出炉的KO！', '你凉了，我不吃。', '趁热，下一个。'],
    hurtLines: ['饭……凉了……', '喵嗷！谁动我饭碗！', '饭碗……被端走了……', '橘色的毛，沾灰了……', '这顿，吃不上了……', '流浪的路，真不好走。'],
    victoryLines: ['冠军！趁热领奖！', '最新鲜的第一名。', '奖杯刚出炉，烫手。', '今天的饭，格外香。'],
    defeatLines: ['没赶上热的，可惜。', '这名次，有点馊了。', '等下一碗新鲜的。', '喂食器没响，不算。'],
    skillLines: ['新鲜的，全是我的！', '五秒之内，统统吃掉！', '开饭啦！'],
    racer: true,
  },
  moodeng: {
    id: 'moodeng', name: '弹跳猪', codename: 'MOODENG', title: '爱咬人的小河马',
    colors: { primary: '#6f7a8c', secondary: '#f2a7b5', accent: '#ffffff' },
    stats: { power: 5, speed: 2, handling: 3, weight: 5, hp: 5 },
    skill: 'moodeng.bounce', defaultBike: 'mtb', scale: 0.9,
    tagline: '小小一只，脾气很大。',
    taunts: [
      '别摸我，我会咬。', 'Q弹Q弹，冲啊！', '我小，但我凶。', '刚泡完澡，滑溜溜。',
      '饲养员都追不上我。', '一身水光，闪到你了吗？', '弹起来，砸下去！', '起床气，还没消。',
      '脸圆不是错。', '谁拍我？收费的。', '嘴小，咬合力大。', '翻个身，接着骑。',
    ],
    koLines: ['咬到了！', '弹飞你！', '小河马，大力气。', '服了吧？哼。', '压扁了，下一个。', '这一口，记一辈子。'],
    hurtLines: ['哼唧……', '我要回水里……', '饲养员！有人欺负我！', '弹不起来了……', '脸着地，好疼……', '水光……没了……'],
    victoryLines: ['冠军是我，全园最弹！', '赢了，回去泡个澡。', '小小冠军，大大脾气。', '领奖台，我一屁股坐稳。'],
    defeatLines: ['哼！不玩了！', '咬人的心，已经有了。', '不服！咬一口奖杯。', '回水里泡一泡再说。'],
    skillLines: ['弹跳——砸！', 'Q弹冲击！', '全体，接住这一弹！'],
    racer: true,
  },
  pedro: {
    id: 'pedro', name: '佩德罗', codename: 'PEDRO', title: '垃圾桶之王',
    colors: { primary: '#8a8f99', secondary: '#2b2d33', accent: '#ffcf3f' },
    stats: { power: 3, speed: 4, handling: 5, weight: 2, hp: 3 },
    skill: 'pedro.trash', defaultBike: 'fixie', scale: 0.85,
    tagline: '旋转，跳跃，翻垃圾桶。',
    taunts: [
      '转起来，根本停不住！', '这垃圾桶，我包了。', '戴眼罩，不是去抢劫。', '吃之前，先洗洗手。',
      '夜班选手，白天也行。', '节奏一响，原地转圈。', '翻到宝了！是个瓶盖。', '你扔的，我都捡。',
      '舞步比你车技好。', '尾巴一圈一圈，好看吧？', '别催，我在转圈。', '嗅到了，前面有好东西。',
    ],
    koLines: ['转晕你！', '回收成功。', '分类：可回收。', '转一圈，你就晕了。', '谢谢惠顾。', '你掉的，归我了。'],
    hurtLines: ['转……转晕了……', '我的眼罩歪了……', '垃圾桶，翻了……', '尾巴打结了……', '舞，跳不动了……', '今晚没收获……'],
    victoryLines: ['冠军！转个圈庆祝！', '奖杯？洗洗再收。', '最佳舞步奖，也是我。', '今晚的宝藏，就是第一名。'],
    defeatLines: ['没关系，垃圾桶还在。', '转太多，转偏了。', '下次，换个桶翻。', '舞还没跳完呢。'],
    skillLines: ['开桶！看看有啥！', '接住！随机惊喜！', '统统扔给你！'],
    racer: true,
  },
  hamster: {
    id: 'hamster', name: '悲伤仓鼠', codename: 'SADHAM', title: '自带小提琴配乐',
    colors: { primary: '#e8c49a', secondary: '#fff4e6', accent: '#5b4636' },
    stats: { power: 2, speed: 3, handling: 4, weight: 1, hp: 3 },
    skill: 'hamster.violin', defaultBike: 'kidbike', scale: 0.7,
    tagline: '难过，但还在蹬。',
    taunts: [
      '（小提琴响起）', '我在难过，别吵。', '腮帮子里，全是心事。', '跑滚轮出身，腿很快。',
      '大眼睛，看透一切。', '前面的，听听这旋律。', '悲伤，也是一种速度。', '瓜子呢？我的瓜子呢？',
      '今天的我，也很忧郁。', '别超我，我会更难过。', '凝视你，直到你内疚。', '音乐一响，眼睛就湿。',
    ],
    koLines: ['对不起，我也很难过。', '你也来听小提琴吧。', '悲伤，会传染的。', '下车了，节哀。', '一曲送你。', '这首，叫你输了。'],
    hurtLines: ['吱……', '瓜子……全掉了……', '小提琴，断弦了……', '果然，又是这样……', '腮帮子……瘪了……', '让我在滚轮上静静……'],
    victoryLines: ['赢了……但还是想哭。', '冠军的小提琴，是欢快的。', '这一刻，瓜子管够。', '大眼睛里，闪着奖杯。'],
    defeatLines: ['果然，悲伤才是常态。', '小提琴，拉得更响了。', '回笼里，静静地难过。', '算了，我习惯了。'],
    skillLines: ['来点悲伤的配乐。', '大家，一起难过吧。', '小提琴，起！'],
    racer: true,
  },
};

/** 柯基警官's police chase lines (race unit picks by phase; ≤ 12 字, shown as toasts). */
export interface PoliceLines { alert: string[]; chase: string[]; busted: string[]; lost: string[] }

export const POLICE_LINES: PoliceLines = {
  alert: [
    '哔——！那只鹈鹕，靠边！', '接到举报：有鹈鹕超速！', '收到！马上出警！', '别动！交警！',
    '呼叫总部：发现目标。', '就是你，大嘴的那个！',
  ],
  chase: [
    '再跑就罚双倍！', '跑了鹈鹕，跑不了鹈鹕湾！', '我的腿在努力了！', '请立即停车接受检查！',
    '你逃不出我的鼻子！', '短腿，长追！',
  ],
  busted: [
    '罚款！小鱼干交出来！', '抓到了！请配合检查。', '超速加袭击，罚！', '这是罚单，收好。',
    '下次，注意车速！', '证件齐全，但小鱼干要交。',
  ],
  lost: [
    '可恶……今天风太大……', '让你跑了……下回见！', '追不动了……先喝口水。', '算你跑得快！',
    '这张大嘴，我画下来了！', '收队，写报告去了。',
  ],
};

export const RACER_POOL: CharacterId[] = (Object.keys(ROSTER) as CharacterId[]).filter(
  (id) => ROSTER[id].racer && id !== 'pelican',
);

/** r6 (SPEC §23): every racer, the pelican included: the player picks one, the field is drawn from the rest. */
export const RACERS: CharacterId[] = (Object.keys(ROSTER) as CharacterId[]).filter((id) => ROSTER[id].racer);
