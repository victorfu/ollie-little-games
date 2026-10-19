export type Point = {x:number;y:number};
export const TILE=40, WIDTH=2400, HEIGHT=960;
export const entrance={x:160,y:420},monster={x:440,y:420},chest={x:740,y:260},camp={x:1040,y:420};
export const encounters:Record<string,{name:string;position:Point;kinds:('slime'|'rock'|'boss')[];optional?:boolean;manual?:boolean}>={
  'trail-slime':{name:'月露小徑',position:monster,kinds:['slime']},
  'slime-branch':{name:'林間岔路',position:{x:620,y:260},kinds:['slime','slime'],optional:true},
  'fallen-rock':{name:'倒木空地',position:{x:880,y:420},kinds:['rock']},
  'stone-path':{name:'石根步道',position:{x:1480,y:420},kinds:['slime','rock']},
  'rock-branch':{name:'苔岩支線',position:{x:1740,y:700},kinds:['rock','rock'],optional:true},
  'treant':{name:'樹靈盤踞之地',position:{x:2280,y:420},kinds:['boss'],manual:true},
};
export const camps=[{id:'old-camp',name:'舊營地',position:camp},{id:'forecourt',name:'樹靈前庭',position:{x:2080,y:420}}];
export const treasures:Record<string,{name:string;detail:string}>={
  'moss-charm':{name:'苔紋護符',detail:'最大 HP ＋10%'},
  'medicine-kit':{name:'旅人藥盒',detail:'持有者使用治療藥，額外恢復目標最大 HP 的 10%'},
  'dew-pendant':{name:'晨露墜飾',detail:'每場戰鬥開始獲得最大 HP 10% 護盾，持續 2 次自身行動'},
};
export const chests=[{id:'trail-chest',name:'林間寶箱',position:chest,treasure:'moss-charm',guard:'slime-branch'},
  {id:'traveler-pack',name:'舊旅人背包',position:{x:1900,y:700},treasure:'medicine-kit',guard:'rock-branch'}];
export const notes=[{id:'camp-note',name:'旅人的短箋',position:{x:1160,y:500},text:'今晚的火仍溫暖。若你在林中受了傷，就回來坐坐。北面的岔路藏著一只寶箱，東南的苔岩後還留著我的藥盒。願這些小東西能陪你走遠一點。'},
  {id:'boss-note',name:'被侵蝕的告示',position:{x:2120,y:540},text:'樹靈吞光時，擊碎包住樹心的光殼，就能阻止爆發。來不及打破，就先防禦；光散去之後，枝核會露出破綻。最後一盞營火就在身後，準備好了再走進去。'}];
export const objects=[...camps.map(o=>({...o,type:'camp' as const})),...chests.map(o=>({...o,type:'chest' as const})),...notes.map(o=>({...o,type:'note' as const})),{id:'treant',name:'進入樹靈盤踞之地',position:encounters.treant.position,type:'boss' as const}];
export function walkable(x:number,y:number):boolean {
  const c=Math.floor(x/TILE),r=Math.floor(y/TILE);
  if(c<1||c>=59||r<1||r>=23)return false;
  if([11,22,37].includes(c))return r===10;
  return (r>=8&&r<=12)||(c>=14&&c<=20&&r>=5&&r<=12)||(c>=41&&c<=49&&r>=10&&r<=18)||(c>=50&&c<=54&&r>=10&&r<=14);
}
export function route(from:Point,to:Point):Point[] {
  if(!walkable(to.x,to.y))return [];
  const key=(x:number,y:number)=>`${x},${y}`;
  const start:[number,number]=[Math.floor(from.x/TILE),Math.floor(from.y/TILE)],end:[number,number]=[Math.floor(to.x/TILE),Math.floor(to.y/TILE)];
  const queue=[start],parents=new Map<string,string|null>([[key(...start),null]]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];if(x===end[0]&&y===end[1])break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(walkable(nx*TILE+20,ny*TILE+20)&&!parents.has(k)){parents.set(k,key(x,y));queue.push([nx,ny]);}}
  }
  let cursor:string|null=key(...end);if(!parents.has(cursor))return [];
  const path:Point[]=[];while(cursor){const [x,y]=cursor.split(',').map(Number);path.unshift({x:x*TILE+20,y:y*TILE+20});cursor=parents.get(cursor)??null;}
  return [...path.slice(1),to];
}
