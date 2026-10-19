import test from 'node:test';
import assert from 'node:assert/strict';
import { act, bossTurn, createBattle, enemy, enemyIntent, enemyTurn, estimateDamage, hero, settleVictory, simulate } from '../src/game/battle.ts';
import type { Battle, Status } from '../src/game/battle.ts';
import { classes, skills } from '../src/game/catalog.ts';
import type { ClassId, Skill, SkillId } from '../src/game/catalog.ts';

const status = (turns = 2, source = 'test'): Status => ({ turns, source, applied: -1 });
const unit = (s: Battle,id: string) => s.units.find(u => u.id === id)!;
function dummy() { const e = enemy('dummy','slime'); e.stats.maxHp = e.hp = 10000; e.stats.speed = 1; return e; }
function turn(s: Battle, id: string): Battle { for (let i = 0; i < 30 && s.active !== id; i++) s = act(s,{type:'defend'}); assert.equal(s.active,id); return s; }

test('all 20 distinct three-class teams have three legal skills and deterministic order', () => {
  const ids = Object.keys(classes) as ClassId[]; let count = 0;
  for (let i=0;i<6;i++) for(let j=i+1;j<6;j++) for(let k=j+1;k<6;k++) {
    const team = [ids[i],ids[j],ids[k]].map((id,slot) => hero(id,slot));
    const a = createBattle([...team,dummy()],42), b = createBattle([...team,dummy()],42);
    assert.deepEqual(a,b); assert.equal(new Set(team.flatMap(u=>u.skills)).size,9); count++;
  }
  assert.equal(count,20);
});
test('all 18 skills execute from their owning class without mutating input', () => {
  for (const id of Object.keys(classes) as ClassId[]) for (const key of classes[id].skills) {
    const h = hero(id,0); h.stats.speed=100;
    const s = createBattle([h,hero(id === 'ember_knight' ? 'sun_cleric' : 'ember_knight',1),dummy()]);
    const skill: Skill = skills[key]; const before = structuredClone(s);
    const target = skill.target === 'ally' ? s.units[1].id : skill.target === 'enemy' ? 'dummy' : undefined;
    const result = act(s,{type:'skill',skill:key,target});
    assert.deepEqual(s,before); assert.ok(result.spent.includes(id));
    assert.equal(unit(result,id).mp,Math.min(h.stats.maxMp,h.stats.maxMp-skill.mp+(skill.restoreMp??0)));
  }
});
test('rejected commands leave MP, random state, inventory and turn untouched', () => {
  const s=createBattle([hero('forest_ranger',0),dummy()]); const before=structuredClone(s);
  assert.throws(()=>act(s,{type:'skill',skill:'arrow',target:'forest_ranger'}));
  assert.throws(()=>act(s,{type:'skill',skill:'flame',target:'dummy'}));
  assert.throws(()=>act(s,{type:'item',item:'heal',target:'forest_ranger'}));
  assert.deepEqual(s,before);
  unit(s,'forest_ranger').mp=0;
  assert.throws(()=>act(s,{type:'skill',skill:'arrow',target:'dummy'}));
});
test('slow immediately changes only remaining order; each unit acts once', () => {
  const e=dummy(); e.stats.speed=15;
  let s=createBattle([hero('forest_ranger',0),hero('martial_artist',1),e]);
  s=act(s,{type:'skill',skill:'snare',target:'dummy'});
  assert.equal(s.active,'martial_artist'); assert.equal(s.queue[0],'dummy');
  s=act(s,{type:'defend'}); assert.equal(s.active,'dummy');
  s=act(s,{type:'defend'}); assert.equal(s.round,2); assert.equal(s.active,'forest_ranger');
});
test('defense halves direct damage before shield; expires at next own turn', () => {
  const h=hero('ember_knight',0), e=dummy();
  let s=createBattle([h,e]); s=act(s,{type:'defend'});
  const defender=unit(s,h.id); defender.statuses.shield={...status(),amount:5};
  const amount=estimateDamage(unit(s,'dummy'),defender);
  const plain=estimateDamage(unit(s,'dummy'),{...defender,defending:false});
  assert.ok(Math.abs(amount-plain/2)<=1);
  const hp=defender.hp; s=act(s,{type:'attack',target:h.id});
  assert.equal(unit(s,h.id).hp,hp-Math.max(0,amount-5)); assert.equal(unit(s,h.id).defending,false);
});
test('self-applied statuses retain full duration, MP regeneration occurs only at turn start', () => {
  let s=createBattle([hero('martial_artist',0),dummy()]); unit(s,'martial_artist').mp=10;
  s=act(s,{type:'skill',skill:'stance'});
  assert.equal(unit(s,'martial_artist').statuses.guard?.turns,2); assert.equal(unit(s,'martial_artist').mp,12);
  s=act(s,{type:'defend'}); assert.equal(unit(s,'martial_artist').mp,17);
  s=act(s,{type:'defend'}); assert.equal(unit(s,'martial_artist').statuses.guard?.turns,1);
});
test('burn ignores defense and shield, ticks before a stunned turn, which restores MP', () => {
  const h=hero('ember_knight',0); h.mp=0; h.defending=true;
  h.statuses={burn:status(1),stun:status(1),shield:{...status(),amount:100}};
  const s=createBattle([h,dummy()]); const u=unit(s,h.id);
  assert.equal(u.hp,h.hp-Math.round(h.stats.maxHp*.05)); assert.equal(u.mp,5);
  assert.equal(u.statuses.shield?.amount,100); assert.equal(s.active,'dummy');
  assert.equal(u.statuses.stun,undefined); assert.equal(u.immunity.stun,1);
});
test('revive preserves an unspent slot but grants no extra MP until actual turn', () => {
  let s=createBattle([hero('shadow_rogue',0),hero('ember_knight',1),dummy()]);
  const dead=unit(s,'ember_knight'); dead.hp=0; dead.mp=0;
  s=act(s,{type:'item',item:'revive',target:dead.id});
  assert.equal(s.active,dead.id); assert.equal(unit(s,dead.id).mp,5);
  assert.equal(unit(s,dead.id).hp,Math.round(dead.stats.maxHp*.3));
});
test('revive after a passed dead slot waits until next round', () => {
  const fast=hero('shadow_rogue',0); fast.hp=0; fast.mp=0;
  let s=createBattle([fast,hero('ember_knight',1),dummy()]);
  assert.ok(s.spent.includes(fast.id));
  s=act(s,{type:'item',item:'revive',target:fast.id});
  assert.equal(s.active,'dummy'); assert.equal(unit(s,fast.id).mp,0);
  s=act(s,{type:'defend'}); assert.equal(s.active,fast.id); assert.equal(unit(s,fast.id).mp,5);
});
test('revive after already acting cannot create a second action', () => {
  let s=createBattle([hero('shadow_rogue',0),hero('ember_knight',1),dummy()]);
  s=act(s,{type:'defend'}); unit(s,'shadow_rogue').hp=0;
  s=act(s,{type:'item',item:'revive',target:'shadow_rogue'}); assert.equal(s.active,'dummy');
});
test('items use camp supplies before reserve and clear only debuffs', () => {
  let s=createBattle([hero('ember_knight',0),dummy()]); const h=unit(s,'ember_knight'); h.hp=1; s.reserve.heal=2;
  s=act(s,{type:'item',item:'heal',target:h.id}); assert.equal(s.supplies.heal,2); assert.equal(s.reserve.heal,2);
  s=turn(s,h.id); unit(s,h.id).statuses={slow:status(),guard:status()}; s.reserve.cleanse=1;
  s=act(s,{type:'item',item:'cleanse',target:h.id}); assert.equal(unit(s,h.id).statuses.slow,undefined); assert.ok(unit(s,h.id).statuses.guard);
});
test('hidden backstab uses critical multiplier then reveals actor', () => {
  let s=createBattle([hero('shadow_rogue',0),dummy()]);
  s=act(s,{type:'skill',skill:'hide'}); s=act(s,{type:'defend'});
  const expected=estimateDamage(unit(s,'shadow_rogue'),unit(s,'dummy'),skills.backstab,true);
  const hp=unit(s,'dummy').hp; s=act(s,{type:'skill',skill:'backstab',target:'dummy'});
  assert.equal(unit(s,'dummy').hp,hp-expected); assert.equal(unit(s,'shadow_rogue').statuses.hidden,undefined);
});
function charging(): Battle {
  const b=enemy('boss','boss'); b.boss!.stage='charge';
  let s=createBattle([hero('shadow_rogue',0),hero('ember_knight',1),b]);
  s=turn(s,'boss'); return bossTurn(s);
}
test('silence interrupts boss immediately, exposes core and replaces blast', () => {
  let s=charging(); assert.equal(unit(s,'boss').boss?.stage,'blast');
  s=act(s,{type:'skill',skill:'hush',target:'boss'});
  assert.equal(unit(s,'boss').boss?.stage,'recover'); assert.equal(unit(s,'boss').statuses.shield,undefined); assert.equal(unit(s,'boss').statuses.break?.turns,1);
  s=turn(s,'boss'); s=bossTurn(s);
  assert.equal(unit(s,'boss').boss?.stage,'charge'); assert.equal(unit(s,'boss').statuses.break,undefined);
});
test('damage breaking shield interrupts boss without deleting its turn', () => {
  let s=charging(); unit(s,'boss').statuses.shield!.amount=1;
  s=act(s,{type:'attack',target:'boss'});
  assert.equal(unit(s,'boss').boss?.stage,'recover'); assert.ok(s.queue.includes('boss'));
});
test('normal explosion exposes core; reaching half HP preserves debuffs', () => {
  let s=charging(); s=turn(s,'boss'); s=bossTurn(s);
  assert.equal(unit(s,'boss').boss?.stage,'recover'); assert.equal(unit(s,'boss').statuses.break?.turns,1);
  unit(s,'boss').hp=301; unit(s,'boss').statuses.weak=status();
  s=act(s,{type:'attack',target:'boss'});
  assert.equal(unit(s,'boss').boss?.phase,2); assert.ok(unit(s,'boss').statuses.weak);
});
test('stun delays boss charge without expiring its shield or interrupting', () => {
  let s=charging(); unit(s,'boss').statuses.stun=status(2);
  for (let i=0; i<6; i++) s=act(s,{type:'defend'});
  assert.equal(unit(s,'boss').boss?.stage,'blast');
  assert.ok(unit(s,'boss').statuses.shield);
  assert.equal(unit(s,'boss').statuses.break,undefined);
});
test('taunt restricts single enemy targets but does not redirect an area spell', () => {
  const a=hero('ember_knight',0), b=hero('sun_cleric',1), e=dummy();
  a.stats.speed=100; e.stats.speed=50;
  let s=createBattle([a,b,e]); s=act(s,{type:'skill',skill:'taunt',target:e.id});
  assert.throws(()=>act(s,{type:'attack',target:b.id}));
  assert.doesNotThrow(()=>act(s,{type:'attack',target:a.id}));
});
test('damage death and burn death finish combat without extra action or recovery', () => {
  const e=dummy(); e.hp=1;
  let s=createBattle([hero('forest_ranger',0),e]);
  s=act(s,{type:'skill',skill:'arrow',target:e.id});
  assert.equal(s.outcome,'victory'); assert.equal(s.active,undefined);
  assert.throws(()=>act(s,{type:'defend'}));
  const a=hero('ember_knight',0); a.hp=1; a.statuses.burn=status(1);
  const defeat=createBattle([a,dummy()]); assert.equal(defeat.outcome,'defeat');
  assert.throws(()=>settleVictory(defeat));
});
test('victory settles alive/dead exactly once per returned roster and clears effects', () => {
  const a=hero('ember_knight',0), b=hero('sun_cleric',1); a.hp=50; b.hp=0;
  const s=createBattle([a,b,dummy()]); s.outcome='victory'; unit(s,a.id).statuses.guard=status();
  const result=settleVictory(s); assert.equal(result[0].hp,92); assert.equal(result[1].hp,30);
  assert.deepEqual(result[0].statuses,{}); assert.deepEqual(settleVictory(s),result); assert.equal(unit(s,a.id).hp,50);
});
test('simulation is reproducible and consumes no real randomness', () => {
  const s=createBattle([hero('martial_artist',0),dummy()],123); const before=structuredClone(s);
  const command={type:'skill' as const,skill:'combo' as SkillId,target:'dummy'};
  assert.deepEqual(simulate(s,command),act(s,command)); assert.deepEqual(s,before);
});
test('same-speed ties favor party, then slot; duplicate IDs rejected', () => {
  const a=hero('ember_knight',1), b=hero('sun_cleric',0), e=dummy(); e.stats.speed=6;
  assert.equal(createBattle([a,b,e]).active,b.id);
  assert.throws(()=>createBattle([a,structuredClone(a),e]));
});
test('rock intent matches execution, guards then exposes itself after heavy strike', () => {
  const h=hero('ember_knight',0); h.stats.maxHp=h.hp=2000;
  let s=createBattle([h,enemy('rock','rock')]);
  s=turn(s,'rock'); assert.equal(enemyIntent(s,unit(s,'rock')).skill.name,'岩拳'); s=enemyTurn(s);
  s=turn(s,'rock'); assert.equal(enemyIntent(s,unit(s,'rock')).skill.name,'抱石固守'); s=enemyTurn(s);
  assert.ok(unit(s,'rock').statuses.guard); assert.equal(enemyIntent(s,unit(s,'rock')).heavy,true);
  s=turn(s,'rock'); s=enemyTurn(s); assert.ok(unit(s,'rock').statuses.break); assert.equal(unit(s,'rock').statuses.guard,undefined);
});
test('slime cycles to moon projectile and shield; taunt changes its announced target', () => {
  const a=hero('ember_knight',0),b=hero('sun_cleric',1); a.stats.maxHp=a.hp=2000;
  let s=createBattle([a,b,enemy('slime','slime')]);
  assert.equal(s.active,'slime'); s=enemyTurn(s);
  assert.equal(enemyIntent(s,unit(s,'slime')).skill.name,'月露彈');
  unit(s,'slime').statuses.taunt=status(2,b.id); assert.equal(enemyIntent(s,unit(s,'slime')).target,b.id);
  s=turn(s,'slime'); s=enemyTurn(s); assert.equal(unit(s,b.id).statuses.slow?.turns,1);
  s=turn(s,'slime'); s=enemyTurn(s); assert.ok(unit(s,'slime').statuses.shield);
});
