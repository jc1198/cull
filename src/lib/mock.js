// Mock responses for offline dev. Gated by VITE_MOCK_API in the modules that
// call into a model — including lib/ollama.js, the active inference path.

export const MOCK_INTENTS = [
  'Warm tones preferred',
  'Wide landscape composition',
  'Dramatic sky presence',
  'Golden hour lighting',
  'Slightly underexposed',
]

export function mockCullPhoto(_photo, index) {
  const keep = index % 2 === 0
  return {
    decision: keep ? 'keep' : 'cut',
    reason: keep
      ? 'Strong horizon line with warm tones matching taste profile'
      : "Flat lighting, overexposed sky — doesn't match stated mood",
  }
}

export function mockRefineResults() {
  return { action: 'filter', params: {}, message: 'Got it — showing updated selection' }
}

// ── v2 mocks ────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Four criteria at mixed weights: exercises the 4-across card layout, the
// high/secondary split in the evaluate prompt, and the merge rule on re-read.
const MOCK_CRITERIA = [
  { signal: 'Warm, low-angle sun',  weight: 'high',   description: 'Golden or orange cast, long shadows, sun near the horizon' },
  { signal: 'Subject in focus',     weight: 'high',   description: 'Primary subject is sharp with visible edge detail' },
  { signal: 'Clean horizon',        weight: 'medium', description: 'Horizon line is level and unobstructed' },
  { signal: 'Negative space',       weight: 'low',    description: 'Open sky or ground giving the subject room' },
]

// A second read returns an overlapping-but-shifted set so the merge rule is
// observable: two labels match (one at a different model weight), one is new,
// one is gone.
const MOCK_CRITERIA_REREAD = [
  { signal: 'Warm, low-angle sun',  weight: 'medium', description: 'Golden or orange cast, long shadows, sun near the horizon' },
  { signal: 'Subject in focus',     weight: 'high',   description: 'Primary subject is sharp with visible edge detail' },
  { signal: 'Silhouetted form',     weight: 'high',   description: 'Subject reads as a dark shape against a brighter sky' },
  { signal: 'Clean horizon',        weight: 'low',    description: 'Horizon line is level and unobstructed' },
]

let mockReadCount = 0

export async function mockBuildCullCriteria(_tasteProfile) {
  await delay(600)
  const set = mockReadCount++ === 0 ? MOCK_CRITERIA : MOCK_CRITERIA_REREAD
  return set.map((c) => ({ ...c }))
}

const KEEP_REASONS = [
  'Warm side light rakes across the subject and the shadows run long. The face is sharp at the eyes. Horizon sits level just below centre. Sky is open enough to give the figure room.',
  'Low sun puts a golden rim on the subject. Focus holds on the near edge. The background falls away cleanly. Nothing competes with the main shape.',
  'Colour is firmly in the golden range and the exposure holds detail in the highlights. The subject is sharp. Composition leaves space on the lead side.',
]

const CUT_REASONS = [
  'Light is flat and overhead with no directional warmth. Edges are soft through the centre of the subject. Horizon tilts. The frame is crowded to the edges.',
  'Sun is high and the cast is neutral rather than golden. Motion blur across the subject. The horizon is broken by clutter. No open space to rest in.',
  'Underexposed without the warmth the brief asks for. Detail is lost in the shadow side. Horizon is level but the subject sits too tight in the frame.',
]

// Deterministic pseudo-random keyed by index, skewed ~70/30 keep/cut to match
// the spec's 84/32 split (this seed gives 83/33 at 116, 23/7 at 30).
// Deterministic so a re-run reproduces the same set.
//
// The seed is chosen so index 0 is a keep and the first screenful has no run of
// three cuts — an opening run of cuts makes the analyzing screen read as though
// the taste profile isn't landing.
const SEED = 4

function hash(n) {
  let h = Math.imul(n + SEED, 2654435761) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 2246822507) >>> 0
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

export async function mockEvaluatePhoto(index = 0) {
  // Per-photo delay so the scan line and its minimum dwell time are observable.
  await delay(320 + hash(index) * 260)
  const keep = hash(index) < 0.7
  const pool = keep ? KEEP_REASONS : CUT_REASONS
  return {
    decision: keep ? 'keep' : 'cut',
    reason: pool[index % pool.length],
  }
}

export function resetMockReadCount() {
  mockReadCount = 0
}
