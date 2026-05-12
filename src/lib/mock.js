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
