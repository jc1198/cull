import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalModel, isInstalled, modelRows, prioritiesAreStale } from '../src/lib/models.js'

test('model identity invalidates an unchanged description until a new successful read', () => {
  const read = { model: 'demo', description: 'warm light' }
  assert.equal(prioritiesAreStale(read, 'warm light', 'llava:7b'), true)
  assert.equal(prioritiesAreStale(read, ' warm light ', 'demo'), false)
  assert.equal(prioritiesAreStale({ ...read, model: 'llava:7b' }, 'warm light', 'llava:7b'), false)
  assert.equal(prioritiesAreStale(read, 'sharp focus', 'demo'), true)
  assert.equal(prioritiesAreStale(null, 'warm light', 'llava:7b'), false)
})

test('untagged models match only their latest tag, not arbitrary versions', () => {
  assert.equal(canonicalModel('moondream'), 'moondream:latest')
  assert.equal(isInstalled('moondream', ['moondream:latest']), true)
  assert.equal(isInstalled('llava:7b', ['llava:13b']), false)
  const rows = modelRows(['moondream:latest', 'custom:vision'])
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[3], { name: 'custom:vision' })
})
