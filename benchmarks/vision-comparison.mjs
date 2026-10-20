// Measurement only. prepare uses Chrome solely for exact Canvas bytes; run is Node-only.
// node --env-file=.env.local benchmarks/vision-comparison.mjs prepare|freeze|run|report [--v2|--v3]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..')
const v3 = process.argv.includes('--v3')
const v2 = process.argv.includes('--v2') || v3
const suffix = v3 ? '-v3' : '-v2'
const versioned = name => v2 && name !== 'vision-comparison-images.json' && /^(frozen-criteria|vision-comparison-(?:freeze-attempt|results|summary|report))\./.test(name) ? name.replace(/(\.[^.]+)$/, suffix+'$1') : name
const path = name => resolve(root, 'benchmarks', versioned(name))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const read = name => JSON.parse(readFileSync(path(name)))
const save = (name, value) => writeFileSync(path(name), JSON.stringify(value, null, 2) + '\n')
const hash = value => createHash('sha256').update(value).digest('hex')
const truth = read('ground-truth.json')
const localModel = 'qwen3-vl:2b-instruct', cloudModel = 'gemini-flash-lite-latest'
const encoder = readFileSync(resolve(root, 'src/lib/thumbnail.js'), 'utf8')
const source = readFileSync(resolve(root, 'src/lib/ollama.js'), 'utf8')
const lib = await import('data:text/javascript;base64,' + Buffer.from(source.replace("'./mock'", JSON.stringify(pathToFileURL(resolve(root, 'src/lib/mock.js')).href)).replace("'./models'", JSON.stringify(pathToFileURL(resolve(root, 'src/lib/models.js')).href))).toString('base64'))
const command = process.argv[2]
function assertQuiet() {
 const processes = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' })
 if (/Google Chrome|\/vite(?:\s|$)/m.test(processes)) throw new Error('Stop Chrome and Vite before inference')
 // Vite is commonly listed as node; check its default listener as well.
 try { if (execFileSync('lsof', ['-t', '-iTCP:5173', '-sTCP:LISTEN'], {encoding:'utf8'}).trim()) throw new Error('Port 5173 is listening') } catch(e) { if(e.status !== 1) throw e }
}
if (command === 'prepare') {
 if (existsSync(path('vision-comparison-images.json'))) throw new Error('Image cache already exists')
 const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/jcazares/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
 const browser = await chromium.launch({ headless: true, channel: 'chrome' })
 const images = {}
 try {
  const page = await browser.newPage()
  for (const {file} of truth.photos) {
   const bytes = readFileSync(resolve(root, 'applicability_probe', file))
   const encoded = await page.evaluate(async ({bytes, encoder, file}) => {
    const {encodeForModel} = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(encoder))
    const blob = await fetch('data:image/jpeg;base64,' + bytes).then(r=>r.blob())
    const base64 = await encodeForModel(new File([blob], file, {type:'image/jpeg'}))
    const bitmap = await createImageBitmap(await fetch('data:image/jpeg;base64,' + base64).then(r=>r.blob()))
    const dimensions = [bitmap.width, bitmap.height]; bitmap.close()
    return {base64, dimensions}
   }, {bytes:bytes.toString('base64'), encoder, file})
   images[file] = {...encoded, originalHash:hash(bytes), encodedHash:hash(Buffer.from(encoded.base64,'base64'))}
   console.log('Encoded', file, encoded.dimensions)
  }
 } finally { await browser.close() }
 save('vision-comparison-images.json', {encoderHash:hash(encoder), images})
} else if (command === 'freeze') {
 assertQuiet()
 if (existsSync(path('frozen-criteria.json'))) throw new Error('Frozen criteria already exist; never regenerate')
 if (existsSync(path('vision-comparison-freeze-attempt.json'))) throw new Error('Criteria already attempted; inspect before any retry')
 save('vision-comparison-freeze-attempt.json', {at:new Date().toISOString(),taste:truth.tasteString,sourceHash:hash(source)})
 let rawData, criteriaRequest
 const nativeFetch=globalThis.fetch
 try {
  globalThis.fetch=async(url,init)=>{
   const response=await nativeFetch(url,init)
   if(url.endsWith('/evaluate')) {criteriaRequest=JSON.parse(init.body);rawData=await response.clone().json()}
   return response
  }
  const criteria=await lib.buildCullCriteria(truth.tasteString,localModel)
  const attempt={...read('vision-comparison-freeze-attempt.json'),request:criteriaRequest,data:rawData,mapped:criteria}
  save('vision-comparison-freeze-attempt.json',attempt)
  if(v3) {
   const subject=JSON.parse(rawData.response).subject
   if(subject?.named!==true || criteria[0]?.signal!==subject.signal || criteria[0]?.description!==subject.description || criteria[0]?.weight!=='high') throw new Error('Subject gate failed; do not regenerate')
  }
  save('frozen-criteria.json', criteria)
 } finally {globalThis.fetch=nativeFetch} 
 await lib.unloadCriteriaModel()
} else if (command === 'run') {
 assertQuiet()
 if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required')
 const criteria = read('frozen-criteria.json'), cache = read('vision-comparison-images.json')
 if(cache.encoderHash !== hash(encoder)) throw new Error('Encoder changed')
 for(const {file} of truth.photos) if(cache.images[file].originalHash !== hash(readFileSync(resolve(root,'applicability_probe',file)))) throw new Error('Original changed: '+file)
 let template
 const nativeFetch = globalThis.fetch, nativeLog = console.log
 try {
  globalThis.fetch = async (_url, init) => {template=JSON.parse(init.body);return Response.json({response:'{"reason":"Capture only","decision":"cut"}'})}
  console.log = () => {}
  await lib.evaluatePhoto('capture', criteria, 0, [], localModel)
 } finally { globalThis.fetch=nativeFetch;console.log=nativeLog }
 const schema = {...template.format, propertyOrdering:['reason','decision']}
 const cloudConfig = {temperature:0,responseMimeType:'application/json',responseSchema:schema}
 const resultsFile = 'vision-comparison-results.json'
 const metadata = {localModel,cloudModel,criteria,prompt:template.prompt,localTemplate:{...template,images:undefined},cloudConfig,sourceHash:hash(source),encoderHash:hash(encoder),imageHashes:Object.fromEntries(Object.entries(cache.images).map(([k,v])=>[k,{dimensions:v.dimensions,sha256:v.encodedHash}]))}
 const report = existsSync(path(resultsFile)) ? read(resultsFile) : {metadata,startedAt:new Date().toISOString(),calls:[]}
 if(JSON.stringify(report.metadata)!==JSON.stringify(metadata)) throw new Error('Inputs differ from checkpoint')
 // Round/photo pairs alternate arm order to reduce systematic timing/order effects.
 for(let run=1;run<=3;run++) for(let i=0;i<truth.photos.length;i++) for(const arm of (run+i)%2 ? ['local','cloud'] : ['cloud','local']) {
  const {file}=truth.photos[i]
  if(report.calls.some(c=>c.run===run&&c.file===file&&c.arm===arm)) continue
  assertQuiet()
  const base64=cache.images[file].base64
  const body=arm==='local' ? {...template,images:[base64]} : {contents:[{role:'user',parts:[{inline_data:{mime_type:'image/jpeg',data:base64}},{text:template.prompt}]}],generationConfig:cloudConfig}
  const url=arm==='local' ? 'http://localhost:3001/evaluate' : `https://generativelanguage.googleapis.com/v1beta/models/${cloudModel}:generateContent`
  const headers={'Content-Type':'application/json',...(arm==='cloud'?{'x-goog-api-key':process.env.GEMINI_API_KEY}:{})}
  const row={run,file,arm,retries:0,retryAttempts:[],startedAt:new Date().toISOString()}; let start
  try {
   let response
   for (;;) {
    if(v2 && arm==='cloud') await sleep(1000)
    start=performance.now()
    response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(90000)})
    row.status=response.status; row.data=await response.json(); row.elapsedMs=Math.round(performance.now()-start)
    if(!(v2 && arm==='cloud' && response.status===429 && row.data.error?.status==='RESOURCE_EXHAUSTED')) break
    const retryInfo=row.data.error.details?.find(d=>d['@type']?.endsWith('RetryInfo'))
    const retrySeconds=parseFloat(retryInfo?.retryDelay??'0')
    const retryHeader=response.headers.get('retry-after')
    const headerMs=retryHeader ? (/^\d+(?:\.\d+)?$/.test(retryHeader)?Number(retryHeader)*1000:Math.max(0,Date.parse(retryHeader)-Date.now())) : 0
    const backoffMs=Math.max(10000 * 2 ** Math.min(row.retries,5),retrySeconds*1000,headerMs||0)
    row.retries++
    const attempt={run,file,arm,at:new Date().toISOString(),status:429,elapsedMs:row.elapsedMs,backoffMs,data:row.data}
    row.retryAttempts.push(attempt)
    report.rateLimitAttempts??=[];report.rateLimitAttempts.push(attempt);save(resultsFile,report)
    console.log(JSON.stringify({run,file,arm,retry:row.retries,backoffMs}))
    // Short intervals keep progress visible during long server-requested waits.
    for(let remaining=backoffMs;remaining>0;remaining-=Math.min(remaining,30000)) {await sleep(Math.min(remaining,30000));if(remaining>30000) console.log('Waiting for Gemini rate-limit backoff')}
   }
   if(!response.ok) throw new Error('HTTP '+response.status)
   const raw=arm==='local' ? row.data.response : row.data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text??'').join('')
   row.raw=raw
   const match=raw?.replace(/```(?:json)?\s*([\s\S]*?)```/g,'$1').trim().match(/\{[\s\S]*\}/)
   row.result=match ? JSON.parse(match[0]) : null
   if(!['keep','cut'].includes(row.result?.decision)||typeof row.result.reason!=='string') throw new Error('Invalid result contract')
   if(arm==='local') delete row.data.context
  } catch(e) {row.elapsedMs=Math.round(performance.now()-start);row.error=e.message.replaceAll(process.env.GEMINI_API_KEY,'[REDACTED]')}
  report.calls.push(row);save(resultsFile,report)
  console.log(JSON.stringify({run,file,arm,elapsedMs:row.elapsedMs,retries:row.retries,result:row.result,error:row.error}))
  if(row.error && row.status !== 200) throw new Error('Transport/API failure; checkpoint saved for inspection')
 }
 report.finishedAt=new Date().toISOString();save(resultsFile,report)
} else if (command === 'report') {
 const report=read('vision-comparison-results.json')
 if(report.calls.length!==60) throw new Error('Need sixty attempted calls')
 const rows=(arm,file)=>report.calls.filter(c=>c.arm===arm&&c.file===file).sort((a,b)=>a.run-b.run)
 const majority=(arm,file)=>['keep','cut'].find(d=>rows(arm,file).filter(c=>!c.error&&c.result?.decision===d).length>=2)??'unresolved'
 const escape=s=>s.replaceAll('|','\\|').replaceAll('\n',' ')
 const lines=['# Vision comparison','',`Models: ${localModel}; ${cloudModel}. Gemini response versions: ${[...new Set(report.calls.filter(c=>c.arm==='cloud').map(c=>c.data.modelVersion))].join(', ')}.`,'','One criteria generation; exact evaluatePhoto prompt, no constraints; identical Canvas JPEG q0.85, longest edge 768px. Local options unchanged (no explicit seed). Gemini temperature 0 and reason-first responseSchema/propertyOrdering. The frozen array contains three high-weight criteria and one medium-weight criterion. No warmup calls or retries. Local tphoto10 hit the unchanged 120-token cap in all three rounds; no decision was inferred from its reason. Execution paused after the first invalid result, then resumed only the remaining calls. Ollama reported almost complete prompt-cache hits in rounds two and three; latency is a mixture of initial and cached requests, not an uncached throughput estimate. Timings include request/response latency and initial model loading; p95 uses nearest rank. Three interleaved rounds, alternating arm order.','', '| Photo | My label | My note | Local majority | Cloud majority |','|---|---|---|---|---|']
 if(v2) {
  lines[0]=v3?'# Vision comparison v3':'# Vision comparison v2'
  lines[4]='Two source changes: subject-preservation instruction added only to the criteria prompt; local evaluation num_predict raised from 120 to 250. Evaluation prompt, schemas, models, and cached 768px image bytes unchanged. One frozen criteria generation. Three interleaved rounds with alternating arm order. One-second delay before every cloud attempt; 429 RESOURCE_EXHAUSTED retries use backoff and remain one measurement. Latency measures the final request only, excluding pacing and backoff; retry attempts are retained separately. Median and nearest-rank p95 include initial loading and normal cache effects, not uncached throughput.'
  if(v3) lines[4]='Subject-first required object added to criteria schema and prompt; named subjects map to a high-weight first array entry. Evaluation prompt/schema, models, image cache and num_predict=250 unchanged from v2. One criteria generation. Three interleaved rounds with alternating arm order; one-second delay before each cloud attempt, 429 backoff/retry. Timings exclude pacing and backoff, include normal loading/cache effects, and use nearest-rank p95. They are not uncached throughput estimates.'
  const previous=JSON.parse(readFileSync(resolve(root,'benchmarks/frozen-criteria.json')))
  const diff=[...previous.filter(c=>!report.metadata.criteria.some(n=>JSON.stringify(n)===JSON.stringify(c))).map(c=>'- '+JSON.stringify(c)),...report.metadata.criteria.filter(c=>!previous.some(n=>JSON.stringify(n)===JSON.stringify(c))).map(c=>'+ '+JSON.stringify(c))]
  if(v3) lines.splice(5,0,'','## Raw criteria response','','```json',read('vision-comparison-freeze-attempt.json').data.response,'```','')
  lines.splice(5,0,'',v3?'## Frozen criteria v3':'## Frozen criteria v2','','```json',JSON.stringify(report.metadata.criteria,null,2),'```','','Diff against v1 (unchanged entries omitted):','','```diff',...diff,'```','')
 }
 for(const p of truth.photos) lines.push(`| ${p.file} | ${p.label} | ${escape(p.note)} | ${majority('local',p.file)} | ${majority('cloud',p.file)} |`)
 const summary={}
 for(const arm of ['local','cloud']) {
  const calls=report.calls.filter(c=>c.arm===arm), times=calls.map(c=>c.elapsedMs).sort((a,b)=>a-b)
  const categories={}
  for(const category of [...new Set(truth.photos.map(p=>p.category))]) {const photos=truth.photos.filter(p=>p.category===category);categories[category]={correct:photos.filter(p=>majority(arm,p.file)===p.label).length,total:photos.length,kept:photos.filter(p=>majority(arm,p.file)==='keep').length}}
  const consistency=Object.fromEntries(truth.photos.map(p=>[p.file,rows(arm,p.file).every(c=>!c.error)&&new Set(rows(arm,p.file).map(c=>c.result?.decision)).size===1]))
  const usage={}; for(const c of calls) for(const [k,v] of Object.entries(c.data.usageMetadata??{})) if(typeof v==='number') usage[k]=(usage[k]??0)+v
  summary[arm]={majorityCorrect:truth.photos.filter(p=>majority(arm,p.file)===p.label).length,retries:calls.reduce((sum,c)=>sum+(c.retries??0),0),invalidCalls:calls.filter(c=>c.error).length,unresolvedPhotos:truth.photos.filter(p=>majority(arm,p.file)==='unresolved').map(p=>p.file),keepsFound:truth.photos.filter(p=>p.label==='keep'&&majority(arm,p.file)==='keep').length,falseKeeps:truth.photos.filter(p=>p.label==='cut'&&majority(arm,p.file)==='keep').length,selfConsistency:Object.values(consistency).filter(Boolean).length,consistency,categories,medianMs:(times[14]+times[15])/2,p95Ms:times[Math.ceil(times.length*.95)-1],usage,runScores:[1,2,3].map(run=>calls.filter(c=>c.run===run&&c.result?.decision===truth.photos.find(p=>p.file===c.file).label).length)}
  const s=summary[arm]
  lines.push('',`## ${arm}`,'',`1. Keeps found: **${s.keepsFound}/3**.`,`2. False keeps: **${s.falseKeeps}/7**.`,`3. Self-consistency: **${s.selfConsistency}/10**. Per-photo verdicts (runs 1/2/3):`)
  for(const p of truth.photos) lines.push(`   - ${p.file}: ${rows(arm,p.file).map(c=>c.result?.decision??'invalid').join(' / ')} (${consistency[p.file]?'unanimous':rows(arm,p.file).some(c=>c.error)?'invalid response(s)':'mixed'}).`)
  lines.push('4. Per category (majority agreement with labels):')
  for(const [k,v] of Object.entries(categories)) lines.push(`   - ${k}: ${v.correct}/${v.total}; ${v.kept} kept.`)
  lines.push(`5. tphoto1: ${rows(arm,'tphoto1.jpg').map(c=>c.result?.decision??'invalid').join(' / ')}. Full reasons below.`,`6. Median **${s.medianMs} ms**; p95 **${s.p95Ms} ms**. ${arm==='cloud'?'Total Gemini usage: '+JSON.stringify(usage)+'.':'Gemini tokens: not applicable.'}`,``, `429 retries: ${s.retries}. Invalid responses: ${s.invalidCalls}/30; unresolved majorities: ${s.unresolvedPhotos.join(', ')||'none'}. Invalid responses are never counted as cuts or consistent verdicts.`, ``, `Individual run agreement: ${s.runScores.map(v=>v+'/10').join(', ')} (secondary; cut-all baseline is 7/10).`)
 }
 lines.push('','## Full reasons','')
 for(const p of truth.photos.filter(p=>p.file==='tphoto1.jpg'||(v2&&['tphoto4.jpeg','tphoto5.jpeg'].includes(p.file))||majority('local',p.file)!==majority('cloud',p.file)||[1,2,3].some(run=>rows('local',p.file)[run-1].result?.decision!==rows('cloud',p.file)[run-1].result?.decision))) {
  lines.push(`### ${p.file}`,'')
  for(const arm of ['local','cloud']) for(const c of rows(arm,p.file)) lines.push(`- ${arm}, run ${c.run}, **${c.result?.decision??'invalid'}**: ${c.result?.reason??c.raw??c.error}`)
  lines.push('')
 }
 if(v3) {
  const verdicts=(arm,file)=>rows(arm,file).map(c=>c.result?.decision??'invalid').join(' / ')
  const both=['local','cloud']
  const nonportraits=['tphoto8.jpg','tphoto9.jpg','tphoto10.jpg']
  const prediction1=both.every(arm=>nonportraits.every(file=>majority(arm,file)==='cut'))
  const prediction2=both.every(arm=>majority(arm,'tphoto4.jpeg')==='keep')
  const prediction3=majority('local','tphoto5.jpeg')==='cut'&&!summary.cloud.consistency['tphoto5.jpeg']
  lines.push('','## Predictions: observed outcomes first','')
  for(const file of nonportraits) lines.push(`- ${file}: local ${verdicts('local',file)}; cloud ${verdicts('cloud',file)}.`)
  lines.push(`Prediction 1 (nonportrait-warm cuts in both arms): **${prediction1?'held':'failed'}** by majority. V1 local tphoto10 was unresolved, so its transition is from invalid to a verdict, not a literal keep-to-cut flip.`, '', `tphoto4: local ${verdicts('local','tphoto4.jpeg')}; cloud ${verdicts('cloud','tphoto4.jpeg')}. Prediction 2 (false keep in both): **${prediction2?'held':'failed'}**.`, '', `tphoto5: local ${verdicts('local','tphoto5.jpeg')}; cloud ${verdicts('cloud','tphoto5.jpeg')}. Prediction 3 (local correct, cloud unstable): **${prediction3?'held':'failed'}**.`, '', `Majority agreement: local **${summary.local.majorityCorrect}/10**, cloud **${summary.cloud.majorityCorrect}/10**. Prediction 4 expected approximately 9/10 local and 8/10 cloud. Exact point targets: ${summary.local.majorityCorrect===9&&summary.cloud.majorityCorrect===8?'met':'not met'}; both above the 7/10 cut-all baseline: ${summary.local.majorityCorrect>7&&summary.cloud.majorityCorrect>7?'yes':'no'}.`)
  lines.push('','## Criteria-quality observations','', 'Candid expressions: v1 high; v2 medium; v3 medium. Golden-hour lighting and sharp eyes remain high in all three. V3 matches v2 weights for the shared concepts, but weights were not stable across versions. Each version changed the prompt or schema and had only one real criteria generation; this does not establish nondeterminism or repeatability under identical inputs. Snapshot/revert behavior was not changed.', '', 'Sharp eyes: v1 “focused and clear”; v2 and v3 “focused and expressive.” The vague expressive wording persists; no wording repair was made. V3 candid expression also uses “natural, unposed emotion.”', '', 'V3 has one lighting criterion, with no separate golden hour ambiance duplicate. The subject description was generated by the criteria model and mapped verbatim into the first high-weight card. No human-authored portrait description was substituted.')
  const maxOutput=Math.max(...report.calls.filter(c=>c.arm==='local').map(c=>c.data.eval_count??0))
  lines.push('','## Interpretation','', `The data supports a usable local path on this ten-photo set: ${summary.local.keepsFound}/3 keeps found, ${summary.local.falseKeeps}/7 false keeps, ${summary.local.selfConsistency}/10 repeatable verdicts, and ${summary.local.invalidCalls}/30 invalid responses. Cloud adds no majority accuracy here and is less consistent; its measured median latency is lower. This is evidence for retaining the local path, not proof of generalization beyond the labelled set.`, '', 'tphoto4 remains the shared false keep. The local reason explicitly says the lighting is not accurately described as golden hour, then nevertheless keeps the photo. All six tphoto1 verdicts also remain keep, matching the human label while bypassing its sharp-eyes exception. Stable verdicts therefore do not establish fully trustworthy reasons.', '', 'The subject requirement explains the nonportrait cuts in the recorded reasons. However, regenerated criteria also changed weights and visual wording, so improvements elsewhere cannot be attributed solely to the added subject field.', '', `The 250-token cap was retained, and no local responses were invalid. The longest local response was ${maxOutput} tokens, below the old 120-token cap. These runs therefore do not isolate the effect of the cap increase: the subject requirement also shortened the nonportrait reasons.`, '', 'No changes were made after measurement to improve scores. Evaluation logic/schema, models, encoding, cap, UI, snapshot/revert behavior, and queued cleanup remain as specified. Existing contract tests cover named and unnamed subjects, first-position mapping, property order, and invalid subject rejection; they passed. The rate-limit retry branch was not exercised because no 429 responses occurred.')
  const cacheSummary=both.map(arm=>({arm,rounds:[1,2,3].map(run=>({run,cachedPromptTokens:report.calls.filter(c=>c.arm===arm&&c.run===run).reduce((n,c)=>n+(arm==='local'?(c.data.prompt_eval_cached_count??0):(c.data.usageMetadata?.cachedContentTokenCount??0)),0)}))}))
  lines.push('','## Timing caveat','', 'These timings include initial model loading and normal backend caching, with one-second cloud pacing and retry backoff excluded. Exact repeated images/prompts can be cached, so repetition speed is not evidence of fresh-image throughput or cold-start consistency. Reported cached prompt-token totals by round:', '', '```json',JSON.stringify(cacheSummary,null,2),'```')
 }
 save('vision-comparison-summary.json',summary)
 if(!v2) lines.push('', '## Interpretation', '', 'Of the three proposed outcomes, the data supports **neither is reliable under the current one-call approach**. The cloud model found no additional keeps, made more false keeps, and changed verdict on three photos. Local verdicts were stable on nine photos but included three false keeps; the tenth photo failed its output contract every time. This does not support a cloud architecture switch.', '', 'There is also direct evidence of a criteria/prompt problem: the frozen criteria omit an explicit human-portrait requirement, and mandatory sharp eyes conflict with the human exception for tphoto1. Both models kept tphoto1 in all three runs; the local reason explicitly contradicts itself about closed versus focused eyes. Shared failures warrant prompt/criteria investigation, but this experiment does not establish that model perception is blameless or that revised prompts cannot work. It measures the current system, not the ceiling of either model.', '', 'The 3/7 local false-keep count includes only actual majority keeps: tphoto10 is unresolved, not a correct rejection. Nonportrait-warm local results are two false keeps and one unresolved. Self-consistency measures verdicts, not semantic consistency or correctness of explanations. No implementation changes were made; cleanup remains queued in CLAUDE.md.')
 writeFileSync(path('vision-comparison-report.md'),lines.join('\n')+'\n')
 console.log(JSON.stringify(summary,null,2))
} else throw new Error('Use prepare, freeze, run, or report')
