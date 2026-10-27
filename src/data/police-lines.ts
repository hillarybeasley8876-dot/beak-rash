// The corgi officer's Police 2.0 lines (SPEC §14). The old chase lines stay in data/roster.ts
// (POLICE_LINES); these are the new ones the officer says while it fights, sets up a roadblock,
// goes down or takes (or refuses) the 「V我50」 bribe. No voice clips exist for them yet, so the
// bubble is the only channel — do not reword a line that later gets a clip.
export interface CorgiLines {
  /** The wind-up tell before the baton swing. */
  windup: readonly string[];
  /** The baton connects. */
  strike: readonly string[];
  /** The second corgi joins the chase. */
  backup: readonly string[];
  /** The roadblock goes up ahead of the player. */
  roadblock: readonly string[];
  /** The corgi is knocked out of the chase and clocks off (r6: the line of the down, said at once). */
  down: string;
  /** The bribe is accepted. */
  bribeYes: readonly string[];
  /** The bribe is refused: at ★3. */
  bribeNoW3: readonly string[];
  /** The bribe is refused: not enough coins. */
  bribeNoCoins: readonly string[];
  /** The bribe is refused: too many bribes this race already. */
  bribeNoThird: readonly string[];
}

export const CORGI_LINES: CorgiLines = {
  windup: ['站住！', '别动！手举高！', '最后一次警告！'],
  strike: ['警棍警告！', '这一棍算你倒霉！', '敬酒不吃吃罚酒！'],
  backup: ['呼叫增援！', '单位呼叫单位！还有人！', '二队到位！'],
  roadblock: ['前方设卡，看你往哪跑！', '前面有卡口，下车！', '此路不通，请绕行——才怪！'],
  down: '柯基下班了！',
  bribeYes: ['……下不为例。', '拿钱买平安？行吧……', '这次就当没看见。'],
  bribeNoW3: ['这次不行！', '想都别想！', '风声正紧，走开！'],
  bribeNoCoins: ['小鱼干不够还想贿赂？', '至少五十条！少一条都不行！'],
  bribeNoThird: ['事不过三！', '你已经试过两次了！', '贿赂三次，罪加一等！'],
};
