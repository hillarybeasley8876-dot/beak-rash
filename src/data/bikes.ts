// Bikes (garage/shop). Physics reads the numbers; the text is the content unit's.
import type { BikeId } from '../core/types';

export interface BikeDef {
  id: BikeId;
  name: string;
  blurb: string;            // one-line shop description (meme)
  price: number;            // 小鱼干
  topSpeed: number;         // m/s on flat asphalt without boost
  accel: number;            // m/s² at low speed
  handling: number;         // steering authority multiplier (1 = baseline)
  brake: number;            // m/s² braking
  weight: number;           // collision mass factor (1 = baseline)
  durability: number;       // bonus max HP
  offroad: number;          // 0..1, 1 = no off-road penalty
  /** Shop bar ratings 1..5 (derived but hand-checked). */
  bars: { speed: number; accel: number; handling: number; weight: number; durability: number };
}

export const BIKES: Record<BikeId, BikeDef> = {
  roadbike: {
    id: 'roadbike', name: '风之翼 公路车', blurb: '轻到海风一吹就跑，所以骑快点。', price: 0,
    topSpeed: 20, accel: 6.2, handling: 1, brake: 12, weight: 1, durability: 0, offroad: 0.35,
    bars: { speed: 4, accel: 4, handling: 3, weight: 2, durability: 2 },
  },
  erba: {
    id: 'erba', name: '二八大杠', blurb: '爷爷传下来的。撞谁谁知道。', price: 800,
    topSpeed: 19, accel: 4.6, handling: 0.82, brake: 9, weight: 1.6, durability: 30, offroad: 0.5,
    bars: { speed: 3, accel: 2, handling: 2, weight: 5, durability: 5 },
  },
  shared: {
    id: 'shared', name: '共享单车', blurb: '扫码即骑。押金？什么押金？', price: 99,
    topSpeed: 17, accel: 5.4, handling: 0.95, brake: 10, weight: 1.15, durability: 10, offroad: 0.4,
    bars: { speed: 2, accel: 3, handling: 3, weight: 3, durability: 3 },
  },
  fixie: {
    id: 'fixie', name: '死飞', blurb: '刹车？那是什么，能吃吗？', price: 1500,
    topSpeed: 22.5, accel: 6.6, handling: 1.08, brake: 5, weight: 0.85, durability: -10, offroad: 0.25,
    bars: { speed: 5, accel: 4, handling: 4, weight: 1, durability: 1 },
  },
  mtb: {
    id: 'mtb', name: '山地车', blurb: '避震拉满，颠簸路段也能睡着。', price: 1200,
    topSpeed: 19.5, accel: 6, handling: 1.12, brake: 13, weight: 1.15, durability: 15, offroad: 0.9,
    bars: { speed: 3, accel: 4, handling: 4, weight: 3, durability: 4 },
  },
  tandem: {
    id: 'tandem', name: '双人协力车', blurb: '后座乘客：一条很凶的咸鱼。', price: 2500,
    topSpeed: 21.5, accel: 5.2, handling: 0.78, brake: 10, weight: 1.45, durability: 20, offroad: 0.4,
    bars: { speed: 5, accel: 3, handling: 2, weight: 4, durability: 4 },
  },
  kidbike: {
    id: 'kidbike', name: '儿童滑步车', blurb: '没有踏板，全靠腿蹬。童年回来了。', price: 66,
    topSpeed: 16.5, accel: 7.4, handling: 1.4, brake: 14, weight: 0.6, durability: -15, offroad: 0.6,
    bars: { speed: 1, accel: 5, handling: 5, weight: 1, durability: 1 },
  },
};

export const BIKE_ORDER: BikeId[] = ['roadbike', 'shared', 'kidbike', 'erba', 'mtb', 'fixie', 'tandem'];
