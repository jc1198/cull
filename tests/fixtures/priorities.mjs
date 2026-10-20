// The model's response envelope, before the client maps it to priority cards.
// Explicit overrides also allow validation tests to supply malformed responses.
export function makePrioritiesResponse(overrides = {}) {
  return {
    subject: { named: false, signal: '', description: '' },
    criteria: [{ signal: 'Warm light', weight: 'high', description: 'Warm tones' }],
    ...overrides,
  }
}
