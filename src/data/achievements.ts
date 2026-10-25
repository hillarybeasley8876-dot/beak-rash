// Achievement catalogue (ids are stable: the save file and ui read them). Rules live in
// gameplay/achievements/*; the order here is the display order. A retired id (ult_first, the first SHOWTIME)
// may linger in old saves: ui only lists and counts ids defined here.
export interface AchievementDef { id: string; name: string; desc: string; icon: string }

const DEFS = {
  // ---- placing & finishing
  first_win: { name: '冠军体质', desc: '第一次拿下冠军', icon: '冠' },
  podium: { name: '上台领鱼', desc: '跑进前三名', icon: '台' },
  comeback: { name: '咸鱼翻身', desc: '从最后一名逆袭夺冠', icon: '翻' },
  clutch: { name: '绝杀', desc: '最后冲刺阶段反超夺冠', icon: '绝' },
  photo_finish: { name: '一嘴之差', desc: '领先不到 0.3 秒险胜', icon: '嘴' },
  blowout: { name: '一骑绝尘', desc: '领先第二名 10 秒以上夺冠', icon: '尘' },
  last_place: { name: '重在参与', desc: '以最后一名完赛', icon: '参' },
  pacifist: { name: '情绪稳定', desc: '全程不出手完成比赛', icon: '稳' },
  untouched: { name: '片叶不沾身', desc: '毫发无伤地完成比赛', icon: '叶' },
  phoenix: { name: '越挫越勇', desc: '翻车三次仍跑进前三', icon: '勇' },
  kidbike: { name: '童心未泯', desc: '骑儿童滑步车夺冠', icon: '童' },
  erba: { name: '传家宝', desc: '骑二八大杠夺冠', icon: '传' },
  // ---- fighting ("亲手" = by the player's own hands: SHOWTIME's own KOs only count toward 'showtime')
  first_ko: { name: '开饭了', desc: '第一次击倒对手', icon: '饭' },
  double: { name: '一鱼两吃', desc: '3 秒内亲手连续击倒两名对手', icon: '双' },
  triple: { name: '一条龙服务', desc: '6 秒内亲手击倒三名对手', icon: '龙' },
  hat_trick: { name: '帽子戏法', desc: '一场比赛亲手击倒三名对手', icon: '帽' },
  rampage: { name: '暴力鹈鹕', desc: '一场比赛亲手击倒六名对手', icon: '暴' },
  everyone: { name: '众生平等', desc: '一场比赛亲手击倒四种对手', icon: '众' },
  goose: { name: '和平从来不是选项', desc: '亲手击倒鹅霸', icon: '鹅' },
  one_more: { name: '再来亿下', desc: '单场触发五次 ONE MORE!', icon: '亿' },
  thief: { name: '顺手牵鱼', desc: '一场比赛抢走三把武器', icon: '牵' },
  slipper: { name: '童年阴影', desc: '用妈妈的拖鞋击倒对手', icon: '鞋' },
  keyboard: { name: '键盘侠本侠', desc: '用机械键盘击倒对手', icon: '键' },
  payback: { name: '物归原主', desc: '被海鸥抢劫后 10 秒内击倒它', icon: '还' },
  // ---- skills
  torpedo: { name: '鱼到病除', desc: '用咸鱼鱼雷击倒对手', icon: '鱼' },
  gulp: { name: '吃了吗您', desc: '用大嘴吞噬吞下小个子对手', icon: '吞' },
  wing: { name: '大鹏展翅', desc: '一次翼展冲刺撞开三名对手', icon: '翼' },
  showtime: { name: 'SHOWTIME', desc: '用鹈鹕天降一次击倒三名对手', icon: '天' },
  // ---- riding
  perfect_start: { name: '赢在起跑线', desc: '完美起步', icon: '起' },
  drift3: { name: '粉色火花', desc: '放出一次三段漂移加速', icon: '漂' },
  perfect3: { name: '落地生根', desc: '一场比赛完美落地三次', icon: '落' },
  slingshot: { name: '蹭饭达人', desc: '一场比赛尾流弹射超车五次', icon: '蹭' },
  near_miss: { name: '贴脸艺术家', desc: '一场比赛擦肩而过十次', icon: '险' },
  // ---- mishaps & rivals
  pigeon: { name: '下次一定', desc: '被隐身的鸽子超车', icon: '鸽' },
  sloth: { name: '比树懒还慢', desc: '在树懒发动闪电时被它超车', icon: '懒' },
  goosed: { name: '鹅从中来', desc: '被鹅霸击倒', icon: '嘎' },
  water: { name: '下海捞鱼', desc: '连人带车冲进海里', icon: '海' },
  busted: { name: '我错了警官', desc: '被柯基警官开罚单', icon: '罚' },
  corgi: { name: '腿短不是借口', desc: '甩掉柯基警官', icon: '柯' },
  // ---- career: cups (ui/progress.ts clears) and totals (save.stats)
  cup1: { name: '新手村毕业', desc: '通关菜鸟杯', icon: '村' },
  cup2: { name: '卷王驾到', desc: '通关内卷杯', icon: '卷' },
  cup3: { name: '鹈鹕封神', desc: '通关鹈鹕神杯', icon: '封' },
  career: { name: '大嘴吃四方', desc: '巡回赛三个杯赛全部通关', icon: '终' },
  veteran: { name: '风雨无阻', desc: '累计完成 20 场比赛', icon: '雨' },
  kos100: { name: '百鸟朝凤', desc: '累计击倒 100 名对手', icon: '百' },
  // ---- r4: air tricks & STYLE chains (SPEC §16–§17)
  backflip: { name: '鹈鹕后空翻', desc: '一次后空翻，稳稳落地', icon: '空' },
  trick_combo: { name: '花活三连', desc: '一次腾空连做三个特技并落地', icon: '连' },
  superman: { name: '超鹕', desc: '摆出超人姿势，落地前收回车把', icon: '超' },
  style_5k: { name: '浪到飞起', desc: '一次 STYLE 连段拿下 5,000 分', icon: '浪' },
  style_broken: { name: '煮熟的鸭子飞了', desc: '2,000 分以上的 STYLE 连段被打断', icon: '煮' },
  // ---- r4: police 2.0 & the pan (SPEC §14–§15)
  corgi_down: { name: '柯基下班了', desc: '把柯基警官打得提前下班', icon: '班' },
  parry: { name: '当！', desc: '用平底锅完美格挡一次', icon: '当' },
  wanted3: { name: '法外狂鹕', desc: '被通缉到三颗星，还把警察甩掉了', icon: '星' },
  bribe: { name: 'V我50', desc: '柯基警官收下了你的 50 小鱼干', icon: '贿' },
  // ---- r4: rivals & alliances (SPEC §18)
  nemesis: { name: '冤冤相报', desc: '击倒找你寻仇的宿敌', icon: '仇' },
  alliance_break: { name: '塑料友谊', desc: '围剿你的联盟自己打起来了', icon: '塑' },
  alliance_win: { name: '以一敌三', desc: '被围剿的比赛照样夺冠', icon: '围' },
  // ---- r4: track events (SPEC §19)
  event_survivor: { name: '见怪不怪', desc: '一场遇上两次赛道突发事件也没翻车', icon: '怪' },
  // ---- r4: maps & modes (SPEC §20)
  watertown: { name: '江南第一鹕', desc: '在江南水乡夺冠', icon: '江' },
  gobi: { name: '大漠孤鹕', desc: '在戈壁公路夺冠', icon: '漠' },
  reverse: { name: '倒反天罡', desc: '在反向赛道夺冠', icon: '倒' },
  snow: { name: '踏雪寻鱼', desc: '在雪天夺冠', icon: '雪' },
  route: { name: '天马行空', desc: '在随机路线上夺冠', icon: '路' },
  llm_win: { name: '幻觉加速', desc: '骑大模型限定款夺冠', icon: '幻' },
  // ---- r4: easter eggs (SPEC §21)
  ducks: { name: '这是鸭子不是鹈鹕', desc: '五条赛道的路边，各藏着一只', icon: '鸭' },
  svg: { name: '致敬原作', desc: '有幅画画歪了。扔点什么过去', icon: '画' },
  goose_poem: { name: '鹅鹅鹅', desc: '对着鹅霸，把车铃按得像诗一样', icon: '诗' },
  sloth_wait: { name: '你也不急？', desc: '比树懒还沉得住气', icon: '等' },
  pelican_god: { name: '心诚则灵', desc: '抬头看云。看到了，就摇铃', icon: '神' },
  konami: { name: '链条接在脖子上', desc: '↑↑↓↓……后面是什么来着？', icon: '码' },
  eggs_all: { name: '彩蛋猎人', desc: '找到全部九个彩蛋', icon: '彩' },
} satisfies Record<string, Omit<AchievementDef, 'id'>>;

export type AchievementId = keyof typeof DEFS;

export const ACHIEVEMENTS: AchievementDef[] = (Object.keys(DEFS) as AchievementId[]).map((id) => ({ id, ...DEFS[id] }));

export const isAchievementId = (id: string): id is AchievementId => Object.prototype.hasOwnProperty.call(DEFS, id);
