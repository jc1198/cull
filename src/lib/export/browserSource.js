// Adapter for stored browser originals; desktop can supply a path-backed source.
export function browserPhotoSource(photo) {
  const original = photo.file
  return { name: photo.name, size: photo.size, read: () => original.stream() }
}

