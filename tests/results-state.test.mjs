import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { selectExportSet, browserPhotoSource, runExport } from '../src/lib/export/index.js'
import { MemoryExportWriter } from './fixtures/exportWriter.mjs'

// Render App's actual handlers with lightweight hooks; no DOM or inference server needed.
let harnessId = 0
async function appHarness() {
  const bundled = await build({
    entryPoints: ['src/App.jsx'], bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'state-harness', setup(builder) {
      builder.onResolve({ filter: /^\//, namespace: 'fixture' }, (args) => ({ path: args.path, namespace: 'file' }))
      builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }))
      builder.onResolve({ filter: /^\.\// }, (args) => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
        if (path === 'react') return { contents: `
          export const slots=[]; let cursor=0;
          useState.begin=()=>{cursor=0};
          export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]}
          export function useRef(value){return useState(()=>({current:value}))[0]}
          export const useEffect=()=>{},useLayoutEffect=()=>{},useCallback=fn=>fn;
          export default {createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment'};
        ` }
        if (path.endsWith('/models')) return { contents: `export const CRITERIA_MODEL='criteria',DEMO_MODEL='demo',MODEL_STORAGE_KEY='model';export const readSavedModel=()=> 'demo',prioritiesAreStale=()=>false;` }
        if (path.endsWith('/ollama')) return { contents: `import {mockBuildCullCriteria,mockEvaluatePhoto} from '${process.cwd()}/src/lib/mock.js'; export const buildCullCriteria=mockBuildCullCriteria,evaluatePhoto=(_bytes,_criteria,index)=>mockEvaluatePhoto(index),unloadCriteriaModel=async()=>{};` }
        if (path.endsWith('/thumbnail')) return { contents: `export const makeThumbnail=async()=> 'thumb',encodeForModel=async()=>{throw Error('Demo must not encode')};` }
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
  function render() { module.useState.begin(); return module.default() }
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
  await find(render(), (node) => node.type === 'input').props.onChange({ target: { files: [
    new File([new Uint8Array([1, 0, 255])], 'one.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array([2, 0, 255])], 'two.jpg', { type: 'image/jpeg' }),
  ] } })
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
