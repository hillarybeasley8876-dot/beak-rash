// Melee weapons (Road Rash style: knock one off a rival and it's yours). Combat unit owns the numbers.
import type { WeaponId } from '../core/types';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  blurb: string;
  damage: number;      // per hit
  heavyDamage: number; // heavy swing
  reach: number;       // max lateral reach (m)
  swing: number;       // swing duration (s)
  knock: number;       // lateral knockback (m/s)
  uses: number;        // hits before it breaks (Infinity = never)
  weight: number;      // relative odds in crates and rival loadouts (0 = never)
  block: number;       // chance to deflect an incoming melee hit while held and not swinging
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  none: { id: 'none', name: '翅膀', blurb: '鹈鹕的翅膀，扇人很疼。', damage: 7, heavyDamage: 12, reach: 1.9, swing: 0.32, knock: 3.2, uses: Infinity, weight: 0, block: 0 },
  saltfish: { id: 'saltfish', name: '咸鱼', blurb: '咸鱼也有翻身的一天——在别人脸上。', damage: 10, heavyDamage: 16, reach: 2.2, swing: 0.34, knock: 3.6, uses: 8, weight: 5, block: 0 },
  baguette: { id: 'baguette', name: '法棍', blurb: '放了三天，硬度堪比钢管。', damage: 12, heavyDamage: 19, reach: 2.6, swing: 0.38, knock: 3.4, uses: 6, weight: 4, block: 0 },
  pan: { id: 'pan', name: '平底锅', blurb: '抡起来当当响，举起来还能挡一下。', damage: 15, heavyDamage: 24, reach: 2.0, swing: 0.4, knock: 4.8, uses: 6, weight: 3, block: 0.35 },
  leek: { id: 'leek', name: '大葱', blurb: '甩起来有节奏感。', damage: 9, heavyDamage: 14, reach: 2.5, swing: 0.28, knock: 3.0, uses: 10, weight: 4, block: 0 },
  umbrella: { id: 'umbrella', name: '雨伞', blurb: '撑开还能挡一下。', damage: 11, heavyDamage: 17, reach: 2.4, swing: 0.36, knock: 3.8, uses: 7, weight: 3, block: 0.2 },
  selfie: { id: 'selfie', name: '自拍杆', blurb: '最远的距离，是你够不着我。', damage: 8, heavyDamage: 12, reach: 3.0, swing: 0.36, knock: 2.6, uses: 9, weight: 3, block: 0 },
  slipper: { id: 'slipper', name: '妈妈的拖鞋', blurb: '传说级武器。中者必倒。', damage: 22, heavyDamage: 34, reach: 2.0, swing: 0.42, knock: 5.5, uses: 3, weight: 1, block: 0 },
  baton: { id: 'baton', name: '警棍', blurb: '柯基警官的执法工具。只拍坏鹈鹕。', damage: 10, heavyDamage: 14, reach: 1.8, swing: 0.45, knock: 4.2, uses: Infinity, weight: 0, block: 0 },
  keyboard: { id: 'keyboard', name: '机械键盘', blurb: '键盘侠的本命武器，青轴。', damage: 13, heavyDamage: 20, reach: 2.3, swing: 0.36, knock: 4.0, uses: 5, weight: 2, block: 0 },
};

/** Weapons that can appear in crates / loadouts. */
export const ARMORY: WeaponId[] = (Object.keys(WEAPONS) as WeaponId[]).filter((id) => WEAPONS[id].weight > 0);
