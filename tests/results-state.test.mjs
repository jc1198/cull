import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { selectExportSet, browserPhotoSource, runExport } from '../src/lib/export/index.js'
import { MemoryExportWriter } from './fixtures/exportWriter.mjs'
import { syntheticNef } from './fixtures/rawTiff.mjs'

// Render App's actual handlers with lightweight hooks; no DOM or inference server needed.
let harnessId = 0
async function appHarness(inputFiles, { run = true } = {}) {
  const bundled = await build({
    entryPoints: ['src/App.jsx'], bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'state-harness', setup(builder) {
      builder.onResolve({ filter: /^\//, namespace: 'fixture' }, (args) => ({ path: args.path, namespace: 'file' }))
      builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }))
      builder.onResolve({ filter: /rawPreview$/ }, () => ({ path: `${process.cwd()}/src/lib/rawPreview.js`, namespace: 'file' }))
      builder.onResolve({ filter: /^\.\// }, (args) => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
        if (path === 'react') return { contents: `
          export const slots=[]; let cursor=0; let effects=[];
          useState.begin=()=>{cursor=0}; useState.flush=()=>{const pending=effects;effects=[];pending.forEach(fn=>fn())};
          export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]}
          export function useRef(value){return useState(()=>({current:value}))[0]}
          export const useEffect=fn=>{effects.push(fn)},useLayoutEffect=()=>{},useCallback=fn=>fn;
          export default {createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment'};
        ` }
        if (path.endsWith('/models')) return { contents: `export const CRITERIA_MODEL='criteria',DEMO_MODEL='demo',MODEL_STORAGE_KEY='model';export const readSavedModel=()=> 'demo',prioritiesAreStale=()=>false;` }
        if (path.endsWith('/ollama')) return { contents: `import {mockBuildCullCriteria,mockEvaluatePhoto} from '${process.cwd()}/src/lib/mock.js'; export const buildCullCriteria=mockBuildCullCriteria,evaluatePhoto=(_bytes,_criteria,index)=>mockEvaluatePhoto(index),unloadCriteriaModel=async()=>{};` }
        if (path.endsWith('/thumbnail')) return { contents: `export const makeThumbnail=async(photo)=> /\\.nef$/i.test(photo.name) && !photo.previewRange ? null : 'thumb',encodeForModel=async()=>{throw Error('Demo must not encode')};` }
        if (path.includes('/hooks/')) return { contents: `export default ()=>({health:{models:[]},refresh:()=>{},markOffline:()=>{}});` }
        return { contents: `export default '${path}';export const StepLabel='StepLabel',StatusLabel='StatusLabel',ConsoleLink='ConsoleLink',PrimaryButton='PrimaryButton',SecondaryButton='SecondaryButton',TextLink='TextLink';` }
      })
    }}],
  })
  // JSX uses React.createElement with this build; import the same fixture hooks.
  let code = bundled.outputFiles[0].text
  code = code.replace('export {', 'export { useState,')
  // The application uses Vite's automatic JSX runtime; supply its classic equivalent here.
  code = 'const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:"fragment"};\n' + code
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${harnessId++}`)
  function render() { module.useState.begin(); const tree=module.default(); module.useState.flush(); return tree }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null
    if (predicate(node)) return node
    for (const value of Object.values(node.props || {})) {
      for (const child of Array.isArray(value) ? value.flat(Infinity) : [value]) {
        const found = find(child, predicate)
        if (found) return found
      }
    }
    return null
  }
  const component = (suffix) => find(render(), (node) => String(node.type).endsWith(suffix))
  const button = (label) => find(render(), (node) => node.props?.children?.includes(label))
  await find(render(), (node) => node.type === 'input').props.onChange({ target: { files: inputFiles || [
    new File([new Uint8Array([1, 0, 255])], 'one.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array([2, 0, 255])], 'two.jpg', { type: 'image/jpeg' }),
  ] } })
  if (!run) return { component, button, render, find }
  component('/TasteInput').props.onChange('Warm light')
  await button('Show priorities').props.onClick()
  await find(render(), (node) => node.type === 'PrimaryButton' && node.props.children[0]?.startsWith('Run Cull')).props.onClick()
  return { component, button, render }
}

test('actual App: stars survive moves and a re-run from step 2; first keep is selected', async () => {
  const app = await appHarness()
  let view = app.component('/ResultsView').props
  const id = view.selectedId
  view.onStar(id)
  app.component('/ResultsView').props.onMove(id)
  view = app.component('/ResultsView').props
  assert.equal(view.starredIds.has(id), true)
  assert.equal(view.results.find((entry) => entry.photo.id === id).decision, 'cut')
  app.button('Back to set taste').props.onClick()
  // Starting a fresh run replaces results, while stars stay outside that state.
  const tree = app.render()
  function runButton(node) {
    if (!node || typeof node !== 'object') return null
    if (node.type === 'PrimaryButton' && node.props.children[0]?.startsWith('Run Cull')) return node
    return Object.values(node.props || {}).flat(Infinity).map(runButton).find(Boolean)
  }
  await runButton(tree).props.onClick()
  view = app.component('/ResultsView').props
  assert.equal(view.starredIds.has(id), true)
  assert.equal(view.results[0].decision, 'keep')
  assert.equal(view.selectedId, id)
})


test('actual App Demo flow: both export buttons expose current moves and stars to the export module', async () => {
  const app = await appHarness()
  const first = app.component('/ResultsView').props.selectedId
  app.component('/ResultsView').props.onStar(first)
  app.component('/ResultsView').props.onMove(first)
  const other = app.component('/ResultsView').props.results.find((entry) => entry.photo.id !== first)
  const second = other.photo.id
  if (other.decision === 'cut') app.component('/ResultsView').props.onMove(second)
  app.component('/ResultsView').props.onStar(second)
  for (const kind of ['keeps', 'starred']) {
    app.button(`Export ${kind}`).props.onClick()
    const dialog = app.component('/ExportDialog').props
    assert.equal(dialog.kind, kind)
    const set = selectExportSet(dialog.photos, kind)
    assert.equal(set.length, kind === 'keeps' ? 1 : 2)
    const writer = new MemoryExportWriter()
    await writer.chooseDestination()
    await writer.prepareFolder(`Cull ${kind}`)
    const outcome = await runExport({ photos: set.map((entry) => browserPhotoSource(entry.photo)), writer })
    assert.equal(outcome.written, set.length)
    assert.equal(outcome.failures.length, 0)
    for (const entry of set) assert.deepEqual(writer.files.get(entry.photo.name), await entry.photo.file.arrayBuffer())
    dialog.onClose()
  }
  assert.equal(app.component('/ResultsView').props.starredIds.size, 2)
})

test('actual App: Starred moves retain selection; unstar selects next then previous then nothing', async () => {
  const app = await appHarness()
  let view = app.component('/ResultsView').props
  const [first, second] = view.results.map((entry) => entry.photo.id)
  view.onStar(first)
  app.component('/ResultsView').props.onStar(second)
  app.component('/ResultsView').props.onTabChange('starred')
  app.component('/ResultsView').props.onMove(first)
  assert.equal(app.component('/ResultsView').props.selectedId, first)
  app.component('/ResultsView').props.onStar(first)
  assert.equal(app.component('/ResultsView').props.selectedId, second)
  app.component('/ResultsView').props.onStar(first)
  app.component('/ResultsView').props.onStar(second)
  assert.equal(app.component('/ResultsView').props.selectedId, first)
  app.component('/ResultsView').props.onStar(first)
  assert.equal(app.component('/ResultsView').props.selectedId, null)
})


test('Demo with JPEG and synthetic NEF: skipped RAW stays in library, counts update on removal, results and export exclude it', async () => {
  const missing = syntheticNef({ subIfds: false }).file
  const preview = syntheticNef().file
  const app = await appHarness([new File(['jpeg'], 'photo.jpg', {type:'image/jpeg'}), preview, missing], { run: false })
  const grid = () => app.component('/ThumbnailGrid').props
  assert.equal(grid().photos.length, 3)
  assert.equal(grid().photos.filter((photo) => photo.noPreview).length, 1)
  const skipped = grid().photos.find((photo) => photo.noPreview)
  const notice = () => app.find(app.render(), (node) => node.type === 'p' && node.props.children.flat().some((text) => typeof text === 'string' && text.includes("can't be previewed")))
  assert.ok(notice())
  app.component('/TasteInput').props.onChange('Warm light')
  await app.button('Show priorities').props.onClick()
  assert.ok(app.button('Run Cull on 2 photos'))
  grid().onRemove(skipped.id)
  assert.equal(grid().photos.length, 2)
  assert.equal(notice(), null)
  app.component('/UndoToast').props.onUndo()
  assert.equal(grid().photos.length, 3)
  assert.ok(notice())
  await app.button('Run Cull on 2 photos').props.onClick()
  const view = app.component('/ResultsView').props
  assert.equal(view.results.length, 2)
  assert.equal(view.results.some((entry) => entry.photo.id === skipped.id), false)
  for (const entry of view.results) view.onStar(entry.photo.id)
  app.button('Export starred').props.onClick()
  const selected = selectExportSet(app.component('/ExportDialog').props.photos, 'starred')
  assert.equal(selected.length, 2)
  assert.equal(selected.some((entry) => entry.photo.id === skipped.id), false)
  const raw = selected.find((entry) => entry.photo.name.endsWith('.NEF')).photo
  const writer = new MemoryExportWriter()
  await runExport({ photos: [browserPhotoSource(raw)], writer })
  assert.deepEqual(writer.files.get(raw.name), await preview.arrayBuffer())
})
