import test from 'node:test';
import assert from 'node:assert/strict';
import { act,bossTurn,bossIntent,createBattle,enemy,estimateDamage,hero } from '../src/game/battle.ts';
import { classes,skills } from '../src/game/catalog.ts';
import type { ClassId,Skill } from '../src/game/catalog.ts';
import type { Battle,Command } from '../src/game/battle.ts';

// Policy sees public HP, MP, intent and estimates only, never the future RNG state.
export function decide(s:Battle, defendBlast=false):Command {
  const a=s.units.find(u=>u.id===s.active)!, b=s.units.find(u=>u.boss)!;
  const party=s.units.filter(u=>u.side==='party');
  const dead=party.find(u=>u.hp===0);
  if(dead&&s.supplies.revive) return {type:'item',item:'revive',target:dead.id};
  const wounded=party.filter(u=>u.hp>0&&u.hp<u.stats.maxHp*.5).sort((x,y)=>x.hp/x.stats.maxHp-y.hp/y.stats.maxHp)[0];
  if(wounded&&s.supplies.heal) return {type:'item',item:'heal',target:wounded.id};
  if(defendBlast&&b.boss?.stage==='blast')return {type:'defend'};
  if(!defendBlast&&b.boss?.stage==='blast'&&a.skills.includes('hush')&&a.mp>=10)return {type:'skill',skill:'hush',target:b.id};
  const score=(sk:Skill)=>estimateDamage(a,b,sk)*(sk.hits??1);
  const candidate=a.skills.filter(id=>{const sk:Skill=skills[id];return sk.power&&a.mp>=sk.mp&&!a.statuses.silence;}).sort((x,y)=>score(skills[y])-score(skills[x]))[0];
  return candidate?{type:'skill',skill:candidate,target:b.id}:{type:'attack',target:b.id};
}
test('all ten healer-free teams win across 30 seeds using public decisions and finite supplies',()=>{
  const ids=(Object.keys(classes) as ClassId[]).filter(id=>id!=='sun_cleric');
  let victories=0,maxRounds=0;
  for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)for(let k=j+1;k<5;k++)for(let seed=1;seed<=30;seed++){
    const team=[ids[i],ids[j],ids[k]];
    let s=createBattle([...team.map(hero),enemy('boss','boss')],seed);
    for(let n=0;n<200&&s.outcome==='ongoing';n++)s=s.units.find(u=>u.id===s.active)!.side==='enemy'?bossTurn(s):act(s,decide(s));
    assert.equal(s.outcome,'victory',`${team.join(',')} seed=${seed}`);victories++;maxRounds=Math.max(maxRounds,s.round);
  }
  console.log(`No-healer focused strategy: ${victories}/300 wins, max ${maxRounds} rounds`);
});
test('no-healer team can deliberately defend every explosion instead of breaking shields',()=>{
  let explosions=0;
  for(let seed=1;seed<=30;seed++){
    let s=createBattle([hero('ember_knight',0),hero('forest_ranger',1),hero('moon_witch',2),enemy('boss','boss')],seed);
    for(let n=0;n<250&&s.outcome==='ongoing';n++){
      const a=s.units.find(u=>u.id===s.active)!;
      if(a.boss){if(bossIntent(s,a).heavy)explosions++;s=bossTurn(s);}else s=act(s,decide(s,true));
    }
    assert.equal(s.outcome,'victory',`defense seed=${seed}`);
  }
  assert.ok(explosions>=30);console.log(`No-healer defense strategy: 30/30 wins, endured ${explosions} explosions`);
});
test('phase two attacks two targets and transition grants no extra turn or cleanse',()=>{
  const b=enemy('boss','boss');b.boss!.phase=2;b.boss!.stage='recover';
  let s=createBattle([hero('ember_knight',0),hero('forest_ranger',1),hero('moon_witch',2),b]);
  while(s.active!=='boss')s=act(s,{type:'defend'});
  assert.equal(bossIntent(s,s.units[3]).targetIds.length,2);
  const before=s.units.slice(0,3).map(u=>u.hp);s=bossTurn(s);
  assert.equal(s.units.slice(0,3).filter((u,i)=>u.hp<before[i]).length,2);
  assert.equal(s.units[3].boss?.stage,'charge');
});
