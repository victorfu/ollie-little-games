import test from 'node:test';
import assert from 'node:assert/strict';
import {newJourney,beginEncounter,finishEncounter,openChest,visitCamp,equipCharm,journeyUnit,switchTeam,parseSave,route,walkable,entrance,chest,camp,applyMedicine} from '../src/game/exploration.ts';
const make=()=>newJourney([{id:'ember_knight',gender:'female'},{id:'forest_ranger',gender:'male'},{id:'moon_witch',gender:'female'}]);
test('combat carries HP/inventory; victory commits once and reload cannot duplicate recovery',()=>{
  let j=make();j.roster.ember_knight.hp=100;j.supplies.heal=2;j.reserve.heal=1;
  const entry=beginEncounter(j);assert.equal(entry.battle.units[0].hp,100);assert.equal(entry.battle.supplies.heal,2);
  entry.battle.outcome='victory';entry.battle.supplies.heal=1;
  j=finishEncounter(entry.journey,entry.battle);assert.equal(j.roster.ember_knight.hp,142);assert.equal(j.supplies.heal,1);
  assert.deepEqual(finishEncounter(j,entry.battle),j);assert.deepEqual(parseSave(JSON.stringify(j)),j);
  assert.throws(()=>beginEncounter(j));
});
test('mid-fight reload uses pre-battle resources; defeat restores checkpoint and preserves opened chest',()=>{
  const j=openChest({...make(),cleared:['slime-branch']});j.position={x:440,y:420};j.supplies.heal=1;
  const {journey,battle}=beginEncounter(j);battle.supplies.heal=0;
  assert.equal(parseSave(JSON.stringify(journey)).supplies.heal,1);
  battle.outcome='defeat';const lost=finishEncounter(journey,battle);
  assert.deepEqual(lost.position,entrance);assert.equal(lost.supplies.heal,3);assert.equal(lost.opened.length,1);assert.equal(lost.cleared.length,1);
});
test('chest is idempotent; camp restores reserves without deleting inventory, charm applies to battle',()=>{
  let j=openChest({...make(),cleared:['slime-branch']});assert.equal(j.reserve.heal,1);assert.deepEqual(openChest(j),j);
  j.roster.ember_knight.hp=1;j=visitCamp(j);j=equipCharm(j,'ember_knight');
  assert.equal(journeyUnit(j,'ember_knight',0).stats.maxHp,231);assert.equal(j.roster.ember_knight.hp,231);assert.equal(j.reserve.heal,1);
  j=equipCharm(j,'forest_ranger');assert.equal(Object.keys(j.equipped).length,1);assert.equal(j.roster.ember_knight.hp,210);
  const next=switchTeam(j,[{id:'shadow_rogue',gender:'male'},{id:'martial_artist',gender:'female'},{id:'forest_ranger',gender:'male'}]);assert.equal(next.team[0].id,'shadow_rogue');assert.equal(next.roster.shadow_rogue.hp,110);
});
test('medicine consumes supply first and refuses full health without mutation',()=>{
  const j=openChest({...make(),cleared:['slime-branch']});assert.throws(()=>applyMedicine(j,'ember_knight'));j.roster.ember_knight.hp=1;
  const next=applyMedicine(j,'ember_knight');assert.equal(next.roster.ember_knight.hp,85);assert.equal(next.supplies.heal,2);assert.equal(next.reserve.heal,1);assert.equal(j.supplies.heal,3);
});
test('save validation rejects unsupported or corrupt data instead of silently resetting',()=>{
  assert.throws(()=>parseSave('{bad'));const j=make();j.version=99 as 2;assert.throws(()=>parseSave(JSON.stringify(j)));
  const other=make();other.team[1]=other.team[0];assert.throws(()=>parseSave(JSON.stringify(other)));
});
test('click route stays on walkable corridor and reaches chest and camp; blocked terrain rejected',()=>{
  for(const target of [chest,camp]){const path=route(entrance,target);assert.ok(path.length>1);assert.deepEqual(path.at(-1),target);assert.ok(path.every(p=>walkable(p.x,p.y)));}
  assert.deepEqual(route(entrance,{x:20,y:20}),[]);
});
