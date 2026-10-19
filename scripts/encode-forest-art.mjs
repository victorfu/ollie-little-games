// Packaging only: preserve dimensions and alpha; encode generated PNG masters as WebP.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage();
await mkdir('assets/environment/storybook',{recursive:true});
const manifest={generator:'Codex built-in imagegen',requestedModel:'GPT-Image2',reportedModel:null,encoding:'WebP quality 90; original dimensions and alpha preserved',assets:[]};
try{for(const id of ['ground','path','trees','chest','camp']){
  const master=`assets/environment/storybook/${id}.png`,runtime=`public/environment/storybook/${id}.webp`;
  let bytes;try{bytes=await readFile(master);}catch{bytes=await readFile(`public/environment/storybook/${id}.png`);await rename(`public/environment/storybook/${id}.png`,master);}
  const result=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const alpha=ctx.getImageData(0,0,1,1).data[3];return {width:c.width,height:c.height,cornerAlpha:alpha,url:c.toDataURL('image/webp',.9)};},`data:image/png;base64,${bytes.toString('base64')}`);
  const output=Buffer.from(result.url.split(',')[1],'base64');await writeFile(runtime,output);
  manifest.assets.push({id,master,runtime,width:result.width,height:result.height,cornerAlpha:result.cornerAlpha,sourceSha256:createHash('sha256').update(bytes).digest('hex'),bytes:output.length});
}}
finally{await browser.close();}
await writeFile('assets/environment/storybook/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(manifest.assets);
