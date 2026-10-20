import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import { makePrioritiesResponse } from './fixtures/priorities.mjs'
const source=readFileSync(new URL('../src/lib/ollama.js',import.meta.url),'utf8').replace("'./mock'",JSON.stringify(new URL('../src/lib/mock.js',import.meta.url).href)).replace("'./models'",JSON.stringify(new URL('../src/lib/models.js',import.meta.url).href))
const {buildCullCriteria,evaluatePhoto,unloadCriteriaModel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const criteria=[{signal:'eyes',weight:'high',description:'Sharp eyes'}]
test('schema responses preserve contracts, options and installed/fallback routing',async()=>{
 const original=globalThis.fetch, warn=console.warn, warnings=[], requests=[];let installed=['qwen3:1.7b'];let raw=JSON.stringify(makePrioritiesResponse({criteria}))
 console.warn=(...args)=>warnings.push(args.join(' '))
 globalThis.fetch=async(url,init)=>{if(url.endsWith('/health'))return Response.json({models:installed});requests.push(JSON.parse(init.body));return Response.json({response:raw})}
 try{
  assert.deepEqual(await buildCullCriteria('eyes','llava:7b'),criteria)
  assert.equal(warnings.length,0);assert.equal(requests[0].model,'qwen3:1.7b');assert.deepEqual(requests[0].options,{num_predict:600,temperature:0,num_ctx:2048});assert.equal(requests[0].keep_alive,'5m');assert.equal(requests[0].think,false);assert.equal(requests[0].images,undefined);assert.equal(requests[0].format.properties.criteria.maxItems,6)
  installed=['llava:7b'];raw=JSON.stringify(makePrioritiesResponse({criteria:[[...criteria]]}))
  assert.deepEqual(await buildCullCriteria('eyes','llava:7b'),criteria);assert.equal(requests[1].model,'llava:7b');assert.ok(warnings.some(s=>s.includes('qwen3:1.7b')));assert.ok(warnings.some(s=>s.includes('nested array')))
  raw=JSON.stringify({decision:'keep',reason:'Sharp eyes.'});assert.deepEqual(await evaluatePhoto('data:image/jpeg;base64,abc',criteria,0,[],'llava:7b'),JSON.parse(raw));const req=requests.at(-1);assert.deepEqual(req.images,['abc']);assert.deepEqual(req.options,{num_predict:250,temperature:0,num_ctx:4096});assert.equal(req.format.properties.reason.type,'string');assert.equal(req.keep_alive,'10m')
  raw='keep this photo';await assert.rejects(()=>evaluatePhoto('abc',criteria,0,[],'llava:7b'),/did not return a decision/)
  raw=JSON.stringify({decision:'keep',reason:['wrong type']});await assert.rejects(()=>evaluatePhoto('abc',criteria,0,[],'llava:7b'),/did not return a decision/)
  raw='invalid';await assert.rejects(()=>buildCullCriteria('eyes','llava:7b'),/did not return usable priorities/)
  await unloadCriteriaModel();assert.deepEqual(requests.at(-1),{model:'qwen3:1.7b',prompt:'',stream:false,keep_alive:0})
  globalThis.fetch=()=>{throw new Error('Demo must not fetch')};assert.ok(Array.isArray(await buildCullCriteria('eyes','demo')));assert.equal(typeof(await evaluatePhoto('',criteria,0,[],'demo')).reason,'string')
 }finally{globalThis.fetch=original;console.warn=warn}
})

test('subject-first schema maps named subjects without changing array entries',async()=>{
 const original=globalThis.fetch;let request
 const subject={named:true,signal:'portrait',description:'A person is visible in the photo'}
 let response=makePrioritiesResponse({subject,criteria})
 globalThis.fetch=async(url,init)=>{if(url.endsWith('/health'))return Response.json({models:['qwen3:1.7b']});request=JSON.parse(init.body);return Response.json({response:JSON.stringify(response)})}
 try {
  assert.deepEqual(await buildCullCriteria('portraits','llava:7b'),[{signal:subject.signal,weight:'high',description:subject.description},...criteria])
  assert.deepEqual(Object.keys(request.format.properties),['subject','criteria'])
  assert.deepEqual(request.format.required,['subject','criteria'])
  assert.deepEqual(request.format.properties.subject.required,['named','signal','description'])
  // No named subject means no prepended card; the criteria array is valid as-is.
  response=makePrioritiesResponse({criteria});assert.deepEqual(await buildCullCriteria('sharp eyes','llava:7b'),criteria)
  for(const invalid of [undefined,{...subject,named:'true'},{...subject,signal:''},{...subject,description:null}]) {
   response=makePrioritiesResponse({subject:invalid,criteria})
   await assert.rejects(()=>buildCullCriteria('portraits','llava:7b'),/invalid subject/)
  }
 } finally {globalThis.fetch=original}
})
