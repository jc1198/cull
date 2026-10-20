// No inference runs in Chrome. Prepare exact Canvas payloads, close Chrome, then run.
// node benchmarks/local-levers.mjs prepare
// node benchmarks/local-levers.mjs run
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root=resolve(import.meta.dirname,'..')
const cache='/tmp/cull-levers-encoded.json'
const output=resolve(root,'benchmarks/local-levers-results.json')
const model='qwen3-vl:2b-instruct', seed=42
const taste='Golden hour portraits with candid expressions and sharp eyes.'
const criteria=JSON.parse(readFileSync(resolve(root,'benchmarks/inference-2026-09-10.json'))).criteriaCheckpoint.reports[0].criteria
const files=readdirSync(resolve(root,'test_photos')).filter(n=>n.endsWith('.jpg')).sort()
const six=['_DSC1403.jpg','_DSC1426.jpg','_DSC1697.jpg','_DSC1701.jpg','_DSC1736.jpg','_DSC1901.jpg']
const encoder=readFileSync(resolve(root,'src/lib/thumbnail.js'),'utf8')
if(process.argv[2]==='prepare') {
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/Users/jcazares/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
 const browser=await chromium.launch({headless:true,channel:'chrome'}), page=await browser.newPage()
 const images={}
 try { for(const name of files){images[name]={};const bytes=readFileSync(resolve(root,'test_photos',name)).toString('base64');for(const edge of [768,512]){
   images[name][edge]=await page.evaluate(async({bytes,source,name})=>{
    const {encodeForModel}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));const blob=await fetch('data:image/jpeg;base64,'+bytes).then(r=>r.blob());const file=new File([blob],name,{type:'image/jpeg'});const base64=await encodeForModel(file);const image=await createImageBitmap(await fetch('data:image/jpeg;base64,'+base64).then(r=>r.blob()));const dimensions=[image.width,image.height];image.close();return{base64,dimensions}
   },{bytes,name,source:edge===768?encoder:encoder.replaceAll('768','512')})
 }console.log('Encoded',name)} }finally{await browser.close()}
 writeFileSync(cache,JSON.stringify({encoderHash:createHash('sha256').update(encoder).digest('hex'),images}))
 console.log('Saved',cache);process.exit(0)
}
const encoded=JSON.parse(readFileSync(cache))
if(encoded.encoderHash!==createHash('sha256').update(encoder).digest('hex'))throw new Error('Encoder changed; prepare again')
const source=readFileSync(resolve(root,'src/lib/ollama.js'),'utf8').replace("'./mock'",JSON.stringify(pathToFileURL(resolve(root,'src/lib/mock.js')).href)).replace("'./models'",JSON.stringify(pathToFileURL(resolve(root,'src/lib/models.js')).href))
const {evaluatePhoto}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
let template;const networkFetch=globalThis.fetch, log=console.log
try{globalThis.fetch=async(url,init)=>{template=JSON.parse(init.body);return Response.json({response:'{"decision":"cut","reason":"Capture only."}'})};console.log=()=>{};await evaluatePhoto('capture',criteria,0,[],model)}finally{globalThis.fetch=networkFetch;console.log=log}
const newSchema={type:'object',properties:{reason:{type:'string'},decision:{type:'string',enum:['keep','cut']}},required:['reason','decision']}
const oldSchema={type:'object',properties:{decision:{type:'string',enum:['keep','cut']},reason:{type:'string'}},required:['decision','reason']}
const oldExample='{"decision": "keep", "reason": "one sentence describing what you see and why it meets or fails the primary requirement"}'
const newExample='{"reason": "one sentence describing what you see and why it meets or fails the primary requirement", "decision": "keep"}'
function payload(name,order,edge,image=true){const schema=order==='old'?oldSchema:newSchema;let prompt=template.prompt.replace(JSON.stringify(template.format),JSON.stringify(schema)).replace(order==='old'?newExample:oldExample,order==='old'?oldExample:newExample);const body={...template,prompt,format:schema,options:{...template.options,seed}};if(image)body.images=[encoded.images[name][edge].base64];else delete body.images;return body}
const report={model,seed,taste,criteria,startedAt:new Date().toISOString(),encoderHash:encoded.encoderHash,six,template:{...template,images:undefined},timing:[],sweep:[],batch:[]}
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n')
async function call(name,order,edge,image=true){const body=payload(name,order,edge,image);const start=performance.now();let data={},status,error,result
 try{const r=await fetch('http://localhost:3001/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});status=r.status;data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));result=JSON.parse(data.response);if(typeof result.reason!=='string'||!['keep','cut'].includes(result.decision))throw new Error('Invalid contract')}catch(e){error=e.message}
 const row={name,order,edge,image,dimensions:image?encoded.images[name][edge].dimensions:undefined,elapsedMs:Math.round(performance.now()-start),status,result,error,data:{...data,context:undefined}};console.log(JSON.stringify(row));return row
}
if(process.argv[2]==='timing') {
 const existing=JSON.parse(readFileSync(output));existing.coldTiming=[]
 for(const image of [true,false]) {
  const r=await fetch('http://localhost:3001/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt:'',stream:false,keep_alive:0}),signal:AbortSignal.timeout(90000)})
  if(!r.ok)throw new Error('Could not unload for uncached timing')
  existing.coldTiming.push(await call(six[0],'new',768,image))
 }
 writeFileSync(output,JSON.stringify(existing,null,2)+'\n');process.exit(0)
}
// Warm model with the same text-only request; exclude this from measured timing.
report.warmup=await call(six[0],'new',768,false);save()
// Image first prevents the text-only comparator warming the image request's prefix.
report.timing.push(await call(six[0],'new',768,true));save()
report.timing.push(await call(six[0],'new',768,false));save()
for(let i=0;i<six.length;i++){for(const order of i%2?['new','old']:['old','new']){report.sweep.push(await call(six[i],order,768));save()}}
const smallStart=performance.now()
for(const name of six){if(performance.now()-smallStart>600000){report.smallSkipped='Ten-minute budget reached';break}report.sweep.push(await call(name,'new',512));save()}
for(const name of files){report.batch.push(await call(name,'new',768));save()}
report.finishedAt=new Date().toISOString();save()
