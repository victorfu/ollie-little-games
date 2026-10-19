import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {newJourney,SAVE_KEY} from '../src/game/exploration.ts';
import {chests,camps} from '../src/game/forest-map.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
await mkdir('.playwright-mcp',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const errors=[];
try{for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.url().includes('/environment/')&&r.status()!==200)errors.push(r.url());});
  const fixture=newJourney([{id:'ember_knight',gender:'female'},{id:'forest_ranger',gender:'male'},{id:'moon_witch',gender:'female'}]);fixture.cleared=['trail-slime','slime-branch'];fixture.position={...chests[0].position};
  // Isolated fixture for visual coverage; full traversal is covered by forest-smoke.mjs.
  await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:JSON.stringify(fixture)});
  await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:5180'}/forest`);await page.getByRole('button',{name:'繼續冒險'}).click();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).artReady);
  const label=mobile?'mobile':'desktop';
  await page.screenshot({path:`.playwright-mcp/art-${label}-closed.png`,fullPage:true});
  await page.getByRole('button',{name:'E 開啟林間寶箱'}).click();await page.waitForTimeout(100);await page.screenshot({path:`.playwright-mcp/art-${label}-opened.png`,fullPage:true});
  assert.ok((await page.evaluate(()=>JSON.parse(window.render_game_to_text()))).opened.includes('trail-chest'));
  if(mobile){const start=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).position);const button=page.getByRole('button',{name:'移動←'});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.evaluate(()=>window.advanceTime(250));await page.mouse.up();await page.waitForTimeout(100);const after=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).position);assert.ok(after.x<start.x);}
  await page.getByRole('button',{name:'背包',exact:true}).click();await page.getByRole('button',{name:'寶物',exact:true}).click();await page.screenshot({path:`.playwright-mcp/art-${label}-bag.png`,fullPage:true});await page.getByRole('button',{name:'關閉 ×'}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();
  const campContext=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},hasTouch:mobile});const campPage=await campContext.newPage();campPage.on('pageerror',e=>errors.push(String(e)));
  fixture.position={...camps[0].position};await campPage.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:JSON.stringify(fixture)});
  await campPage.goto(`${process.env.GAME_URL??'http://127.0.0.1:5180'}/forest`);await campPage.getByRole('button',{name:'繼續冒險'}).click();await campPage.waitForFunction(()=>JSON.parse(window.render_game_to_text()).artReady);await campPage.screenshot({path:`.playwright-mcp/art-${label}-camp.png`,fullPage:true});await campPage.getByRole('button',{name:'E 在舊營地休息'}).click();await campPage.screenshot({path:`.playwright-mcp/art-${label}-camp-panel.png`,fullPage:true});assert.ok(await campPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await campContext.close();
}}
finally{await browser.close();}
assert.deepEqual(errors,[]);console.log('PASS storybook assets, closed/open chest, camp, desktop/mobile bag and panels, touch movement, overflow, reduced motion and page errors');
