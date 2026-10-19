import { classes, classStats, skills } from './catalog.ts';
import type { ClassId, Element, Skill, SkillId, Stats, StatusId } from './catalog.ts';

export type Status = { turns: number; source: string; applied: number; amount?: number };
export type Unit = { id: string; name: string; side: 'party' | 'enemy'; slot: number; element: Element; stats: Stats; hp: number; mp: number; skills: SkillId[]; statuses: Partial<Record<StatusId, Status>>; immunity: Partial<Record<StatusId, number>>; defending: boolean; itemHealBonus?: number; ai?: { kind: 'slime' | 'rock'; step: number }; boss?: { phase: 1 | 2; stage: 'strike' | 'charge' | 'blast' | 'recover' } };
export type Item = 'heal' | 'revive' | 'cleanse';
export type Command = { type: 'attack'; target: string } | { type: 'skill'; skill: SkillId; target?: string } | { type: 'defend' } | { type: 'item'; item: Item; target: string };
export type Battle = { units: Unit[]; round: number; queue: string[]; spent: string[]; active?: string; serial: number; rng: number; outcome: 'ongoing' | 'victory' | 'defeat'; supplies: Record<Item, number>; reserve: Record<Item, number>; events: string[] };
const debuffs: StatusId[] = ['burn','stun','sleep','bind','slow','weak','break','taunt','silence','blind'];
const controls: StatusId[] = ['stun','sleep','bind'];
const opposites: Partial<Record<StatusId, StatusId>> = { slow: 'haste', haste: 'slow', weak: 'boost', boost: 'weak', break: 'guard', guard: 'break' };
const elements: Partial<Record<Element, Element>> = { fire: 'moon', moon: 'fire', earth: 'wind', wind: 'earth', light: 'shadow', shadow: 'light' };
const basic: Skill = { name: '普通攻擊', mp: 0, target: 'enemy', damage: 'physical', power: 1, element: 'none' };
const get = (s: Battle, id: string) => { const u = s.units.find(u => u.id === id); if (!u) throw new Error(`Unknown unit: ${id}`); return u; };
const has = (u: Unit, id: StatusId) => !!u.statuses[id];
function random(s: Battle) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
function chance(s: Battle, p: number) { return p >= 1 || (p > 0 && random(s) < p); }
export function hero(id: ClassId, slot: number): Unit {
  const c = classes[id], stats = classStats(id);
  return { id, name: c.name, side: 'party', slot, element: c.element, stats, hp: stats.maxHp, mp: stats.maxMp, skills: [...c.skills], statuses: {}, immunity: {}, defending: false };
}
// Enemy values are provisional fixtures, not the final encounter balance.
export function enemy(id: string, kind: 'slime' | 'rock' | 'boss', slot = 0): Unit {
  const stats: Stats = { maxHp: kind === 'boss' ? 600 : kind === 'rock' ? 140 : 90, maxMp: 0, attack: 30, magic: 32, healing: 0, defense: kind === 'rock' ? 35 : 12, resistance: 10, speed: kind === 'slime' ? 10 : 5, crit: 0, evade: 0 };
  return { id, name: { slime: '月露史萊姆', rock: '苔岩小怪', boss: '蝕光樹靈' }[kind], side: 'enemy', slot, element: { slime: 'moon', rock: 'earth', boss: 'shadow' }[kind] as Element, stats, hp: stats.maxHp, mp: 0, skills: [], statuses: {}, immunity: {}, defending: false, ...(kind === 'boss' ? { boss: { phase: 1 as const, stage: 'strike' as const } } : { ai: { kind, step: 0 } }) };
}
export function speed(u: Unit) { return u.stats.speed * (has(u, 'haste') ? 1.25 : has(u, 'slow') ? .75 : 1); }
function sort(s: Battle) { s.queue.sort((a,b) => { const x = get(s,a), y = get(s,b); return speed(y)-speed(x) || Number(x.side === 'enemy')-Number(y.side === 'enemy') || x.slot-y.slot || x.id.localeCompare(y.id); }); }
export function createBattle(units: Unit[], seed = 1): Battle {
  if (new Set(units.map(u => u.id)).size !== units.length || !units.some(u => u.side === 'party' && u.hp > 0) || !units.some(u => u.side === 'enemy' && u.hp > 0)) throw new Error('Battle requires unique IDs and two living sides');
  const s: Battle = { units: structuredClone(units), round: 0, queue: [], spent: [], serial: 0, rng: seed >>> 0, outcome: 'ongoing', supplies: { heal: 3, revive: 1, cleanse: 0 }, reserve: { heal: 0, revive: 0, cleanse: 0 }, events: [] };
  advance(s); return s;
}
function remove(s: Battle, u: Unit, id: StatusId) {
  if (!has(u,id)) return;
  delete u.statuses[id];
  if (id === 'slow' || id === 'haste') sort(s);
  if (controls.includes(id)) u.immunity[id] = 1;
  if (id === 'shield' && u.boss?.stage === 'blast') interrupt(s,u);
}
function interrupt(s: Battle, u: Unit) {
  if (u.boss?.stage !== 'blast') return;
  u.boss.stage = 'recover'; delete u.statuses.shield;
  applyStatus(s,u,'break',1,u.id); s.events.push(`${u.id}: 蓄勢中斷，下次改用根鬚抽擊`);
}
function applyStatus(s: Battle, u: Unit, id: StatusId, turns: number, source: string, amount?: number) {
  if (u.hp <= 0 || (u.immunity[id] ?? 0) > 0) return;
  const opposite = opposites[id];
  if (opposite && has(u,opposite)) { remove(s,u,opposite); return; }
  const old = u.statuses[id];
  u.statuses[id] = { turns: Math.max(turns, old?.turns ?? 0), source, applied: s.serial, ...(amount !== undefined ? { amount: Math.max(amount, old?.amount ?? 0) } : {}) };
  if (id === 'slow' || id === 'haste') sort(s);
  if (id === 'silence') interrupt(s,u);
}
function healthDamage(s: Battle, u: Unit, amount: number) {
  u.hp = Math.max(0, u.hp - amount);
  if (u.boss && u.hp > 0 && u.hp <= u.stats.maxHp / 2 && u.boss.phase === 1) { u.boss.phase = 2; s.events.push('蝕光樹靈進入第二階段：根鬚抽擊將攻擊兩名旅人'); }
  if (!u.hp) { u.statuses = {}; u.defending = false; }
}
function damage(s: Battle, u: Unit, amount: number, area: boolean) {
  const shield = u.statuses.shield;
  const absorbed = Math.min(amount, shield?.amount ?? 0);
  if (shield) { shield.amount = (shield.amount ?? 0) - absorbed; if (shield.amount <= 0) remove(s,u,'shield'); }
  healthDamage(s,u,amount-absorbed);
  remove(s,u,'sleep'); if (area) remove(s,u,'hidden');
  s.events.push(`${u.id}: damage ${amount-absorbed}, shield ${absorbed}`);
}
export function estimateDamage(a: Unit, t: Unit, skill: Skill = basic, critical = false): number {
  const attack = (skill.damage === 'magic' ? a.stats.magic : a.stats.attack) * (has(a,'boost') ? 1.25 : has(a,'weak') ? .75 : 1);
  const defense = (skill.damage === 'magic' ? t.stats.resistance : t.stats.defense) * (has(t,'guard') ? 1.25 : has(t,'break') ? .75 : 1);
  return Math.max(1, Math.round(attack * (skill.power ?? 0) * 100 / (100 + defense) * (elements[skill.element ?? 'none'] === t.element ? 1.5 : 1) * (critical ? 1.5 : 1) * (t.defending ? .5 : 1)));
}
function targets(s: Battle, a: Unit, skill: Skill, id?: string): Unit[] {
  if (skill.target === 'self') return [a];
  if (skill.target === 'enemies') return s.units.filter(u => u.side !== a.side && u.hp > 0);
  if (!id) throw new Error('Target required');
  const t = get(s,id);
  if (t.hp <= 0 || (skill.target === 'ally') !== (t.side === a.side) || (skill.target === 'enemy' && has(t,'hidden'))) throw new Error('Invalid target');
  const taunt = a.statuses.taunt && s.units.find(u => u.id === a.statuses.taunt?.source && u.hp > 0 && !has(u,'hidden'));
  if (skill.target === 'enemy' && taunt && t.id !== taunt.id) throw new Error('Must target taunter');
  return [t];
}
function resolveSkill(s: Battle, a: Unit, skill: Skill, ts: Unit[]) {
  a.mp -= skill.mp;
  const stealth = has(a,'hidden');
  for (const t of ts) {
    for (let hit = 0; hit < (skill.hits ?? 1) && t.hp > 0; hit++) {
      if (skill.power !== undefined) {
        if ((!skill.sureHit && chance(s,has(t,'bind') ? 0 : t.stats.evade)) || (has(a,'blind') && chance(s,.5))) { s.events.push(`${a.id}: miss ${t.id}`); continue; }
        const critical = (skill.stealthCrit && stealth) || chance(s,a.stats.crit);
        damage(s,t,estimateDamage(a,t,skill,critical),skill.target === 'enemies');
      }
      if (t.hp <= 0) break;
      if (skill.cleanse) for (const id of debuffs) remove(s,t,id);
      if (skill.dispel) for (const id of Object.keys(t.statuses) as StatusId[]) if (!debuffs.includes(id)) remove(s,t,id);
      if (skill.heal) t.hp = Math.min(t.stats.maxHp,t.hp + Math.round(a.stats.healing * skill.heal));
      if (skill.shield) applyStatus(s,t,'shield',2,a.id,Math.round(a.stats.maxHp * skill.shield));
      for (const e of skill.effects ?? []) if (chance(s,e.chance ?? 1)) applyStatus(s,t,e.status,e.turns,a.id);
      if (skill.knockback && chance(s,skill.knockback)) { const i = s.queue.indexOf(t.id); if (i >= 0 && i < s.queue.length-1) [s.queue[i],s.queue[i+1]] = [s.queue[i+1],s.queue[i]]; }
    }
  }
  if (skill.restoreMp) a.mp = Math.min(a.stats.maxMp,a.mp + skill.restoreMp);
  if (stealth) remove(s,a,'hidden');
}
function checkOutcome(s: Battle) {
  if (!s.units.some(u => u.side === 'party' && u.hp > 0)) s.outcome = 'defeat';
  else if (!s.units.some(u => u.side === 'enemy' && u.hp > 0)) s.outcome = 'victory';
}
function end(s: Battle, a: Unit, freshImmunity: StatusId[] = []) {
  for (const id of Object.keys(a.immunity) as StatusId[]) if (!freshImmunity.includes(id)) { a.immunity[id]! -= 1; if (a.immunity[id]! <= 0) delete a.immunity[id]; }
  for (const [id,status] of Object.entries(a.statuses) as [StatusId,Status][]) {
    if (id === 'burn' || id === 'regen' || status.applied === s.serial) continue;
    // A skipped charge turn must not expire the shield and accidentally interrupt.
    if (id === 'shield' && a.boss?.stage === 'blast') continue;
    if (--status.turns <= 0) remove(s,a,id);
  }
  s.spent.push(a.id); s.active = undefined; checkOutcome(s);
}
function advance(s: Battle) {
  while (s.outcome === 'ongoing' && !s.active) {
    if (!s.queue.length) { s.round++; s.spent = []; s.queue = s.units.map(u => u.id); sort(s); }
    const a = get(s,s.queue.shift()!);
    s.serial++;
    if (a.hp <= 0) { s.spent.push(a.id); continue; }
    s.active = a.id; a.defending = false; a.mp = Math.min(a.stats.maxMp,a.mp+5);
    const before = Object.keys(a.immunity) as StatusId[];
    for (const id of ['burn','regen'] as const) {
      const status = a.statuses[id]; if (!status) continue;
      if (id === 'burn') healthDamage(s,a,Math.max(1,Math.round(a.stats.maxHp*.05)));
      else if (a.hp > 0) a.hp = Math.min(a.stats.maxHp,a.hp + Math.max(1,Math.round(a.stats.maxHp*.05)));
      if (a.statuses[id] && --status.turns <= 0) remove(s,a,id);
    }
    checkOutcome(s); if (s.outcome !== 'ongoing') { s.active = undefined; return; }
    if (a.hp <= 0 || has(a,'stun') || has(a,'sleep')) { end(s,a,(Object.keys(a.immunity) as StatusId[]).filter(x => !before.includes(x))); continue; }
  }
}
function execute(s: Battle, command: Command) {
  if (s.outcome !== 'ongoing' || !s.active) throw new Error('No active turn');
  const a = get(s,s.active);
  if (command.type === 'defend') { a.defending = true; remove(s,a,'hidden'); }
  else if (command.type === 'item') {
    if (a.side !== 'party') throw new Error('Only party can use supplies');
    const t = get(s,command.target), item = command.item;
    if (t.side !== a.side || (item === 'revive' ? t.hp > 0 : t.hp <= 0) || (item === 'heal' && t.hp === t.stats.maxHp) || (item === 'cleanse' && !debuffs.some(id => has(t,id)))) throw new Error('Item has no valid effect');
    const bag = s.supplies[item] > 0 ? s.supplies : s.reserve;
    if (!(bag[item] > 0)) throw new Error('No item remaining');
    bag[item]--;
    if (item === 'heal') t.hp = Math.min(t.stats.maxHp,t.hp + Math.max(1,Math.round(t.stats.maxHp*(.4+(a.itemHealBonus??0)))));
    if (item === 'revive') { t.hp = Math.max(1,Math.round(t.stats.maxHp*.3)); sort(s); }
    if (item === 'cleanse') for (const id of debuffs) remove(s,t,id);
    remove(s,a,'hidden');
  } else {
    const skill: Skill = command.type === 'attack' ? basic : skills[command.skill];
    if (!skill || (command.type === 'skill' && (!a.skills.includes(command.skill) || has(a,'silence')))) throw new Error('Unavailable skill');
    if (a.mp < skill.mp) throw new Error('Insufficient MP');
    resolveSkill(s,a,skill,targets(s,a,skill,command.target));
  }
  end(s,a); advance(s);
}
/** Pure transaction: rejected commands never change state or consume random numbers. */
export function act(state: Battle, command: Command): Battle { const next = structuredClone(state); next.events = []; execute(next,command); return next; }
/** Clone-only preview includes queue changes without consuming the real battle's RNG. */
export function simulate(state: Battle, command: Command): Battle { return act(state,command); }
export function enemyIntent(s: Battle, a: Unit): { skill: Skill; target?: string; detail: string; heavy: boolean } {
  if (!a.ai) throw new Error('No small-monster AI');
  const step = a.ai.step % 3;
  const living = s.units.filter(u => u.side === 'party' && u.hp > 0 && !has(u,'hidden'));
  const preferred = s.units.filter(u => u.side === 'party')[(Math.floor(a.ai.step/3)+a.slot)%s.units.filter(u=>u.side==='party').length];
  const target = living.find(u=>u.id===a.statuses.taunt?.source) ?? living.find(u=>u.id===preferred?.id) ?? living[0];
  const rock = a.ai.kind === 'rock';
  let skill: Skill = { ...basic, name: rock ? '岩拳' : '軟泥撞擊' };
  let detail = '單體物理攻擊';
  if (!has(a,'silence')) {
    if (rock && step===1) { skill={name:'抱石固守',mp:0,target:'self',effects:[{status:'guard',turns:1}]}; detail=`提高防禦；下次重擊 → ${target?.name ?? '無目標'}`; }
    if (rock && step===2) { skill={...basic,name:'滾岩重擊',element:'earth',power:2}; detail='高傷害；出招後自身破防'; }
    if (!rock && step===1) { skill={name:'月露彈',mp:0,target:'enemy',damage:'magic',element:'moon',power:1.2,effects:[{status:'slow',turns:1}]}; detail='魔法傷害，緩速 1 次行動'; }
    if (!rock && step===2) { skill={name:'凝膠防禦',mp:0,target:'self',shield:.2}; detail='獲得護盾，持續 1 次行動'; }
  } else detail='沉默中，改用普通攻擊';
  return { skill, target: skill.target==='self' ? a.id : target?.id, detail, heavy: rock && step===2 && !has(a,'silence') };
}
export function enemyTurn(state: Battle): Battle {
  const s=structuredClone(state); s.events=[];
  if (s.outcome!=='ongoing' || !s.active) throw new Error('No active turn');
  const a=get(s,s.active); const intent=enemyIntent(s,a);
  if (intent.target) resolveSkill(s,a,intent.skill,targets(s,a,intent.skill,intent.target));
  if (intent.skill.name==='凝膠防禦' && a.statuses.shield) a.statuses.shield.turns=1;
  if (intent.heavy) { remove(s,a,'guard'); applyStatus(s,a,'break',1,a.id); }
  a.ai!.step++; end(s,a); advance(s); return s;
}
/** Pure settlement: repeated reads of the same battle return the same recovered roster. */
export function settleVictory(state: Battle): Unit[] {
  if (state.outcome !== 'victory') throw new Error('Battle not won');
  return state.units.filter(u => u.side === 'party').map(original => { const u = structuredClone(original); u.hp = original.hp > 0 ? Math.min(u.stats.maxHp,u.hp + Math.max(1,Math.round(u.stats.maxHp*.2))) : Math.max(1,Math.round(u.stats.maxHp*.2)); u.mp = u.stats.maxMp; u.statuses = {}; u.immunity = {}; u.defending = false; return u; });
}
/** Shared public intent and execution plan. No random targeting or hidden UI-only rules. */
export function bossIntent(s: Battle, a: Unit) {
  if (!a.boss) throw new Error('Not a boss');
  const stage=a.boss.stage;
  const living=s.units.filter(u=>u.side!==a.side&&u.hp>0&&!has(u,'hidden'));
  const first=living.find(u=>u.id===a.statuses.taunt?.source)??living[0];
  const targetIds=first?[first,...living.filter(u=>u.id!==first.id).slice(0,a.boss.phase===2?1:0)].map(u=>u.id):[];
  let skill:Skill={...basic,name:'根鬚抽擊',power:stage==='recover'||stage==='blast'?.7:1};
  let detail=`${stage==='recover'?'較弱攻擊・破防將在行動後結束':'物理攻擊'} → ${targetIds.map(id=>get(s,id).name).join('、')||'無目標'}`;
  if(stage==='charge'&&!has(a,'silence')) {skill={name:'吞光蓄勢',mp:0,target:'self'};detail='獲得 60 點護盾，下次行動準備全體爆發';}
  if(stage==='blast'&&!has(a,'silence')) {skill={name:'蝕光爆發',mp:0,target:'enemies',power:2,damage:'magic',element:'shadow'};detail='全體影屬性傷害・打破護盾或沉默可中斷';}
  return {skill,detail,target:skill.target==='self'?a.id:targetIds[0],targetIds:skill.target==='enemies'?s.units.filter(u=>u.side!==a.side&&u.hp>0).map(u=>u.id):targetIds,heavy:skill.target==='enemies'};
}
export function bossTurn(state: Battle): Battle {
  const s = structuredClone(state); s.events = [];
  if (s.outcome !== 'ongoing' || !s.active) throw new Error('No active turn');
  const a = get(s,s.active); if (!a.boss) throw new Error('Active unit is not boss');
  const stage = a.boss.stage;
  const intent = bossIntent(s,a);
  if (stage === 'charge' && !has(a,'silence')) {
    a.boss.stage = 'blast'; applyStatus(s,a,'shield',2,a.id,60);
  } else if (stage === 'blast' && !has(a,'silence')) {
    resolveSkill(s,a,{ name: '蝕光爆發', mp: 0, target: 'enemies', power: 2, damage: 'magic', element: 'shadow' },s.units.filter(u => u.side !== a.side && u.hp > 0));
    a.boss.stage = 'recover'; delete a.statuses.shield; applyStatus(s,a,'break',1,a.id);
  } else {
    if (stage === 'blast') interrupt(s,a);
    if (intent.targetIds.length) resolveSkill(s,a,intent.skill,intent.targetIds.map(id=>get(s,id)));
    a.boss.stage = 'charge';
  }
  end(s,a); advance(s); return s;
}
