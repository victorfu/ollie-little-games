import {classes} from './catalog.ts';
import type {ClassId} from './catalog.ts';
import {createBattle,enemy,hero,settleVictory} from './battle.ts';
import type {Battle,Item,Unit} from './battle.ts';
import {entrance,camps,chests,encounters,notes,objects,treasures,walkable,TILE,WIDTH,HEIGHT} from './forest-map.ts';
import type {Point} from './forest-map.ts';
export {entrance,monster,chest,camp,TILE,WIDTH,HEIGHT,walkable,route} from './forest-map.ts';
export type {Point} from './forest-map.ts';
export type Choice={id:ClassId;gender:'female'|'male'};
export type Result={team:Choice[];elapsed:number;battles:number;chests:number;firstReward:boolean};
export type Journey={version:2;team:Choice[];roster:Record<ClassId,{hp:number;mp:number}>;position:Point;checkpoint:Point;cleared:string[];opened:string[];
  treasures:string[];equipped:Partial<Record<ClassId,string>>;supplies:Record<Item,number>;reserve:Record<Item,number>;campVisited:boolean;pendingEncounter:string|null;
  visitedCamps:string[];readNotes:string[];discovered:string[];explored:string[];completed:boolean;endingPending:boolean;run:number;elapsed:number;result:Result|null};
// Keep the storage key stable while migrating the schema inside it.
export const SAVE_KEY='ollie.forest.journey.v1';
export const classIds=Object.keys(classes) as ClassId[];
export function journeyUnit(j:Journey,id:ClassId,slot:number):Unit {
  const u=hero(id,slot),item=j.equipped[id];
  if(item==='moss-charm')u.stats.maxHp=Math.round(u.stats.maxHp*1.1);
  if(item==='medicine-kit')u.itemHealBonus=.1;
  if(item==='dew-pendant')u.statuses.shield={turns:2,source:id,applied:-1,amount:Math.round(u.stats.maxHp*.1)};
  u.hp=Math.min(u.stats.maxHp,j.roster[id].hp);u.mp=Math.min(u.stats.maxMp,j.roster[id].mp);return u;
}
export function newJourney(team:Choice[]):Journey {
  if(team.length!==3||new Set(team.map(t=>t.id)).size!==3||team.some(t=>!classIds.includes(t.id)||(t.gender!=='female'&&t.gender!=='male')))throw new Error('Select three distinct classes');
  const roster=Object.fromEntries(classIds.map(id=>{const h=hero(id,0);return[id,{hp:h.hp,mp:h.mp}];})) as Journey['roster'];
  return discover({version:2,team:structuredClone(team),roster,position:{...entrance},checkpoint:{...entrance},cleared:[],opened:[],treasures:[],equipped:{},supplies:{heal:3,revive:1,cleanse:0},reserve:{heal:0,revive:0,cleanse:0},campVisited:false,pendingEncounter:null,visitedCamps:[],readNotes:[],discovered:[],explored:[],completed:false,endingPending:false,run:1,elapsed:0,result:null});
}
export function discover(j:Journey):Journey {
  const found=objects.filter(o=>Math.hypot(o.position.x-j.position.x,o.position.y-j.position.y)<280).map(o=>o.id);
  const tiles=new Set(j.explored),cx=Math.floor(j.position.x/TILE),cy=Math.floor(j.position.y/TILE);
  for(let x=cx-5;x<=cx+5;x++)for(let y=cy-4;y<=cy+4;y++)if(walkable(x*TILE+20,y*TILE+20))tiles.add(`${x},${y}`);
  return {...j,discovered:[...new Set([...j.discovered,...found])],explored:[...tiles]};
}
export function rest(j:Journey):Journey {
  const next=structuredClone(j);for(const id of classIds){const u=journeyUnit(next,id,0);next.roster[id]={hp:u.stats.maxHp,mp:u.stats.maxMp};}next.supplies={heal:3,revive:1,cleanse:0};return next;
}
export function visitCamp(j:Journey,id='old-camp'):Journey {
  const site=camps.find(c=>c.id===id);if(!site)throw new Error('Unknown camp');
  const next=rest(j);next.campVisited=true;next.checkpoint={...site.position};next.visitedCamps=[...new Set([...next.visitedCamps,id])];return next;
}
export function openChest(j:Journey,id='trail-chest'):Journey {
  const box=chests.find(c=>c.id===id);if(!box)throw new Error('Unknown chest');if(j.opened.includes(id))return j;
  if(!j.cleared.includes(box.guard))throw new Error('Defeat the nearby guards first');
  const next=structuredClone(j);next.opened.push(id);next.reserve.heal++;next.reserve.cleanse++;
  if(!next.treasures.includes(box.treasure))next.treasures.push(box.treasure);else next.reserve.heal++;
  return next;
}
export function equipTreasure(j:Journey,item:string,id:ClassId|null):Journey {
  if(!j.campVisited||!j.treasures.includes(item))throw new Error('Treasure unavailable');
  const next=structuredClone(j);for(const key of classIds)if(next.equipped[key]===item)delete next.equipped[key];
  if(id)next.equipped[id]=item;return rest(next);
}
export function equipCharm(j:Journey,id:ClassId|null):Journey {return equipTreasure(j,'moss-charm',id);}
export function switchTeam(j:Journey,team:Choice[]):Journey {if(!j.campVisited)throw new Error('Camp required');newJourney(team);return {...j,team:structuredClone(team)};}
export function healingFraction(j:Journey){return j.team.some(t=>j.equipped[t.id]==='medicine-kit')?.5:.4;}
export function applyMedicine(j:Journey,id:ClassId):Journey {
  if(!j.team.some(t=>t.id===id))throw new Error('Not in party');const u=journeyUnit(j,id,0);if(u.hp<=0||u.hp>=u.stats.maxHp)throw new Error('No healing needed');
  const next=structuredClone(j),source=next.supplies.heal>0?next.supplies:next.reserve;if(source.heal<=0)throw new Error('No healing item');source.heal--;
  next.roster[id].hp=Math.min(u.stats.maxHp,u.hp+Math.round(u.stats.maxHp*healingFraction(j)));return next;
}
export function canEnterBoss(j:Journey){return ['trail-slime','fallen-rock','stone-path'].every(id=>j.cleared.includes(id));}
export function beginEncounter(j:Journey,id='trail-slime'):{journey:Journey;battle:Battle} {
  const encounter=encounters[id];if(!encounter||j.pendingEncounter||j.cleared.includes(id))throw new Error('Encounter unavailable');
  if(id==='treant'&&!canEnterBoss(j))throw new Error('Clear the main trail first');
  const next=structuredClone(j);next.pendingEncounter=id;
  const b=createBattle([...j.team.map((t,i)=>journeyUnit(j,t.id,i)),...encounter.kinds.map((kind,i)=>enemy(`${kind}-${i}`,kind,i))],12345+j.run);
  b.supplies={...j.supplies};b.reserve={...j.reserve};return {journey:next,battle:b};
}
export function finishEncounter(j:Journey,b:Battle):Journey {
  if(!j.pendingEncounter||!encounters[j.pendingEncounter]||b.outcome==='ongoing')return j;
  const id=j.pendingEncounter;let next=structuredClone(j);next.pendingEncounter=null;
  if(b.outcome==='victory'){
    if(!next.cleared.includes(id))next.cleared.push(id);
    for(const u of settleVictory(b))next.roster[u.id as ClassId]={hp:u.hp,mp:u.mp};next.supplies={...b.supplies};next.reserve={...b.reserve};
    if(id==='treant'){
      const firstReward=!next.treasures.includes('dew-pendant');if(firstReward)next.treasures.push('dew-pendant');
      next.completed=true;next.endingPending=true;next.result={team:structuredClone(next.team),elapsed:next.elapsed,battles:next.cleared.length,chests:next.opened.length,firstReward};
      next.position={...camps[1].position};next.checkpoint={...camps[1].position};
    }
  }else{next=rest(next);next.position={...next.checkpoint};}return next;
}
export function replayJourney(j:Journey,team:Choice[]):Journey {
  if(!j.completed)throw new Error('Complete this journey first');
  const next=newJourney(team);next.treasures=[...j.treasures];next.equipped={...j.equipped};next.run=j.run+1;return rest(next);
}
export function parseSave(raw:string):Journey {
  const data=JSON.parse(raw);if(!data||![1,2].includes(data.version)||!Array.isArray(data.team))throw new Error('Unsupported save');
  newJourney(data.team);
  if(data.version===1){
    // The old broad path is now narrowed at story encounters. Move old saves out of new walls.
    for(const p of [data.position,data.checkpoint])if(p&&Number.isFinite(p.x)&&p.x>=40&&p.x<1160&&Number.isFinite(p.y)&&p.y>=200&&p.y<520&&!walkable(p.x,p.y))p.y=420;
    Object.assign(data,{version:2,visitedCamps:data.campVisited?['old-camp']:[],readNotes:[],discovered:[],explored:[],completed:false,endingPending:false,run:1,elapsed:0,result:null});
  }
  const j=data as Journey;
  for(const p of [j.position,j.checkpoint])if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!walkable(p.x,p.y))throw new Error('Invalid position');
  for(const id of classIds){const r=j.roster?.[id];if(!r||![r.hp,r.mp].every(n=>Number.isInteger(n)&&n>=0&&n<=10000))throw new Error('Invalid roster');}
  for(const bag of [j.supplies,j.reserve])for(const id of ['heal','revive','cleanse'] as const)if(!bag||!Number.isInteger(bag[id])||bag[id]<0||bag[id]>10000)throw new Error('Invalid inventory');
  const lists:[string[],string[]][]=[[j.opened,chests.map(c=>c.id)],[j.cleared,Object.keys(encounters)],[j.treasures,Object.keys(treasures)],[j.visitedCamps,camps.map(c=>c.id)],[j.readNotes,notes.map(n=>n.id)],[j.discovered,objects.map(o=>o.id)]];
  for(const [values,allowed] of lists)if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(v=>!allowed.includes(v)))throw new Error('Invalid world flags');
  if(!j.equipped||Object.entries(j.equipped).some(([id,t])=>!classIds.includes(id as ClassId)||!j.treasures.includes(t))||new Set(Object.values(j.equipped)).size!==Object.keys(j.equipped).length)throw new Error('Invalid equipment');
  if(typeof j.campVisited!=='boolean'||typeof j.completed!=='boolean'||typeof j.endingPending!=='boolean'||!Number.isInteger(j.run)||j.run<1||!Number.isFinite(j.elapsed)||j.elapsed<0||![null,...Object.keys(encounters)].includes(j.pendingEncounter))throw new Error('Invalid progress');
  if(!Array.isArray(j.explored)||j.explored.some(v=>typeof v!=='string'||!/^\d+,\d+$/.test(v)||Number(v.split(',')[0])>=WIDTH/TILE||Number(v.split(',')[1])>=HEIGHT/TILE))throw new Error('Invalid map');
  if(j.completed!==j.cleared.includes('treant')||j.endingPending&&!j.completed)throw new Error('Invalid ending');
  if(j.completed){const r=j.result;if(!r||!Number.isFinite(r.elapsed)||r.elapsed<0||!Number.isInteger(r.battles)||!Number.isInteger(r.chests)||typeof r.firstReward!=='boolean')throw new Error('Invalid result');newJourney(r.team);}else if(j.result!==null)throw new Error('Unexpected result');
  j.pendingEncounter=null;return discover(j);
}
