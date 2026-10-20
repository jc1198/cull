// Synthetic TIFF structure and JPEG marker data only; no camera files.
export function syntheticNef({ littleEndian = true, orientation = 6, jpegOrientation = null,
  subIfds = true, invalidRange = false, badMagic = false, nested = false, multiple = false } = {}) {
  const data = new Uint8Array(2048)
  const view = new DataView(data.buffer)
  const u16 = (pos, value) => view.setUint16(pos, value, littleEndian)
  const u32 = (pos, value) => view.setUint32(pos, value, littleEndian)
  data.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d])
  u16(2, 42); u32(4, 8)
  function ifd(pos, tags) {
    u16(pos, tags.length)
    tags.forEach(([tag, type, value, count = 1], index) => {
      const entry = pos + 2 + index * 12
      u16(entry, tag); u16(entry + 2, type); u32(entry + 4, count)
      if (type === 3 && count === 1) u16(entry + 8, value)
      else u32(entry + 8, value)
    })
    u32(pos + 2 + tags.length * 12, 0)
  }
  ifd(8, [[0x112, 3, orientation], ...(subIfds ? [[0x14a, 4, multiple ? 240 : 128, multiple ? 2 : 1]] : [])])
  if (multiple) { u32(240, 128); u32(244, 256) }
  const jpeg = [0xff, 0xd8]
  if (jpegOrientation !== null) {
    // APP1 EXIF uses MM independently of the outer TIFF byte order.
    jpeg.push(0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0,
      0x4d, 0x4d, 0, 42, 0, 0, 0, 8,
      0, 1, 1, 0x12, 0, 3, 0, 0, 0, 1, 0, jpegOrientation, 0, 0, 0, 0, 0, 0)
  }
  jpeg.push(0xff, 0xc0, 0, 11, 8, 0x0c, 0xc0, 0x13, 0x40, 1, 1, 0x11, 0, 0xff, 0xd9)
  data.set(jpeg, 512)
  if (badMagic) data[512] = 0
  const tags = [[0x100, 4, 4928], [0x101, 4, 3264], [0x201, 4, 512], [0x202, 4, invalidRange ? 2048 : jpeg.length]]
  if (nested) { ifd(128, [[0x14a, 4, 256]]); ifd(256, tags) }
  else ifd(128, tags)
  if (multiple) {
    ifd(256, [[0x100, 4, 100], [0x101, 4, 100], [0x201, 4, 1024], [0x202, 4, 4]])
    data.set([0xff, 0xd8, 0xff, 0xd9], 1024)
  }
  return { file: new File([data], 'synthetic.NEF', { type: 'image/x-nikon-nef' }), offset: 512, length: jpeg.length }
}
