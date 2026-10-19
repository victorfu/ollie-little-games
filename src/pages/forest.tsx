import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router';
import Adventure from './adventure';
import {ForestArt,objectLabel} from '../game/forest-art';
import type {Battle} from '../game/battle';
import {classes} from '../game/catalog';
import {SAVE_KEY,newJourney,parseSave,beginEncounter,finishEncounter,openChest,visitCamp,switchTeam,equipTreasure,applyMedicine,journeyUnit,classIds,discover,replayJourney,canEnterBoss,healingFraction} from '../game/exploration';
import type {Journey,Choice,Point} from '../game/exploration';
import {WIDTH,HEIGHT,TILE,walkable,route,encounters,camps,chests,notes,objects,treasures} from '../game/forest-map';
import './adventure.css';
import './forest.css';

const defaultTeam:Choice[]=[{id:'ember_knight',gender:'female'},{id:'forest_ranger',gender:'female'},{id:'moon_witch',gender:'female'}];
const initialTrail=(p:Point)=>Array.from({length:35},(_,i)=>{const x=Math.max(60,p.x-i*4.8);return walkable(x,p.y)?{x,y:p.y}:p;});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
type Panel='intro'|'bag'|'camp'|'map'|'party'|'note'|'boss'|'ending'|'replay'|null;
function readStored(){try{const raw=localStorage.getItem(SAVE_KEY);return {save:raw?parseSave(raw):null,error:''};}catch{return {save:null,error:'存檔無法讀取，原資料已保留；可選擇開始新的冒險。'};}}
const duration=(seconds:number)=>`${Math.floor(seconds/60)} 分 ${Math.floor(seconds%60)} 秒`;
function objective(j:Journey){if(j.completed)return '森林的燈已重新亮起。可以補找寶箱，或保留寶物再次挑戰。';if(!j.cleared.includes('trail-slime'))return '沿月露小徑前進，擊敗史萊姆';if(!j.cleared.includes('fallen-rock'))return '穿過倒木空地；北側有可選的寶箱岔路';if(!j.visitedCamps.includes('old-camp'))return '在舊營地休息，整理隊伍與寶物';if(!j.cleared.includes('stone-path'))return '沿主路向東，通過石根步道';if(!j.visitedCamps.includes('forecourt'))return '前往樹靈前庭休息；南側支線有旅人背包';return '閱讀告示，準備好後與樹靈入口互動';}
function ForestMap({journey:j}:{journey:Journey}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=ref.current!,ctx=c.getContext('2d')!;ctx.fillStyle='#e9e7d4';ctx.fillRect(0,0,720,300);const sx=720/WIDTH,sy=300/HEIGHT;
    ctx.fillStyle='#b0bc96';for(const tile of j.explored){const [x,y]=tile.split(',').map(Number);ctx.fillRect(x*TILE*sx,y*TILE*sy,TILE*sx+1,TILE*sy+1);}
    ctx.font='bold 11px sans-serif';for(const o of objects.filter(o=>j.discovered.includes(o.id))){ctx.fillStyle=o.type==='boss'?'#795d83':o.type==='camp'?'#a76d32':'#566c4d';ctx.beginPath();ctx.arc(o.position.x*sx,o.position.y*sy,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fffbe7';ctx.fillText(String(objects.indexOf(o)+1),o.position.x*sx-3,o.position.y*sy+4);}
    ctx.fillStyle='#c24b39';ctx.beginPath();ctx.arc(j.position.x*sx,j.position.y*sy,6,0,Math.PI*2);ctx.fill();
  },[j]);
  return <><canvas className="forest-map-sheet" ref={ref} width="720" height="300" aria-label="已探索道路與發現地點；紅點為隊伍位置"/><div className="map-legend">{objects.map((o,i)=>j.discovered.includes(o.id)&&<span key={o.id}>{i+1}. {o.name}{j.opened.includes(o.id)?" ✓":""}</span>)}</div></>;
}
export default function ForestJourney(){
  const [stored]=useState(readStored);
  const [journey,setJourney]=useState<Journey|null>(null),[selection,setSelection]=useState<Choice[]>(defaultTeam);
  const [bagTab,setBagTab]=useState<'medicine'|'treasure'>('medicine');
  const [fight,setFight]=useState<Battle|null>(null),[fightId,setFightId]=useState('trail-slime'),[panel,setPanel]=useState<Panel>(null);
  const [site,setSite]=useState('old-camp'),[noteId,setNoteId]=useState('camp-note');
  const [notice,setNotice]=useState(stored.error||'循著最後的微光，走進森林。'),[saveStatus,setSaveStatus]=useState('');
  const current=useRef<Journey|null>(null),canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Set<string>()),path=useRef<Point[]>([]),trail=useRef<Point[]>([]);
  const sprites=useRef(new Map<string,HTMLImageElement>()),camera=useRef({x:0,y:0}),grace=useRef(1.5),clock=useRef(0),lastSave=useRef(0),fightStarted=useRef(0);
  const art=useRef<ForestArt|null>(null);
  const reducedMotion=useRef(false);
  useEffect(()=>{art.current=new ForestArt();reducedMotion.current=window.matchMedia('(prefers-reduced-motion: reduce)').matches;},[]);
  useEffect(()=>{
    const paths:string[]=[];
    for(const id of ['moondew_slime','mossrock_grunt','eclipse_treant'])for(let frame=0;frame<4;frame++)paths.push(`/monsters/animations/hd/chibi/${id}/idle-${frame}.png`);
    for(const t of journey?.team??selection)for(const action of ['idle','run'])for(let frame=0;frame<4;frame++)paths.push(`/characters/animations/hd/chibi/${t.id}_${t.gender}/${action}-${frame}.png`);
    for(const src of paths)if(!sprites.current.has(src)){const img=new Image();img.src=src;sprites.current.set(src,img);}
  },[journey?.team,selection]);
  const tickRef=useRef<(dt:number)=>void>(()=>{}),interactRef=useRef<()=>void>(()=>{});
  function persist(j:Journey){try{localStorage.setItem(SAVE_KEY,JSON.stringify(j));setSaveStatus('進度已儲存');}catch{setSaveStatus('儲存失敗：瀏覽器儲存空間不可用，請勿關閉分頁。');}}
  function update(j:Journey,save=true){current.current=j;setJourney(j);if(save)persist(j);}
  function load(j:Journey){update(j);trail.current=initialTrail(j.position);grace.current=1.5;path.current=[];keys.current.clear();setPanel(j.endingPending?'ending':null);}
  function start(){if((stored.save||stored.error)&&!window.confirm('開始新冒險會覆蓋此瀏覽器的存檔與收藏，確定嗎？'))return;load(newJourney(selection));setPanel('intro');}
  const nearby=journey?objects.filter(o=>distance(o.position,journey.position)<85&&!(o.type==='boss'&&journey.completed)).sort((a,b)=>distance(a.position,journey.position)-distance(b.position,journey.position))[0]:undefined;
  function openPanel(p:Panel){keys.current.clear();path.current=[];setPanel(p);if(current.current)persist(current.current);}
  function closePanel(){const j=current.current;if(panel==='replay'&&j?.endingPending){openPanel('ending');return;}if(j&&panel==='ending')update({...j,endingPending:false});openPanel(null);}
  function enterFight(id:string){const j=current.current;if(!j)return;const entry=beginEncounter(j,id);update(entry.journey);keys.current.clear();path.current=[];fightStarted.current=performance.now();setFightId(id);setPanel(null);setFight(entry.battle);}
  function interact(){const j=current.current;if(!j||panel||fight)return;const target=objects.filter(o=>distance(o.position,j.position)<85&&!(o.type==='boss'&&j.completed)).sort((a,b)=>distance(a.position,j.position)-distance(b.position,j.position))[0];if(!target)return;
    if(target.type==='chest'){const box=chests.find(c=>c.id===target.id)!;if(!j.opened.includes(box.id)&&!j.cleared.includes(box.guard)){setNotice('附近的怪物守著這份補給，先擊敗牠們吧。');return;}const owned=j.treasures.includes(box.treasure),next=openChest(j,box.id);update(next);setNotice(next===j?'已經取走這裡的物品。':owned?'已擁有這件寶物，改獲治療藥 ×2、淨化藥 ×1。':`獲得 ${treasures[box.treasure].name}、治療藥 ×1、淨化藥 ×1。`);}
    if(target.type==='camp'){const next=visitCamp(j,target.id);update(next);setSite(target.id);setSelection(next.team);openPanel('camp');setNotice('營火恢復全員 HP、MP 與補給。可以換人或裝備寶物。');}
    if(target.type==='note'){setNoteId(target.id);update({...j,readNotes:[...new Set([...j.readNotes,target.id])]});openPanel('note');}
    if(target.type==='boss'){if(!canEnterBoss(j)){setNotice('先清除主路上的三場遭遇，再進入樹靈盤踞之地。');return;}openPanel('boss');}
  }
  function resolve(b:Battle){const j=current.current;if(j&&j.pendingEncounter)update(finishEncounter({...j,elapsed:j.elapsed+(performance.now()-fightStarted.current)/1000},b));}
  function returnFromBattle(){setFight(null);keys.current.clear();path.current=[];grace.current=2;const j=current.current;if(j){trail.current=initialTrail(j.position);setPanel(j.endingPending?'ending':null);setNotice(objective(j));}}
  function draw(j:Journey,moving:boolean){const c=canvas.current;if(!c)return;const ctx=c.getContext('2d')!,width=c.clientWidth,height=c.clientHeight;
    const ratio=window.devicePixelRatio||1;if(c.width!==Math.round(width*ratio)||c.height!==Math.round(height*ratio)){c.width=Math.round(width*ratio);c.height=Math.round(height*ratio);}ctx.setTransform(ratio,0,0,ratio,0,0);
    camera.current={x:Math.max(0,Math.min(WIDTH-width,j.position.x-width/2)),y:Math.max(0,Math.min(HEIGHT-height,j.position.y-height/2))};
    ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(-camera.current.x,-camera.current.y);
    art.current?.ground(ctx,camera.current,width,height,j.completed);
    const sprite=(src:string,p:Point,size:number)=>{let img=sprites.current.get(src);if(!img){img=new Image();img.src=src;sprites.current.set(src,img);}if(img.complete&&img.naturalWidth)ctx.drawImage(img,p.x-size/2,p.y-size+10,size,size);};
    ctx.font='12px sans-serif';
    for(const [id,e] of Object.entries(encounters)){if(j.cleared.includes(id))continue;const type=e.kinds[0],asset=type==='boss'?'eclipse_treant':type==='rock'?'mossrock_grunt':'moondew_slime';sprite(`/monsters/animations/hd/chibi/${asset}/idle-${Math.floor(clock.current*4)%4}.png`,e.position,type==='boss'?110:80);objectLabel(ctx,e.manual?'入口・互動才開戰':`${e.name}${e.optional?'（支線）':''}${e.kinds.length>1?' ×2':''}`,e.position);}
    for(const box of chests){art.current?.chest(ctx,box.position,j.opened.includes(box.id));objectLabel(ctx,box.name+(j.opened.includes(box.id)?' · 已取':''),box.position);}
    for(const site of camps){art.current?.camp(ctx,site.position,clock.current,reducedMotion.current);objectLabel(ctx,site.name,site.position);}
    for(const note of notes){const p=note.position;ctx.save();ctx.shadowColor='#4c512c55';ctx.shadowBlur=4;ctx.fillStyle='#705136';ctx.fillRect(p.x-3,p.y-30,6,40);ctx.fillStyle='#a3814d';ctx.beginPath();ctx.roundRect(p.x-23,p.y-40,46,31,3);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#f1e1b7';ctx.fillRect(p.x-18,p.y-36,36,23);ctx.strokeStyle='#9b8b5a';ctx.lineWidth=1;for(let line=0;line<3;line++){ctx.beginPath();ctx.moveTo(p.x-12,p.y-30+line*5);ctx.lineTo(p.x+10-line*3,p.y-30+line*5);ctx.stroke();}ctx.restore();objectLabel(ctx,'旅人留言',p);}
    for(let x=240;x<WIDTH;x+=320){if(Object.values(encounters).some(e=>Math.abs(e.position.x-x)<80&&Math.abs(e.position.y-460)<120))continue;ctx.save();ctx.fillStyle='#7f6140';ctx.fillRect(x,462,5,28);ctx.fillStyle='#654b32';ctx.beginPath();ctx.moveTo(x-8,449);ctx.lineTo(x+2,441);ctx.lineTo(x+12,449);ctx.fill();ctx.fillStyle=j.completed?'#ffe0a0':'#b9b088';ctx.fillRect(x-6,449,17,17);ctx.strokeStyle='#745335';ctx.lineWidth=2;ctx.strokeRect(x-6,449,17,17);if(j.completed){ctx.shadowColor='#ffe291';ctx.shadowBlur=15;ctx.fillStyle='#fff5bd';ctx.fillRect(x,452,4,9);}ctx.restore();}
    const party=j.team.map((t,i)=>({t,i,p:i===0?j.position:trail.current[Math.min(i*10,trail.current.length-1)]??j.position})).sort((a,b)=>a.p.y-b.p.y);
    for(const {t,i,p} of party){sprite(`/characters/animations/hd/chibi/${t.id}_${t.gender}/${moving?'run':'idle'}-${moving?Math.floor(clock.current*9)%4:0}.png`,p,70);if(i===0){ctx.fillStyle='#f8e8a5';ctx.beginPath();ctx.ellipse(p.x,p.y+7,10,3,0,0,Math.PI*2);ctx.fill();}}
    ctx.restore();
  }
  function tick(dt:number){const j=current.current;if(!j||fight)return;const elapsed=Math.min(Math.max(dt,0),.05);clock.current+=elapsed;grace.current=Math.max(0,grace.current-elapsed);let moving=false;
    if(!panel&&!j.endingPending){let dx=Number(keys.current.has('d')||keys.current.has('ArrowRight'))-Number(keys.current.has('a')||keys.current.has('ArrowLeft')),dy=Number(keys.current.has('s')||keys.current.has('ArrowDown'))-Number(keys.current.has('w')||keys.current.has('ArrowUp'));
      if(dx||dy)path.current=[];else if(path.current.length){const p=path.current[0];dx=p.x-j.position.x;dy=p.y-j.position.y;if(Math.hypot(dx,dy)<5){path.current.shift();dx=dy=0;}}
      const next={...j,elapsed:j.completed?j.elapsed:j.elapsed+elapsed,position:{...j.position}};const length=Math.hypot(dx,dy);
      if(length){const step=Math.min(150*elapsed,length>2?length:150*elapsed),nx=j.position.x+dx/length*step,ny=j.position.y+dy/length*step;
        if(walkable(nx,j.position.y))next.position.x=nx;if(walkable(next.position.x,ny))next.position.y=ny;
        moving=distance(next.position,j.position)>.01;if(moving&&(!trail.current.length||distance(trail.current[0],next.position)>3)){trail.current.unshift({...next.position});trail.current=trail.current.slice(0,35);}
      }
      const changedTile=Math.floor(next.position.x/TILE)!==Math.floor(j.position.x/TILE)||Math.floor(next.position.y/TILE)!==Math.floor(j.position.y/TILE);
      update(changedTile?discover(next):next,false);
      const now=current.current!;const contact=Object.entries(encounters).find(([id,e])=>!e.manual&&!now.cleared.includes(id)&&distance(now.position,e.position)<38);
      if(!now.pendingEncounter&&grace.current===0&&contact){enterFight(contact[0]);return;}
      if(clock.current-lastSave.current>.8){persist(now);lastSave.current=clock.current;}
    }draw(current.current!,moving);
  }
  useEffect(()=>{tickRef.current=tick;interactRef.current=interact;});
  useEffect(()=>{let frame=0,previous=performance.now();function loop(time:number){tickRef.current((time-previous)/1000);previous=time;frame=requestAnimationFrame(loop);}frame=requestAnimationFrame(loop);return()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{function down(e:KeyboardEvent){if(e.ctrlKey||e.metaKey||e.altKey||(e.target as HTMLElement).matches('input,select,textarea'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){if(!fight&&!panel){e.preventDefault();keys.current.add(e.key);}}if(e.key==='e'&&!e.repeat)interactRef.current();if(e.key==='Escape'&&!fight)closePanel();if(e.key==='m'&&!fight&&!journey?.endingPending)openPanel(panel==='map'?null:'map');}function up(e:KeyboardEvent){keys.current.delete(e.key);}function clear(){keys.current.clear();path.current=[];if(current.current)persist(current.current);}
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);window.addEventListener('pagehide',clear);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);window.removeEventListener('pagehide',clear);};});
  useEffect(()=>{if(fight)return;const w=window as unknown as Record<string,unknown>;w.render_game_to_text=()=>JSON.stringify({mode:journey?'exploration':'forest-start',position:journey?.position,followers:journey?.team.slice(1).map((_,i)=>trail.current[(i+1)*10]??journey.position),team:journey?.team,panel,cleared:journey?.cleared,opened:journey?.opened,treasures:journey?.treasures,equipped:journey?.equipped,supplies:journey?.supplies,reserve:journey?.reserve,roster:journey?.roster,visitedCamps:journey?.visitedCamps,readNotes:journey?.readNotes,completed:journey?.completed,run:journey?.run,result:journey?.result,nearby:nearby?.id,artReady:art.current?.ready(),artFailed:art.current?.failed,coordinates:'world pixels; origin top-left, x right, y down; 2400x960',camera:camera.current,objects,encounters});w.advanceTime=(ms:number)=>{for(let t=0;t<Math.min(ms,10000);t+=16)tickRef.current(.016);};return()=>{delete w.render_game_to_text;delete w.advanceTime;};},[journey,panel,fight,nearby]);
  const chooser=<div className="forest-chooser">{classIds.map(id=>{const selected=selection.some(t=>t.id===id);return <button key={id} aria-pressed={selected} onClick={()=>setSelection(selected?selection.filter(t=>t.id!==id):selection.length<3?[...selection,{id,gender:'female'}]:selection)}><img src={`/characters/animations/hd/chibi/${id}_${selection.find(t=>t.id===id)?.gender??'female'}/idle-0.png`} alt=""/>{classes[id].name}{selected?' ✓':''}</button>;})}</div>;
  const appearances=<div className="appearance-row">{selection.map(t=><label key={t.id}>{classes[t.id].name}<select value={t.gender} onChange={e=>setSelection(selection.map(x=>x.id===t.id?{...x,gender:e.target.value as Choice['gender']}:x))}><option value="female">女性</option><option value="male">男性</option></select></label>)}</div>;
  if(fight&&journey)return <Adventure session={{battle:fight,team:journey.team,name:encounters[fightId].name,onResolved:resolve,onReturn:returnFromBattle}}/>;
  return <main className="adventure forest-page"><header className="adventure-top"><Link to="/">OLLIE LITTLE GAMES</Link><span>熄燈森林 · 第 {journey?.run??1} 次冒險</span><Link to="/adventure">獨立戰鬥試玩</Link></header>
    {!journey?<section className="forest-start"><p className="eyebrow">A LITTLE JOURNEY BEGINS</p><h1>循著微光，走進森林。</h1><p>組成三人隊伍，探索兩條支線，在森林深處找回被吞走的光。</p>{chooser}{appearances}<button className="primary" disabled={selection.length!==3} onClick={start}>開始森林冒險 →</button>{stored.save&&<button onClick={()=>load(stored.save!)}>繼續冒險</button>}<p role="status">{notice}</p></section>:<>
      <div className="forest-toolbar"><div className="forest-party">{journey.team.map((t,i)=>{const u=journeyUnit(journey,t.id,i);return <button key={t.id} onClick={()=>openPanel('party')}><img src={`/characters/animations/hd/chibi/${t.id}_${t.gender}/idle-0.png`} alt=""/><span>{u.name}{i===0?' · 隊長':''}<small>HP {u.hp} / {u.stats.maxHp}</small><meter min="0" max={u.stats.maxHp} value={u.hp} aria-label={`${u.name}的生命值`}/></span></button>;})}</div><div><button onClick={()=>openPanel('map')}>地圖 M</button><button onClick={()=>openPanel('bag')}>背包</button>{journey.completed&&<button onClick={()=>openPanel('ending')}>通關紀錄</button>}</div></div>
      <div className="forest-objective">{objective(journey)}<span>{saveStatus}</span></div>
      <div className={`exploration-scene ${journey.completed?'forest-restored':''}`}><canvas ref={canvas} aria-label="森林探索地圖：方向鍵或 WASD 移動，也可點擊路徑" onPointerDown={e=>{if(panel)return;const r=e.currentTarget.getBoundingClientRect();path.current=route(current.current!.position,{x:e.clientX-r.left+camera.current.x,y:e.clientY-r.top+camera.current.y});}}/><div className="exploration-label">{journey.position.x<1000?'月露小徑 ─ 倒木空地':journey.position.x<1900?'舊營地 ─ 石根步道':'樹靈前庭'}{journey.completed?' · 燈火已亮':''}</div>{nearby&&!panel&&<button className="interact-button" onClick={interact}>E {nearby.type==='camp'?'在'+nearby.name+'休息':nearby.type==='chest'?(journey.opened.includes(nearby.id)?'查看空容器':'開啟'+nearby.name):nearby.name}</button>}</div>
      <div className="forest-bottom"><p role="status">{notice}</p><span>治療 {journey.supplies.heal} · 復甦 {journey.supplies.revive}</span></div>
      <div className="touch-controls">{[['↑','w'],['←','a'],['↓','s'],['→','d']].map(([label,key])=><button key={key} aria-label={`移動${label}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key);}} onPointerUp={()=>keys.current.delete(key)} onPointerCancel={()=>keys.current.clear()} onLostPointerCapture={()=>keys.current.delete(key)}>{label}</button>)}<button onClick={interact}>互動 E</button></div>
      {panel&&<div className="forest-overlay"><section className={`forest-modal ${panel==='ending'?'ending-modal':''}`} role="dialog" aria-modal="true" aria-label={panel==='camp'?'營火':panel==='bag'?'背包':panel==='ending'?'通關結算':panel==='replay'?'再次挑戰':'探索視窗'}><button className="modal-close" onClick={closePanel}>關閉 ×</button>
      {panel==='intro'?<><p className="eyebrow">THE UNLIT FOREST</p><h2>最後一盞引路燈</h2><p>森林裡的引路燈，一盞接一盞熄滅。三名旅人循著最後的微光，走進林間。</p><p>WASD／方向鍵移動，點擊小徑也能前進。接近寶箱與營火後按 E 互動。只有隊長會觸發戰鬥。</p><button className="primary" onClick={closePanel}>走進森林 →</button></>:panel==='ending'&&journey.result?<><p className="eyebrow">THE LIGHT RETURNS</p><h2>森林的燈，重新亮起了。</h2><div className="ending-party">{journey.result.team.map(t=><img key={t.id} src={`/characters/animations/hd/chibi/${t.id}_${t.gender}/idle.gif`} alt={classes[t.id].name}/>)}</div><p>樹心的微光散入林間，照亮回家的路。謝謝你們，三位同行的旅人。</p><div className="ending-stats"><span>冒險時間<b>{duration(journey.result.elapsed)}</b></span><span>完成遭遇<b>{journey.result.battles} / 6</b></span><span>找到寶箱<b>{journey.result.chests} / 2</b></span></div><p>{journey.result.firstReward?'首次通關獎勵：晨露墜飾，已加入收藏。':'晨露墜飾已在收藏中，不會重複發放。'}</p><button onClick={closePanel}>返回森林，繼續探索</button><button className="primary" onClick={()=>{setSelection(journey.team);openPanel('replay');}}>保留寶物，再次挑戰 →</button></>:panel==='replay'?<><p className="eyebrow">ANOTHER JOURNEY</p><h2>換一支隊伍，再走一趟。</h2><p>保留 {journey.treasures.map(id=>treasures[id].name).join('、')}。地圖、遭遇與備用藥品重置，補給回滿。</p>{chooser}{appearances}<button className="primary" disabled={selection.length!==3} onClick={()=>{load(replayJourney(journey,selection));setNotice('收藏的寶物已保留。新的旅程開始了！');}}>確認隊伍，重新出發</button></>:panel==='boss'?<><p className="eyebrow">BEYOND THE LAST LANTERN</p><h2>進入樹靈盤踞之地？</h2><p>樹靈蓄勢後將對全隊爆發。打破或驅散護盾、沉默可以中斷；來不及時可以防禦。背後的營火能完整恢復。</p><button onClick={closePanel}>再準備一下</button><button className="primary" onClick={()=>enterFight('treant')}>挑戰蝕光樹靈</button></>:panel==='note'?<><p className="eyebrow">A TRAVELER LEFT THESE WORDS</p><h2>{notes.find(n=>n.id===noteId)?.name}</h2><p className="traveler-note">{notes.find(n=>n.id===noteId)?.text}</p></>:panel==='map'?<><p className="eyebrow">FOREST TRAIL</p><h2>林間手繪地圖</h2><ForestMap journey={journey}/><p>紅點為隊伍；僅顯示已探索道路與發現的地點。開啟地圖時暫停探索。</p></>:panel==='party'?<><h2>同行的旅人</h2><p>點選隊員設為隊長；更換出戰職業請到營火。</p>{journey.team.map(t=><button key={t.id} onClick={()=>{const next={...journey,team:[t,...journey.team.filter(x=>x.id!==t.id)]};update(next);trail.current=initialTrail(next.position);}}>{classes[t.id].name} · 設為隊長</button>)}</>:<>
      <p className="eyebrow">{panel==='camp'?'REST BY THE FIRE':'SHARED INVENTORY'}</p><h2>{panel==='camp'?camps.find(c=>c.id===site)?.name+'的暖火':'旅人的背包'}</h2>{panel==='camp'&&<img className="camp-panel-illustration" src="/environment/storybook/camp.webp" alt="暖火與環繞營火的苔石"/>}
      {panel==='camp'&&<><p>全員狀態與補給已恢復。選擇三人後確認換隊。</p>{chooser}{appearances}<button className="primary" disabled={selection.length!==3} onClick={()=>{const next=switchTeam(journey,selection);update(next);trail.current=initialTrail(next.position);setNotice('出戰隊伍已更新並儲存。');}}>確認換隊</button></>}
      {panel==='bag'&&<div className="bag-tabs"><button aria-pressed={bagTab==='medicine'} onClick={()=>setBagTab('medicine')}>藥品</button><button aria-pressed={bagTab==='treasure'} onClick={()=>setBagTab('treasure')}>寶物</button></div>}{(panel==='camp'||bagTab==='medicine')&&<><h3>藥品</h3><p>治療補給 {journey.supplies.heal}/3 · 備用治療藥 {journey.reserve.heal} · 復甦補給 {journey.supplies.revive}/1 · 淨化藥 {journey.reserve.cleanse}</p><p className="muted">優先使用補給。探索治療由攜帶藥盒的出戰隊員協助，回復 {Math.round(healingFraction(journey)*100)}% HP；戰鬥中由持有者使用才有加成。</p>{journey.team.map(t=>{const u=journeyUnit(journey,t.id,0);return <button key={t.id} disabled={u.hp===u.stats.maxHp||journey.supplies.heal+journey.reserve.heal===0} onClick={()=>{update(applyMedicine(journey,t.id));setNotice(`${u.name}已使用治療藥。`);}}>治療 {u.name} · {u.hp}/{u.stats.maxHp} → {Math.min(u.stats.maxHp,u.hp+Math.round(u.stats.maxHp*healingFraction(journey)))}</button>;})}</>}
      {(panel==='camp'||bagTab==='treasure')&&<><h3>寶物</h3>{journey.treasures.length?journey.treasures.map(id=>{const holder=classIds.find(c=>journey.equipped[c]===id);return <div className="treasure-entry" key={id}><p><b>{treasures[id].name}</b> · {treasures[id].detail}<br/>{holder?'裝備者：'+classes[holder].name:'尚未裝備'}</p>{panel==='camp'?<div className="equip-controls">{journey.team.map(t=><button key={t.id} onClick={()=>update(equipTreasure(journey,id,t.id))}>將{treasures[id].name}裝備給{classes[t.id].name}</button>)}<button onClick={()=>update(equipTreasure(journey,id,null))}>卸下{treasures[id].name}</button></div>:<p className="muted">每人一件，到營火可更換裝備。</p>}</div>;}):<p>還沒有寶物。找找支線的補給。</p>}</>}
      </>}
      </section></div>}
    </>}
    <footer className="adventure-footer">WASD／方向鍵移動 · 點擊小徑尋路 · E 互動 · M 地圖 · Esc 關閉視窗</footer>
  </main>;
}
