import test from 'node:test';
import assert from 'node:assert/strict';
import {newJourney,beginEncounter,finishEncounter,openChest,visitCamp,equipTreasure,replayJourney,journeyUnit,parseSave,canEnterBoss} from '../src/game/exploration.ts';
import type {Journey} from '../src/game/exploration.ts';
import {encounters,camps,objects,entrance,route,walkable} from '../src/game/forest-map.ts';
import {act,enemyTurn,bossTurn,estimateDamage} from '../src/game/battle.ts';
import type {Battle,Command} from '../src/game/battle.ts';
import {skills} from '../src/game/catalog.ts';
import type {Skill} from '../src/game/catalog.ts';
const team=[{id:'ember_knight' as const,gender:'female' as const},{id:'forest_ranger' as const,gender:'male' as const},{id:'moon_witch' as const,gender:'female' as const}];
function fight(j:Journey,id:string):Journey {
  const entry=beginEncounter(j,id);let b=entry.battle;
  for(let n=0;n<300&&b.outcome==='ongoing';n++){
    const a=b.units.find(u=>u.id===b.active)!;
    if(a.side==='enemy'){b=a.boss?bossTurn(b):enemyTurn(b);continue;}
    const dead=b.units.find(u=>u.side==='party'&&u.hp===0),wounded=b.units.find(u=>u.side==='party'&&u.hp>0&&u.hp<u.stats.maxHp*.4);
    let command:Command;
    if(dead&&b.supplies.revive+b.reserve.revive)command={type:'item',item:'revive',target:dead.id};
    else if(wounded&&b.supplies.heal+b.reserve.heal)command={type:'item',item:'heal',target:wounded.id};
    else {const t=b.units.filter(u=>u.side==='enemy'&&u.hp>0).sort((x,y)=>x.hp-y.hp)[0];const score=(s:Skill)=>estimateDamage(a,t,s)*(s.hits??1);const id=a.skills.filter(id=>{const s:Skill=skills[id];return s.power&&a.mp>=s.mp&&!a.statuses.silence;}).sort((x,y)=>score(skills[y])-score(skills[x]))[0];command=id?{type:'skill',skill:id,target:t.id}:{type:'attack',target:t.id};}
    b=act(b,command);
  }
  assert.equal(b.outcome,'victory',`encounter ${id}`);return finishEncounter(entry.journey,b);
}
test('complete both branches, both camps and boss with no healer; replay retains collection only',()=>{
  let j=newJourney(team);assert.equal(canEnterBoss(j),false);assert.throws(()=>beginEncounter(j,'treant'));
  j=fight(j,'trail-slime');j=fight(j,'slime-branch');j=openChest(j);j=fight(j,'fallen-rock');j=visitCamp(j);
  j=equipTreasure(j,'moss-charm','ember_knight');j=fight(j,'stone-path');j=fight(j,'rock-branch');j=openChest(j,'traveler-pack');j=visitCamp(j,'forecourt');j=equipTreasure(j,'medicine-kit','forest_ranger');
  const before=j;const entry=beginEncounter(j,'treant');entry.battle.outcome='defeat';const failed=finishEncounter(entry.journey,entry.battle);assert.deepEqual(failed.position,camps[1].position);assert.deepEqual(failed.opened,j.opened);
  j=fight(j,'treant');assert.equal(j.completed,true);assert.equal(j.endingPending,true);assert.equal(j.result?.battles,6);assert.equal(j.result?.chests,2);assert.equal(j.result?.firstReward,true);assert.equal(j.treasures.length,3);
  assert.deepEqual(parseSave(JSON.stringify(j)).result,j.result);assert.equal(finishEncounter(j,entry.battle),j);
  j=replayJourney(j,[team[1],team[2],team[0]]);assert.deepEqual(j.treasures,['moss-charm','medicine-kit','dew-pendant']);assert.deepEqual(j.equipped,before.equipped);assert.equal(j.run,2);assert.equal(j.cleared.length,0);assert.equal(j.opened.length,0);assert.deepEqual(j.reserve,{heal:0,revive:0,cleanse:0});assert.equal(j.completed,false);
  j=fight(j,'trail-slime');j=fight(j,'slime-branch');j=openChest(j);assert.equal(j.treasures.length,3);assert.equal(j.reserve.heal,2);assert.equal(openChest(j),j);
  j=fight(j,'fallen-rock');j=visitCamp(j);j=fight(j,'stone-path');j=visitCamp(j,'forecourt');j=fight(j,'treant');assert.equal(j.result?.firstReward,false);assert.equal(j.treasures.length,3);
});
test('main path can finish without either optional branch or treasure',()=>{
  let j=newJourney(team);j=fight(j,'trail-slime');j=fight(j,'fallen-rock');j=visitCamp(j);j=fight(j,'stone-path');j=visitCamp(j,'forecourt');j=fight(j,'treant');assert.equal(j.result?.battles,4);assert.equal(j.result?.chests,0);assert.deepEqual(j.treasures,['dew-pendant']);
});
test('all map objects reachable; narrow crossings enforce mandatory encounters while branches are optional',()=>{
  for(const p of [...objects.map(o=>o.position),...Object.values(encounters).map(e=>e.position)]){const path=route(entrance,p);assert.ok(path.length>0);assert.ok(path.every(p=>walkable(p.x,p.y)));}
  const main=route(entrance,camps[1].position);for(const id of ['trail-slime','fallen-rock','stone-path'])assert.ok(main.some(p=>Math.hypot(p.x-encounters[id].position.x,p.y-encounters[id].position.y)<38));
  for(const id of ['slime-branch','rock-branch'])assert.ok(main.every(p=>Math.hypot(p.x-encounters[id].position.x,p.y-encounters[id].position.y)>38));
});
test('old save migrates without losing loot and moves positions out of new choke walls',()=>{
  const j=newJourney(team);const old={...j,version:1,position:{x:890,y:470},opened:['trail-chest'],treasures:['moss-charm'],campVisited:true};
  const migrated=parseSave(JSON.stringify(old));assert.equal(migrated.version,2);assert.deepEqual(migrated.position,{x:890,y:420});assert.deepEqual(migrated.treasures,['moss-charm']);assert.deepEqual(migrated.visitedCamps,['old-camp']);
});
test('medicine kit boosts only holder in battle; pendant applies shield each battle',()=>{
  let j=visitCamp(newJourney(team));j.treasures=['medicine-kit','dew-pendant'];j=equipTreasure(j,'medicine-kit','forest_ranger');j=equipTreasure(j,'dew-pendant','moon_witch');
  const u=journeyUnit(j,'moon_witch',2);assert.equal(u.statuses.shield?.amount,12);assert.equal(u.statuses.shield?.turns,2);
  let b:Battle=beginEncounter(j).battle;assert.equal(b.active,'forest_ranger');b.units[0].hp=1;b=act(b,{type:'item',item:'heal',target:'ember_knight'});assert.equal(b.units[0].hp,106);assert.equal(b.supplies.heal,2);
  j=equipTreasure(j,'dew-pendant','forest_ranger');assert.equal(j.equipped.forest_ranger,'dew-pendant');assert.equal(Object.values(j.equipped).filter(t=>t==='dew-pendant').length,1);
});
