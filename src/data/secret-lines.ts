// The lines of the easter eggs (SPEC §21). The copy lives in data so the gameplay module stays logic-only.
export const SECRET_LINES = {
  /** The duck toast: how many of the five are on the profile. */
  duck: (n: number): string => `找到小黄鸭！(${n}/5)`,
  /** All five ducks: the garage grows a duck rider row. */
  duckAll: '五只小黄鸭齐了！车把上给你安排一位乘客。',
  /** The SVG easel: a thrown weapon pays homage to the original. */
  svg: '致敬原作！+50 小鱼干',
  /** The pelican god: a bell under the cloud pelican. */
  god: '心诚则灵 +50 小鱼干',
  /** The goose recites the poem. */
  goose: '鹅鹅鹅，曲项向天歌——',
  /** The sloth stops and waits for the lazy rider. */
  sloth: '你也不急？',
  /** The caption on the easel's canvas. */
  caption: 'Generate an SVG of a pelican riding a bicycle',
} as const;
