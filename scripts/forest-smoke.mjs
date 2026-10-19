import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
await mkdir('.playwright-mcp',{recursive:true});
import assert from 'node:assert/strict';
import {route,encounters,camps,chests,notes} from '../src/game/forest-map.ts';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:5180'}/forest`);await page.getByRole('button',{name:'開始森林冒險 →'}).click();await page.getByRole('button',{name:'走進森林 →'}).click();
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function advance(ms=1000){await page.evaluate(ms=>window.advanceTime(ms),ms);await page.waitForTimeout(35);}
async function go(target){for(let i=0;i<120;i++){let s=await state();if(s.mode!=='exploration')return;if(Math.hypot(s.position.x-target.x,s.position.y-target.y)<12)return;
  const waypoints=route(s.position,target);assert.ok(waypoints.length,'path exists');let aim=waypoints[0];
  // Choose a visible waypoint along a straight segment; all movement uses canvas clicks.
  const first=waypoints[0];for(const w of waypoints){if(w.x!==first.x&&w.y!==first.y)break;if(Math.hypot(w.x-s.position.x,w.y-s.position.y)>250)break;aim=w;}
  const box=await page.locator('.exploration-scene canvas').boundingBox();
  await page.mouse.click(box.x+aim.x-s.camera.x,box.y+aim.y-s.camera.y);
  await advance(Math.hypot(aim.x-s.position.x,aim.y-s.position.y)/150*1000+160);
 }throw Error('walk timeout '+JSON.stringify(target));}
async function battle(){for(let n=0;n<160;n++){const s=await state();if(s.mode!=='ongoing'){assert.equal(s.mode,'victory');await advance();await page.getByRole('button',{name:'返回森林 →'}).click();await page.waitForTimeout(50);return;}
  const a=s.units.find(u=>u.id===s.active);if(s.busy||a.side==='enemy'){await advance();continue;}
  const caps={ember_knight:231,forest_ranger:140,moon_witch:120,shadow_rogue:110};
  const wounded=s.units.find(u=>u.side==='party'&&u.hp>0&&u.hp<(caps[u.id]??150)*.4);
  if(wounded&&s.supplies.heal>0){await page.getByRole('button',{name:/道具 共用補給/}).click();await page.getByRole('button',{name:/治療藥 ·/}).click();await page.getByTestId('unit-'+wounded.id).click();}
  else {const multi=s.units.filter(u=>u.side==='enemy'&&u.hp>0).length>1;const name=a.id==='ember_knight'?'燃刃 6 MP':a.id==='forest_ranger'?'破風箭 8 MP':a.id==='shadow_rogue'?'背刺 6 MP':multi?'冷焰潮 14 MP':'螢火 5 MP';const btn=page.getByRole('button',{name,exact:true});if(await btn.isEnabled())await btn.click();else await page.getByRole('button',{name:/普通攻擊/}).click();}
  await page.getByRole('button',{name:/確認施放/}).click();await advance();
 }throw Error('battle timeout');}
async function encounter(id){await go(encounters[id].position);assert.equal((await state()).mode,'ongoing');await battle();assert.ok((await state()).cleared.includes(id));console.log('won',id);}
async function interact(){await page.getByRole('button',{name:/^E /}).click();await page.waitForTimeout(50);}
async function rest(index){await go(camps[index].position);await interact();assert.equal((await state()).panel,'camp');}
await encounter('trail-slime');await encounter('slime-branch');await go(chests[0].position);await interact();assert.ok((await state()).treasures.includes('moss-charm'));
await encounter('fallen-rock');await rest(0);await page.getByRole('button',{name:'將苔紋護符裝備給守火人'}).click();await page.getByRole('button',{name:'關閉 ×'}).click();
await go(notes[0].position);await interact();assert.equal((await state()).panel,'note');await page.screenshot({path:'.playwright-mcp/full-note.png',fullPage:true});await page.getByRole('button',{name:'關閉 ×'}).click();
await encounter('stone-path');await encounter('rock-branch');await go(chests[1].position);await interact();assert.ok((await state()).treasures.includes('medicine-kit'));
await rest(1);await page.getByRole('button',{name:'將旅人藥盒裝備給拾風者'}).click();await page.screenshot({path:'.playwright-mcp/full-camp.png',fullPage:true});await page.getByRole('button',{name:'關閉 ×'}).click();
await go(notes[1].position);await interact();await page.getByRole('button',{name:'關閉 ×'}).click();
const saved=await state();await page.reload();await page.getByRole('button',{name:'繼續冒險'}).click();assert.deepEqual((await state()).cleared,saved.cleared);assert.deepEqual((await state()).readNotes,saved.readNotes);
await page.getByRole('button',{name:'地圖 M'}).click();await page.screenshot({path:'.playwright-mcp/full-map.png',fullPage:true});await page.getByRole('button',{name:'關閉 ×'}).click();
await go(encounters.treant.position);assert.equal((await state()).mode,'exploration');await interact();assert.equal((await state()).panel,'boss');await page.screenshot({path:'.playwright-mcp/full-boss-entry.png',fullPage:true});await page.getByRole('button',{name:'挑戰蝕光樹靈',exact:true}).click();await battle();
let s=await state();assert.equal(s.panel,'ending');assert.equal(s.completed,true);assert.equal(s.result.battles,6);assert.equal(s.result.chests,2);assert.equal(s.treasures.length,3);await page.screenshot({path:'.playwright-mcp/full-ending.png',fullPage:true});
await page.reload();await page.getByRole('button',{name:'繼續冒險'}).click();assert.equal((await state()).panel,'ending');assert.equal((await state()).treasures.length,3);
await page.getByRole('button',{name:'保留寶物，再次挑戰 →'}).click();await page.getByRole('button',{name:'關閉 ×'}).click();assert.equal((await state()).panel,'ending');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.playwright-mcp/full-ending-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:1000});
await page.getByRole('button',{name:'返回森林，繼續探索'}).click();assert.equal((await state()).completed,true);await go(encounters.treant.position);await advance(2000);assert.equal((await state()).mode,'exploration');
await page.getByRole('button',{name:'通關紀錄'}).click();await page.getByRole('button',{name:'保留寶物，再次挑戰 →'}).click();await page.locator('.forest-chooser').getByRole('button',{name:'守火人 ✓'}).click();await page.locator('.forest-chooser').getByRole('button',{name:'借影人',exact:true}).click();await page.getByRole('button',{name:'確認隊伍，重新出發'}).click();
s=await state();assert.equal(s.run,2);assert.equal(s.treasures.length,3);assert.equal(s.cleared.length,0);assert.equal(s.opened.length,0);assert.equal(s.reserve.heal,0);assert.ok(s.team.some(t=>t.id==='shadow_rogue'));
await encounter('trail-slime');await encounter('slime-branch');await go(chests[0].position);await interact();s=await state();assert.equal(s.treasures.length,3);assert.equal(s.reserve.heal,2);await interact();assert.equal((await state()).reserve.heal,2);
assert.deepEqual(errors,[]);console.log('PASS full six-encounter journey, optional loot, notes, two camps, Boss entry, ending/reload, return, changed-team replay and duplicate-loot substitution');await browser.close();
