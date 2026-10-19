import {WIDTH,HEIGHT,TILE,walkable} from './forest-map';
import type {Point} from './forest-map';

const urls={ground:'/environment/storybook/ground.webp',path:'/environment/storybook/path.webp',trees:'/environment/storybook/trees.webp',chest:'/environment/storybook/chest.webp',camp:'/environment/storybook/camp.webp'};
type ArtKey=keyof typeof urls;
/** Cached painted terrain; gameplay still uses the original walkability grid. */
export class ForestArt {
  images=new Map<ArtKey,HTMLImageElement>();
  terrain:HTMLCanvasElement|null=null;
  failed=false;
  constructor(){
    for(const [id,url] of Object.entries(urls)){
      const img=new Image();img.onload=()=>{this.terrain=null;};img.onerror=()=>{this.failed=true;};img.src=url;this.images.set(id as ArtKey,img);
    }
  }
  ready(){return [...this.images.values()].every(img=>img.complete&&img.naturalWidth>0);}
  image(id:ArtKey){const img=this.images.get(id);return img?.complete&&img.naturalWidth?img:null;}
  private texture(ctx:CanvasRenderingContext2D,id:ArtKey,size:number){
    const img=this.image(id);if(!img)return null;const tile=document.createElement('canvas');tile.width=size;tile.height=size;tile.getContext('2d')!.drawImage(img,0,0,size,size);return ctx.createPattern(tile,'repeat');
  }
  private build(){
    if(!this.ready())return null;
    const c=document.createElement('canvas');c.width=WIDTH;c.height=HEIGHT;const ctx=c.getContext('2d')!;
    ctx.fillStyle=this.texture(ctx,'ground',460)??'#6b8454';ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle='#36593d55';ctx.fillRect(0,0,WIDTH,HEIGHT);
    const tree=this.image('trees')!;
    // Canopies are background scenery: roads and characters render over them.
    for(let y=110;y<HEIGHT+180;y+=150)for(let x=40;x<WIDTH+180;x+=190){
      const offset=Math.sin(x*.19+y*.17)*34,px=x+offset,py=y+Math.cos(x)*22;
      if(walkable(px,py)&&walkable(px,py-90))continue;
      const size=200+Math.sin(x+y)*24;ctx.drawImage(tree,px-size/2,py-size,size,size);
    }
    const road=new Path2D();for(let y=0;y<HEIGHT;y+=TILE)for(let x=0;x<WIDTH;x+=TILE)if(walkable(x+20,y+20))road.rect(x,y,TILE,TILE);
    ctx.save();ctx.shadowColor='#3e4d2f88';ctx.shadowBlur=16;ctx.fillStyle='#ae9c6d';ctx.fill(road);ctx.restore();
    const roadLayer=document.createElement('canvas');roadLayer.width=WIDTH;roadLayer.height=HEIGHT;
    const roadCtx=roadLayer.getContext('2d')!;
    roadCtx.fillStyle=this.texture(roadCtx,'path',460)??'#d6bc88';roadCtx.fillRect(0,0,WIDTH,HEIGHT);
    roadCtx.fillStyle='#f0e4bb55';roadCtx.fillRect(0,0,WIDTH,HEIGHT);
    const mask=document.createElement('canvas');mask.width=WIDTH;mask.height=HEIGHT;
    const maskCtx=mask.getContext('2d')!;maskCtx.filter='blur(8px)';maskCtx.fillStyle='white';maskCtx.fill(road);
    roadCtx.globalCompositeOperation='destination-in';roadCtx.drawImage(mask,0,0);ctx.drawImage(roadLayer,0,0);
    // Small irregular grasses soften the tiled collision contour without concealing it.
    for(let y=0;y<HEIGHT;y+=TILE)for(let x=0;x<WIDTH;x+=TILE){if(!walkable(x+20,y+20))continue;
      for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){if(walkable(x+20+dx*TILE,y+20+dy*TILE))continue;
        for(let k=3;k<40;k+=9){const px=dx?x+20+dx*19:x+k,py=dy?y+20+dy*19:y+k;ctx.strokeStyle=k%2?'#7d8a4b88':'#a4ad6499';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+dx*2-2,py+dy*3-4,px+dx*5+2,py+dy*5-6);ctx.stroke();}
      }
    }
    this.terrain=c;return c;
  }
  ground(ctx:CanvasRenderingContext2D,camera:Point,width:number,height:number,restored:boolean){
    const terrain=this.terrain??this.build();ctx.fillStyle='#82956c';ctx.fillRect(camera.x,camera.y,width,height);
    if(terrain)ctx.drawImage(terrain,camera.x,camera.y,width,height,camera.x,camera.y,width,height);
    if(restored){ctx.fillStyle='#ffe59c16';ctx.fillRect(camera.x,camera.y,width,height);}
  }
  chest(ctx:CanvasRenderingContext2D,p:Point,opened:boolean){
    const img=this.image('chest');if(!img)return;const cell=img.naturalWidth/2;
    ctx.drawImage(img,opened?cell:0,0,cell,img.naturalHeight,p.x-43,p.y-72,86,86);
  }
  camp(ctx:CanvasRenderingContext2D,p:Point,time:number,reducedMotion:boolean){
    const img=this.image('camp');if(!img)return;
    const pulse=reducedMotion?1:1+Math.sin(time*3)*.07;
    const light=ctx.createRadialGradient(p.x,p.y-10,8,p.x,p.y-10,68*pulse);light.addColorStop(0,'#ffe29c77');light.addColorStop(1,'#f8cb6b00');ctx.fillStyle=light;ctx.fillRect(p.x-75,p.y-85,150,150);
    ctx.drawImage(img,p.x-48,p.y-84,96,96);
  }
}

export function objectLabel(ctx:CanvasRenderingContext2D,text:string,p:Point){
  ctx.save();ctx.font='11px "Microsoft JhengHei", sans-serif';ctx.textAlign='center';
  const w=ctx.measureText(text).width+16;ctx.fillStyle='#fff8e6e8';ctx.strokeStyle='#b7ac83aa';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(p.x-w/2,p.y+18,w,23,6);ctx.fill();ctx.stroke();ctx.fillStyle='#45533b';ctx.fillText(text,p.x,p.y+34);ctx.restore();
}
