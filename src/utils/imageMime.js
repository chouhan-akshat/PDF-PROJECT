export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const EXTENSION_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/**
 * @param {File} file
 * @returns {string | null}
 */
export function resolveImageMimeType(file) {
  const type = file.type?.toLowerCase()
  if (type && SUPPORTED_IMAGE_MIME_TYPES.has(type)) {
    return type === 'image/jpg' ? 'image/jpeg' : type
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? EXTENSION_TO_MIME[ext] ?? null : null
}

/**
 * @param {Uint8Array} bytes
 * @returns {'jpeg' | 'png' | 'webp' | null}
 */
export function detectImageFormat(bytes) {
  if (bytes.length < 12) return null

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }

  return null
}

/**
 * @param {File} file
 */
export function assertSupportedImageFile(file) {
  const mime = resolveImageMimeType(file)
  if (!mime) {
    throw new Error(
      `"${file.name}" is not supported. Use JPG, JPEG, PNG, or WEBP.`,
    )
  }
  return mime
}
