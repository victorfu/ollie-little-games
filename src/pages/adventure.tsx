import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { act, bossIntent, bossTurn, createBattle, enemy, enemyIntent, enemyTurn, estimateDamage, hero, settleVictory, speed } from '../game/battle';
import type { Battle, Command, Item, Unit } from '../game/battle';
import { classes, skills } from '../game/catalog';
import type { ClassId, Skill, StatusId } from '../game/catalog';
import './adventure.css';

type Choice = { id: ClassId; gender: 'female' | 'male' };
const ids=Object.keys(classes) as ClassId[];
const roles=['保護同伴・火焰劍盾','破防重擊・近戰連拳','月光魔法・群體攻擊','精準射擊・拖慢敵人','治療淨化・光之祝福','隱身爆發・沉默干擾'];
const elements={none:'無',fire:'火',earth:'地',moon:'月',wind:'風',light:'光',shadow:'影'};
const names: Record<StatusId,string>={burn:'燃燒',regen:'再生',stun:'暈眩',sleep:'沉睡',bind:'束縛',slow:'緩速',haste:'加速',weak:'虛弱',boost:'鼓舞',break:'破防',guard:'堅守',shield:'護盾',taunt:'嘲諷',silence:'沉默',blind:'致盲',hidden:'隱身'};
const itemNames={heal:'治療藥',revive:'復甦藥',cleanse:'淨化藥'};
const debuffs: StatusId[]=['burn','stun','sleep','bind','slow','weak','break','taunt','silence','blind'];
const statusDetails: Record<StatusId,string>={burn:'行動開始損失最大 HP 5%',regen:'行動開始恢復最大 HP 5%',stun:'跳過行動',sleep:'跳過行動，受到傷害醒來',bind:'閃避率歸零',slow:'速度 −25%',haste:'速度 +25%',weak:'物攻、魔攻 −25%',boost:'物攻、魔攻 +25%',break:'物防、魔防 −25%',guard:'物防、魔防 +25%',shield:'優先吸收直接傷害',taunt:'單體攻擊只能指定施放者',silence:'無法使用技能',blind:'攻擊有 50% 機率失手',hidden:'無法被指定；出手或受到範圍傷害時現形'};
const encounters=[{name:'月露小徑',subtitle:'初次相遇',kinds:['slime']},{name:'倒木空地',subtitle:'留意重擊預告',kinds:['rock']},{name:'石根步道',subtitle:'選擇優先目標',kinds:['slime','rock']},{name:'樹靈前庭',subtitle:'擊碎光殼，找回森林的微光',kinds:['boss']}] as const;
const normal: Skill={name:'普通攻擊',mp:0,target:'enemy',power:1,damage:'physical',element:'none'};
function describe(s: Skill) {
  return [s.power ? `${s.damage==='magic'?'魔法':'物理'}・${elements[s.element??'none']}屬性 ×${s.power}${s.hits?`，${s.hits} 段`:''}`:'',...(s.effects??[]).map(e=>`${Math.round((e.chance??1)*100)}% ${names[e.status]} ${e.turns} 次行動`),s.heal?`治療力 ×${s.heal}`:'',s.cleanse?'清除減益':'',s.dispel?'解除敵方增益':'',s.shield?'護盾：施放者最大 HP 15%':'',s.restoreMp?'回復 6 MP':'',s.sureHit?'無法被閃避':'',s.knockback?'40% 擊退一位':'',s.stealthCrit?'隱身時必定暴擊':''].filter(Boolean).join(' · ');
}
function Forest() {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let cancelled=false;const c=ref.current!,ctx=c.getContext('2d')!;c.width=1400;c.height=520;
    c.dataset.artReady='false';ctx.fillStyle='#819676';ctx.fillRect(0,0,1400,520);
    const load=async(name:string)=>{const img=new Image();img.src=`/environment/storybook/${name}.webp`;await img.decode();return img;};
    void Promise.all(['ground','path','trees'].map(load)).then(([ground,path,trees])=>{
      if(cancelled)return;
      ctx.drawImage(ground,0,0,1400,520);ctx.fillStyle='#31554255';ctx.fillRect(0,0,1400,520);
      for(let x=-100;x<1450;x+=220)ctx.drawImage(trees,x,-35+(x%3)*10,380,380);
      ctx.save();ctx.beginPath();ctx.ellipse(700,560,950,245,0,0,Math.PI*2);ctx.clip();ctx.drawImage(path,0,250,1400,400);ctx.fillStyle='#fff0c52b';ctx.fillRect(0,250,1400,400);ctx.restore();
      const light=ctx.createLinearGradient(0,0,0,520);light.addColorStop(0,'#fff3bb30');light.addColorStop(1,'#fff3bb00');ctx.fillStyle=light;ctx.fillRect(0,0,1400,520);c.dataset.artReady='true';
    }).catch(()=>{ /* Keep the painted fallback if a local asset fails to load. */ });
    return()=>{cancelled=true;};
  },[]);
  return <canvas ref={ref} className="forest-canvas" aria-hidden="true"/>;
}
export type AdventureSession={battle:Battle;team:Choice[];name?:string;onResolved:(battle:Battle)=>void;onReturn:()=>void};
export default function Adventure({session}:{session?:AdventureSession}={}) {
  const [team,setTeam]=useState<Choice[]>(session?.team??[]),[focus,setFocus]=useState<ClassId>('ember_knight');
  const [genders,setGenders]=useState<Record<string,'female'|'male'>>({});
  const [battle,setBattle]=useState<Battle|null>(session?.battle??null),[encounter,setEncounter]=useState(0);
  const [pending,setPending]=useState<Command|null>(null),[bag,setBag]=useState(false);
  const [fast,setFast]=useState(false),[busy,setBusy]=useState(false),[motion,setMotion]=useState<{actor:string;action:string;delta:Record<string,number>}|null>(null);
  const [message,setMessage]=useState('選擇三位旅人，一起走進森林。'),[error,setError]=useState('');
  const root=useRef<HTMLElement>(null);
  const reported=useRef(false);
  useEffect(()=>{if(session&&battle&&battle.outcome!=='ongoing'&&!reported.current){reported.current=true;session.onResolved(battle);}},[battle,session]);
  useEffect(()=>{const title=document.title;document.title='熄燈森林 · 三人小隊冒險';return()=>{document.title=title;};},[]);
  const active=battle?.units.find(u=>u.id===battle.active);
  const boss=battle?.units.find(u=>u.boss&&u.hp>0);
  const playable=!!battle && battle.outcome==='ongoing' && active?.side==='party' && !busy;
  function asset(u: Unit, action='idle') {return u.side==='party'?`/characters/animations/hd/chibi/${u.id}_${team.find(t=>t.id===u.id)?.gender??'female'}/${action}.gif`:`/monsters/animations/hd/chibi/${u.boss?'eclipse_treant':u.ai?.kind==='rock'?'mossrock_grunt':'moondew_slime'}/${action}.gif`;}
  function start(index=encounter) {const next=createBattle([...team.map((t,i)=>hero(t.id,i)),...encounters[index].kinds.map((k,i)=>enemy(`${k}-${i}`,k,i))],Date.now()>>>0);setBattle(next);setPending(null);setBag(false);setBusy(false);setMotion(null);setError('');setMessage('旅人們準備好了。選擇指令，再確認目標。');}
  function toggle(id: ClassId) {setFocus(id);setTeam(current=>current.some(t=>t.id===id)?current.filter(t=>t.id!==id):current.length<3?[...current,{id,gender:genders[id]??'female'}]:current);}
  function commit(next: Battle, label: string, action: string) {if(!battle || !active)return;const delta=Object.fromEntries(next.units.map(u=>[u.id,u.hp-battle.units.find(x=>x.id===u.id)!.hp]));setMotion({actor:active.id,action,delta});setBattle(next);setPending(null);setBag(false);setBusy(true);setError('');setMessage(`${active.name}使用${label}${next.events.some(e=>e.includes('miss'))?' · 有攻擊未命中':''}${next.events.filter(e=>e.includes('蓄勢中斷')||e.includes('第二階段')).map(e=>' · '+e.replace('boss-0: ', '')).join('')}`);}
  function stepEnemy() {if(!battle || !active || active.side!=='enemy' || battle.outcome!=='ongoing')return;const intent=active.boss?bossIntent(battle,active):enemyIntent(battle,active);commit(active.boss?bossTurn(battle):enemyTurn(battle),intent.skill.name,intent.skill.target==='self'?'block':'thrust');}
  useEffect(()=>{if(!busy)return;const timer=setTimeout(()=>{setBusy(false);setMotion(null);},fast?280:850);return()=>clearTimeout(timer);},[busy,fast,battle]);
  useEffect(()=>{if(!battle || battle.outcome!=='ongoing' || active?.side!=='enemy' || busy)return;const timer=setTimeout(stepEnemy,fast?260:1000);return()=>clearTimeout(timer);});
  function skillFor(c: Command): Skill {return c.type==='skill'?skills[c.skill]:normal;}
  function validTargets(c: Command): Unit[] {
    if(!battle||!active)return[];
    if(c.type==='defend')return[active];
    if(c.type==='item')return battle.units.filter(u=>u.side==='party'&&(c.item==='revive'?u.hp<=0:u.hp>0)&&(c.item!=='heal'||u.hp<u.stats.maxHp)&&(c.item!=='cleanse'||debuffs.some(s=>u.statuses[s])));
    const sk=skillFor(c);if(sk.target==='self')return[active];
    const taunter=battle.units.find(u=>u.id===active.statuses.taunt?.source&&u.hp>0&&!u.statuses.hidden);
    return battle.units.filter(u=>u.hp>0&&(sk.target==='ally'?u.side==='party':u.side==='enemy')&&(sk.target!=='enemy'||(!u.statuses.hidden&&(!taunter||u.id===taunter.id))));
  }
  function choose(c: Command) {setError('');const ts=validTargets(c);if(c.type!=='defend')c={...c,target:ts[0]?.id??''};setPending(c);}
  function confirm() {if(!battle||!pending||!playable)return;try {const label=pending.type==='skill'?skills[pending.skill].name:pending.type==='item'?itemNames[pending.item]:pending.type==='defend'?'防禦':'普通攻擊';commit(act(battle,pending),label,pending.type==='defend'?'block':pending.type==='item'?'block':'slash');}catch{setError('這個指令目前無法使用，請重新選擇目標。');}}
  const targets=pending?validTargets(pending):[];
  const selected=battle?.units.find(u=>pending&&'target'in pending&&u.id===pending.target);
  function preview() {
    if(!pending||!active||!battle)return '選擇指令 → 選擇目標 → 確認施放';
    if(pending.type==='defend')return '直接傷害減少 50%，持續至自己下次行動開始。';
    if(!selected)return '沒有有效目標，請選其他指令。';
    if(pending.type==='item') {const i=pending.item;return `${itemNames[i]} · ${battle.supplies[i]>0?'使用營火補給':'使用備用藥'} · ${i==='cleanse'?'清除所有減益':i==='revive'?`恢復 ${Math.round(selected.stats.maxHp*.3)} HP；${battle.queue.includes(selected.id)?'本回合可行動':'下回合可行動'}`:`恢復 ${Math.min(selected.stats.maxHp-selected.hp,Math.round(selected.stats.maxHp*(.4+(active.itemHealBonus??0))))} HP`}`;}
    const sk=skillFor(pending);const affected=sk.target==='enemies'?targets:[selected];
    const text=sk.power?affected.map(t=>`${t.name}：預估 ${estimateDamage(active,t,sk)*(sk.hits??1)} 傷害${({fire:'moon',moon:'fire',earth:'wind',wind:'earth',light:'shadow',shadow:'light'} as Record<string,string>)[sk.element??'none']===t.element?' · 屬性優勢 ×1.5':''}`).join('／'):sk.heal?`恢復 ${Math.min(selected.stats.maxHp-selected.hp,Math.round(active.stats.healing*sk.heal))} HP`:describe(sk);
    return `${text}${sk.power?'（一般命中，未暴擊，護盾前）':''}`;
  }
  function orderPreview() {
    if(!battle||!pending||!selected||pending.type!=='skill')return '';
    const sk:Skill=skills[pending.skill];const slow=sk.effects?.find(e=>e.status==='slow');
    if(!slow&&!sk.knockback)return '';
    let queue=[...battle.queue];
    if(slow){queue=queue.sort((x,y)=>{const value=(id:string)=>{const u=battle.units.find(t=>t.id===id)!;return id===selected.id?u.stats.speed*(u.statuses.haste?1:.75):speed(u);};return value(y)-value(x);});}
    else {const i=queue.indexOf(selected.id);if(i>=0&&i<queue.length-1)[queue[i],queue[i+1]]=[queue[i+1],queue[i]];}
    return `${sk.knockback?'擊退成功時':slow?.chance?'緩速成功時':'施放後'}剩餘順序：${queue.map(id=>battle.units.find(u=>u.id===id)!.name).join(' → ')||'本回合已無其他行動'}`;
  }
  useEffect(()=>{const w=window as unknown as {render_game_to_text:()=>string;advanceTime:(ms:number)=>void};w.render_game_to_text=()=>JSON.stringify({mode:!battle?'selection':battle.outcome,team,encounter:session?.name??encounters[encounter].name,active:battle?.active,queue:battle?.queue,round:battle?.round,pending,busy,units:battle?.units.map(u=>({id:u.id,name:u.name,side:u.side,hp:u.hp,mp:u.mp,statuses:u.statuses,boss:u.boss,intent:(u.ai||u.boss)&&u.hp>0?(u.boss?bossIntent(battle,u):enemyIntent(battle,u)):undefined})),supplies:battle?.supplies,coordinates:'DOM layout; origin top-left, x right, y down'});w.advanceTime=(ms)=>{if(ms<=0)return;if(busy){setBusy(false);setMotion(null);}else stepEnemy();};return()=>{delete (window as unknown as Record<string,unknown>).render_game_to_text;delete (window as unknown as Record<string,unknown>).advanceTime;};});
  useEffect(()=>{function key(e:KeyboardEvent){if(e.key==='Escape'){setPending(null);setBag(false);}if(e.key==='f'&&!e.ctrlKey){if(document.fullscreenElement)void document.exitFullscreen();else void root.current?.requestFullscreen();}if(e.key.startsWith('Arrow')){const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]).filter(b=>b.offsetParent!==null);const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();e.preventDefault();}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  function statusView(u: Unit) {return <div className="status-list">{u.defending&&<button onClick={()=>setMessage('防禦：直接傷害減少 50%，至下次自身行動開始。')}>防禦</button>}{Object.entries(u.statuses).map(([id,s])=>{const description=`${u.name}・${names[id as StatusId]}：${statusDetails[id as StatusId]}；${id==='shield'?`可吸收 ${s.amount} 傷害；`:''}剩餘 ${s.turns} 次自身行動`;return <button key={id} title={description} onClick={()=>setMessage(description)}>{names[id as StatusId]} {id==='shield'?s.amount:s.turns}</button>;})}</div>;}
  return <main ref={root} className="adventure">
    <header className="adventure-top"><Link to="/">OLLIE LITTLE GAMES</Link><span>森林冒險 · 戰鬥篇</span><button onClick={()=>setFast(!fast)}>動畫 {fast?'快速':'一般'}</button></header>
    {!battle?<>
      <div className="selection-title"><p className="eyebrow">CHAPTER 01 / THE UNLIT FOREST</p><h1>熄燈森林</h1><p>選擇三位旅人，找回林間的微光。</p></div>
      <div className="selection-layout"><section className="class-grid" aria-label="六職業選擇">{ids.map((id,i)=>{const chosen=team.find(t=>t.id===id);return <button key={id} className={`class-card ${chosen?'chosen':''} ${focus===id?'focused':''}`} onClick={()=>toggle(id)} aria-pressed={!!chosen} data-testid={`class-${id}`}><span className="class-number">0{i+1} / {elements[classes[id].element]}</span><img src={`/characters/animations/hd/chibi/${id}_${genders[id]??'female'}/idle-0.png`} alt={classes[id].name}/><strong>{classes[id].name}</strong><small>{roles[i]}</small><span className="pick-tag">{chosen?`✓ 隊員 ${team.indexOf(chosen)+1}`:team.length===3?'點選查看':'＋ 加入隊伍'}</span></button>;})}</section>
      <aside className="party-panel"><p className="eyebrow">YOUR PARTY</p><h2>同行的旅人 <span>{team.length} / 3</span></h2><p className="muted">任何三個職業都能冒險。</p><div className="party-slots">{[0,1,2].map(i=><button key={i} onClick={()=>team[i]&&toggle(team[i].id)}>{team[i]?<><img src={`/characters/animations/hd/chibi/${team[i].id}_${team[i].gender}/idle-0.png`} alt=""/><span>{classes[team[i].id].name}</span><small>移除 ×</small></>:<span>＋ 第 {i+1} 位</span>}</button>)}</div>
      <button className="text-button" onClick={()=>setTeam((['ember_knight','moon_witch','sun_cleric'] as ClassId[]).map(id=>({id,gender:genders[id]??'female'})))}>幫我選一隊</button>
      <div className="class-detail"><h3>{classes[focus].name}</h3><div className="gender-toggle">{(['female','male'] as const).map(g=><button key={g} aria-pressed={(genders[focus]??'female')===g} onClick={()=>{setGenders({...genders,[focus]:g});setTeam(team.map(t=>t.id===focus?{...t,gender:g}:t));}}>{g==='female'?'女性造型':'男性造型'}</button>)}</div>{classes[focus].skills.map(id=><p key={id}><b>{skills[id].name} <small>{skills[id].mp} MP</small></b><span>{describe(skills[id])}</span></p>)}</div>
      <label className="encounter-label">前往哪一場遭遇？<select value={encounter} onChange={e=>setEncounter(Number(e.target.value))}>{encounters.map((e,i)=><option key={e.name} value={i}>{e.name} · {e.subtitle}</option>)}</select></label><button id="start-btn" className="primary" disabled={team.length!==3} onClick={()=>start()}>三人集結，出發 →</button></aside></div>
    </>:<>
      <div className="battle-heading"><div><p className="eyebrow">{encounters[encounter].subtitle}</p><h1>{session?.name??encounters[encounter].name}</h1></div>{!session&&<button onClick={()=>{setBattle(null);setBusy(false);setPending(null);}}>返回選隊</button>}</div>
      {boss&&<aside className={`boss-banner ${boss.boss?.stage==='blast'?'charging':''}`} aria-live="polite"><div><b>蝕光樹靈 · 第 {boss.boss?.phase===1?'一':'二'} 階段</b><p>{boss.boss?.stage==='blast'?'下次行動：蝕光爆發 · 全體攻擊':boss.statuses.break?'枝核外露 · 破防至下次行動結束':bossIntent(battle!,boss).detail}</p></div>{boss.boss?.stage==='blast'?<div className="boss-shield"><label>蓄勢護盾 {boss.statuses.shield?.amount??0} / 60</label><meter min="0" max="60" value={boss.statuses.shield?.amount??0}/><small>擊碎或驅散護盾、沉默可中斷；也可以防禦承受爆發。</small></div>:<small>{boss.boss?.phase===2?'根鬚會攻擊兩名旅人，蓄勢節奏不變。':'半血後進入第二階段，不會額外行動。'}</small>}</aside>}
      <nav className="turn-order" aria-label="行動順序"><b>回合 {battle.round}</b>{[...battle.spent,...(battle.active?[battle.active]:[]),...battle.queue].map(id=>{const u=battle.units.find(x=>x.id===id)!;return <div key={id} className={`${battle.spent.includes(id)?'spent':''} ${id===battle.active?'current':''}`}><img src={asset(u).replace('idle.gif','idle-0.png')} alt=""/><span>{u.name}<small>{id===battle.active?'正在行動':battle.spent.includes(id)?'已行動':u.hp<=0?'倒下':'等待'}</small></span></div>;})}</nav>
      <section className="battle-stage" aria-label="戰鬥場景"><Forest/><div className="stage-light"/><div className="combatants">{(['party','enemy'] as const).map(side=><div key={side} className={`battle-side ${side}`}>{battle.units.filter(u=>u.side===side).map(u=>{const intent=(u.ai||u.boss)&&u.hp>0?(u.boss?bossIntent(battle,u):enemyIntent(battle,u)):null;const targetable=playable&&pending&&targets.some(t=>t.id===u.id);const all=pending?.type==='skill'&&skills[pending.skill].target==='enemies';const highlight=targetable&&(all||selected?.id===u.id||pending?.type==='defend');const action=u.hp<=0?'fall':motion?.actor===u.id?motion.action:(motion?.delta[u.id]??0)<0?'hurt':u.defending?'block':'idle';return <div key={u.id} className={`unit-wrap ${u.boss?`boss-unit phase-${u.boss.phase}`:''} ${u.hp<=0?'fallen':''}`}>
      {intent&&<div className={`intent ${intent.heavy?'danger':''}`} title={intent.detail}><strong>{intent.skill.name}</strong><span>{u.boss?intent.detail:intent.skill.target==='self'?intent.detail:`→ ${battle.units.find(t=>t.id===intent.target)?.name??'無目標'}`}</span></div>}
      <button data-testid={`unit-${u.id}`} className={`unit ${highlight?'targeted':''} ${u.id===battle.active?'acting':''}`} aria-label={`選擇${u.name}`} aria-pressed={!!highlight} disabled={!targetable||all} onClick={()=>pending&&pending.type!=='defend'&&setPending({...pending,target:u.id})}><img key={`${action}-${motion?.actor}`} src={asset(u,action)} alt={u.name}/>{motion?.delta[u.id]!==undefined&&motion.delta[u.id]!==0&&<em className={motion.delta[u.id]>0?'heal-number':'damage-number'}>{motion.delta[u.id]>0?'+':''}{motion.delta[u.id]}</em>}</button><div className="unit-label"><b>{u.name}</b><small>{elements[u.element]}屬性</small></div><meter min="0" max={u.stats.maxHp} value={u.hp} aria-label={`${u.name} HP`}/><small className="hp-text">{u.hp} / {u.stats.maxHp}</small>{statusView(u)}</div>;})}</div>)}</div></section>
      <p className="battle-message" role="status">{message}</p>
      {battle.outcome==='ongoing'?<section className="battle-console"><div className="party-stats">{battle.units.filter(u=>u.side==='party').map(u=><div key={u.id} className={active?.id===u.id?'current':''}><b>{u.name}</b><span>HP {u.hp} / {u.stats.maxHp}</span><span>MP {u.mp} / {u.stats.maxMp}</span></div>)}</div><div className="command-area"><div className="command-caption"><b>{busy?'行動演出中…':active?.side==='enemy'?'敵人正在行動…':`輪到 ${active?.name}`}</b><small>方向鍵選擇 · Enter 操作 · Esc 取消</small></div><div className="commands"><button disabled={!playable} onClick={()=>choose({type:'attack',target:''})}>普通攻擊<small>不消耗 MP</small></button>{(active?.side==='party'?active.skills:[]).map(id=><button key={id} title={describe(skills[id])} disabled={!playable||active!.mp<skills[id].mp||!!active!.statuses.silence} onClick={()=>choose({type:'skill',skill:id})}>{skills[id].name}<small>{skills[id].mp} MP</small></button>)}<button disabled={!playable} onClick={()=>choose({type:'defend'})}>防禦<small>傷害 −50%</small></button><button disabled={!playable} onClick={()=>{setBag(!bag);setPending(null);}}>道具<small>共用補給</small></button></div>{bag&&<div className="item-list">{(['heal','revive','cleanse'] as Item[]).map(i=><button key={i} disabled={!playable||battle.supplies[i]+battle.reserve[i]===0} onClick={()=>choose({type:'item',item:i,target:''})}>{itemNames[i]} · 補給 {battle.supplies[i]}／備用 {battle.reserve[i]}</button>)}</div>}<div className="preview" aria-live="polite"><p>{preview()}</p>{pending?.type==='skill'&&<small>{describe(skills[pending.skill])}</small>}{orderPreview()&&<small className="order-preview">{orderPreview()}</small>}{error&&<p role="alert">{error}</p>}<div className="confirm-row">{pending&&<><button onClick={()=>setPending(null)}>取消</button><button className="primary" disabled={!playable||!targets.length} onClick={confirm}>確認施放{selected?` → ${selected.name}`:''}</button></>}</div></div></div></section>:!busy&&<section className="result-panel"><p className="eyebrow">{battle.outcome==='victory'?'ENCOUNTER COMPLETE':'TRY ANOTHER TACTIC'}</p><h2>{battle.outcome==='victory'?'林間又恢復了平靜。':'旅人們，休息一下再出發。'}</h2><p>{battle.outcome==='victory'?`戰後恢復：${settleVictory(battle).map(u=>`${u.name} ${u.hp} HP`).join(' · ')}。MP 已回滿。`:'重新挑戰會補滿全隊 HP、MP 與道具。試試防禦、控制或優先擊倒一名敵人。'}</p>{session?<button className="primary" onClick={session.onReturn}>返回森林 →</button>:<><button onClick={()=>start()}>再試一次</button>{encounter<encounters.length-1&&battle.outcome==='victory'&&<button className="primary" onClick={()=>{setEncounter(encounter+1);start(encounter+1);}}>下一場遭遇 →</button>}<button onClick={()=>setBattle(null)}>換一支隊伍</button><small>原型各場獨立開始，補滿全隊狀態；探索與存檔將在後續加入。</small></>}</section>}
    </>}
    <footer className="adventure-footer"><span>熄燈森林 / 六位旅人的第一段冒險</span><span>F 全螢幕 · 無操作時間限制</span></footer>
  </main>;
}
