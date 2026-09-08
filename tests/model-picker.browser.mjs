// Run against npm run dev. PLAYWRIGHT_MODULE may point to a bundled Playwright installation.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
console.log('Launching Chrome')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
console.log('Chrome launched')
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
let health = { connected: true, models: ['llava:7b', 'custom:vision'] }
let healthGate = null
let releaseHealth
let failAt = -1
let photoCalls = 0
let readDelay = 0
const sentModels = []
await page.route('**/health', async (route) => {
  if (healthGate) await healthGate
  await route.fulfill({ json: health })
})
await page.route('**/evaluate', async (route) => {
  const body = route.request().postDataJSON()
  sentModels.push(body.model)
  if (body.images) {
    photoCalls++
    if (photoCalls === failAt) return route.fulfill({ status: 502, json: { error: 'Ollama unreachable' } })
    return route.fulfill({ json: { response: JSON.stringify({ decision: 'keep', reason: 'Warm light matches.' }) } })
  }
  if (readDelay) await new Promise((r) => setTimeout(r, readDelay))
  return route.fulfill({ json: { response: JSON.stringify([{ signal: 'Warm light', weight: 'high', description: 'Warm tones' }]) } })
})
const button = (name) => page.getByRole('button', { name, exact: true })
async function open() {
  await page.getByRole('button', { name: /^Running on / }).click()
  await page.getByRole('dialog', { name: 'Choose a model' }).waitFor()
  await button('Re-check').waitFor()
}
async function select(name) {
  await open()
  await page.getByRole('dialog').getByRole('button', { name, exact: false }).first().click()
}
try {
  console.log('Opening Cull')
  await page.goto('http://localhost:5173')
  await page.getByRole('button', { name: 'Running on Demo mode', exact: true }).waitFor()
  await open()
  assert.equal(await button('Copy command for moondream').count(), 1)
  assert.equal(await button('Copy command for llava:7b').count(), 0)
  assert.equal(await page.getByRole('dialog').getByText('Switching models', { exact: false }).count(), 0)
  assert.equal(await button('custom:vision').count(), 1)
  await button('Copy command for moondream').click()
  await page.getByRole('status').filter({ hasText: 'Copied:' }).waitFor()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'ollama pull moondream')
  await page.screenshot({ path: '/tmp/cull-picker-toast.png' })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.activeElement?.classList.contains('model-trigger'))

  health = { connected: true, models: [] }
  await open()
  assert.equal(await page.getByRole('button', { name: /^Copy command for/ }).count(), 3)
  await page.keyboard.press('Escape')
  health = { connected: false, models: [] }
  await open()
  await page.getByText('Ollama isn’t running. Start Ollama, then re-check.').waitFor()
  assert.equal(await page.getByRole('button', { name: /^Copy command for/ }).count(), 0)
  await page.keyboard.press('Escape')

  health = { connected: true, models: ['llava:7b', 'custom:vision'] }
  await select('llava:7b')
  await page.reload()
  await page.getByRole('button', { name: 'Running on llava:7b', exact: true }).waitFor()
  healthGate = new Promise((resolve) => { releaseHealth = resolve })
  await page.getByRole('button', { name: /^Running on / }).click()
  await page.getByRole('status').filter({ hasText: 'Checking' }).waitFor()
  assert.equal(await button('llava:7b Balanced | 4 GB').isDisabled(), true)
  releaseHealth()
  healthGate = null
  await button('Re-check').waitFor()
  await page.keyboard.press('Escape')

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file]').setInputFiles([1, 2, 3].map(i => ({ name: `${i}.png`, mimeType: 'image/png', buffer: png })))
  await page.getByRole('textbox').fill('warm light')
  await button('Show priorities').click()
  await button('Run Cull on 3 photos').waitFor()
  await open()
  await page.getByText('Switching models resets your priorities.', { exact: true }).waitFor()
  await page.keyboard.press('Escape')
  failAt = 2
  await button('Run Cull on 3 photos').click()
  assert.equal(await page.getByRole('button', { name: /^Running on / }).isDisabled(), true)
  await button('Retry from photo 2').waitFor()
  await page.getByText('stopped responding', { exact: false }).waitFor()
  await page.screenshot({ path: '/tmp/cull-picker-failure.png' })
  assert.equal(photoCalls, 2)
  failAt = -1
  await button('Retry from photo 2').click()
  await button('Back to set taste').waitFor()
  assert.equal(photoCalls, 4, 'retry must only evaluate the two unfinished photos')
  await open()
  await page.getByText('Switching models resets your priorities and results.', { exact: true }).waitFor()
  await button('Demo mode Sample results, no model needed').click()
  await button('Update priorities').waitFor()
  await page.getByText('These priorities reflect your earlier model').waitFor()
  assert.equal(await button('Run Cull on 3 photos').count(), 0)
  await page.screenshot({ path: '/tmp/cull-picker-stale.png' })
  assert.equal(await page.getByRole('textbox').inputValue(), 'warm light')
  await button('Update priorities').click()
  await button('Run Cull on 3 photos').waitFor()
  assert.equal(sentModels.every(name => name === 'llava:7b'), true)

  // A late read from the old model cannot replace Demo priorities.
  await select('llava:7b')
  readDelay = 600
  await button('Update priorities').click()
  await select('Demo mode')
  await button('Run Cull on 3 photos').waitFor()
  await page.waitForTimeout(800)
  assert.equal(await button('Run Cull on 3 photos').count(), 1)
  // Both alternatives on the failed-run console preserve their promised scope.
  readDelay = 0
  await select('llava:7b')
  await button('Update priorities').click()
  await button('Run Cull on 3 photos').waitFor()
  failAt = photoCalls + 2
  await button('Run Cull on 3 photos').click()
  await button('Retry from photo 2').waitFor()
  await button('See the 1 finished').click()
  await button('Back to set taste').waitFor()
  await button('Star').click()
  await button('Back to set taste').click()
  failAt = photoCalls + 1
  await button('Run Cull on 3 photos').click()
  await button('Retry from photo 1').waitFor()
  assert.equal(await button('See the 0 finished').isDisabled(), true)
  await button('Switch to demo mode').click()
  await button('Update priorities').waitFor()
  await page.getByText('These priorities reflect your earlier model').waitFor()
  await button('Update priorities').click()
  await button('Run Cull on 3 photos').waitFor()
  await button('Run Cull on 3 photos').click()
  await button('Back to set taste').waitFor()
  await button('Starred 1').waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: picker states, clipboard, persistence, loading, locking, retry, stale model switch, read race, partial results, Demo recovery, and retained stars')
} catch (error) {
  console.log(await page.locator('body').innerText())
  await page.screenshot({ path: '/tmp/cull-test-error.png' })
  throw error
} finally { await browser.close() }
