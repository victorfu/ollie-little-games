export type Element = 'none' | 'fire' | 'earth' | 'moon' | 'wind' | 'light' | 'shadow';
export type StatusId = 'burn' | 'regen' | 'stun' | 'sleep' | 'bind' | 'slow' | 'haste' | 'weak' | 'boost' | 'break' | 'guard' | 'shield' | 'taunt' | 'silence' | 'blind' | 'hidden';
export type Stats = { maxHp: number; maxMp: number; attack: number; magic: number; healing: number; defense: number; resistance: number; speed: number; crit: number; evade: number };
export type Effect = { status: StatusId; turns: number; chance?: number };
export type Skill = { name: string; mp: number; target: 'enemy' | 'enemies' | 'ally' | 'self'; power?: number; damage?: 'physical' | 'magic'; element?: Element; hits?: number; effects?: Effect[]; shield?: number; heal?: number; cleanse?: boolean; dispel?: boolean; restoreMp?: number; knockback?: number; sureHit?: boolean; stealthCrit?: boolean };
export const skills = {
  flame: { name: '燃刃', mp: 6, target: 'enemy', power: 1.5, damage: 'physical', element: 'fire', effects: [{ status: 'burn', turns: 2, chance: .4 }] },
  taunt: { name: '引火', mp: 4, target: 'enemy', effects: [{ status: 'taunt', turns: 2 }] },
  cover: { name: '掩護', mp: 6, target: 'ally', shield: .15 },
  crush: { name: '崩拳', mp: 6, target: 'enemy', power: 1.3, damage: 'physical', element: 'earth', effects: [{ status: 'break', turns: 2 }] },
  combo: { name: '連環拳', mp: 8, target: 'enemy', power: .6, hits: 4, damage: 'physical', element: 'earth', effects: [{ status: 'stun', turns: 1, chance: .1 }] },
  stance: { name: '站樁', mp: 4, target: 'self', effects: [{ status: 'guard', turns: 2 }], restoreMp: 6 },
  glow: { name: '螢火', mp: 5, target: 'enemy', power: 1.4, damage: 'magic', element: 'moon' },
  tide: { name: '冷焰潮', mp: 14, target: 'enemies', power: 1.2, damage: 'magic', element: 'moon', effects: [{ status: 'slow', turns: 2, chance: .3 }] },
  lost: { name: '迷途燈', mp: 10, target: 'enemy', effects: [{ status: 'weak', turns: 2 }, { status: 'slow', turns: 2 }] },
  arrow: { name: '順風箭', mp: 4, target: 'enemy', power: 1.4, damage: 'physical', element: 'wind', sureHit: true },
  snare: { name: '絆索', mp: 6, target: 'enemy', effects: [{ status: 'slow', turns: 2 }] },
  gale: { name: '破風箭', mp: 8, target: 'enemy', power: 2, damage: 'physical', element: 'wind', knockback: .4 },
  dawn: { name: '初光', mp: 8, target: 'ally', heal: 1.2, cleanse: true },
  sun: { name: '日輪', mp: 8, target: 'enemy', power: 1.6, damage: 'magic', element: 'light', effects: [{ status: 'blind', turns: 2, chance: .4 }] },
  blessing: { name: '祝福頁', mp: 8, target: 'ally', effects: [{ status: 'boost', turns: 3 }] },
  backstab: { name: '背刺', mp: 6, target: 'enemy', power: 1.6, damage: 'physical', element: 'shadow', stealthCrit: true },
  hide: { name: '借影', mp: 6, target: 'self', effects: [{ status: 'hidden', turns: 2 }] },
  hush: { name: '噤聲', mp: 10, target: 'enemy', power: 1, damage: 'physical', element: 'shadow', effects: [{ status: 'silence', turns: 2 }], dispel: true },
} satisfies Record<string, Skill>;
export type SkillId = keyof typeof skills;
export const classes = {
  ember_knight: { name: '守火人', element: 'fire', attributes: [12,16,6,6,10], skills: ['flame','taunt','cover'] },
  martial_artist: { name: '碎岩者', element: 'earth', attributes: [16,12,12,4,6], skills: ['crush','combo','stance'] },
  moon_witch: { name: '掌燈人', element: 'moon', attributes: [4,7,9,18,12], skills: ['glow','tide','lost'] },
  forest_ranger: { name: '拾風者', element: 'wind', attributes: [10,9,16,8,7], skills: ['arrow','snare','gale'] },
  sun_cleric: { name: '晨光使', element: 'light', attributes: [6,10,6,10,18], skills: ['dawn','sun','blessing'] },
  shadow_rogue: { name: '借影人', element: 'shadow', attributes: [13,6,19,6,6], skills: ['backstab','hide','hush'] },
} satisfies Record<string, { name: string; element: Element; attributes: number[]; skills: SkillId[] }>;
export type ClassId = keyof typeof classes;
export function classStats(id: ClassId): Stats {
  const [str, vit, agi, int, spi] = classes[id].attributes;
  return { maxHp: 50 + vit * 10, maxMp: int * 3 + spi * 2, attack: str * 2, magic: int * 2, healing: spi * 2, defense: vit, resistance: spi, speed: agi, crit: .05 + agi * .005, evade: agi * .005 };
}
