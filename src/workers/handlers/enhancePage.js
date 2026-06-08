const SHADOW_BLUR_RATIO = 32
const MIN_SHADOW_RADIUS = 8
const MAX_SHADOW_RADIUS = 48
const SHADOW_EPSILON = 8
const MIN_GAIN = 0.55
const MAX_GAIN = 2.2
const CONTRAST_LOW_PERCENTILE = 0.02
const CONTRAST_HIGH_PERCENTILE = 0.98
const CONTRAST_GAMMA = 0.92

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function blurRadius(width, height) {
  return clamp(
    Math.floor(Math.min(width, height) / SHADOW_BLUR_RATIO),
    MIN_SHADOW_RADIUS,
    MAX_SHADOW_RADIUS,
  )
}

/**
 * Separable box blur on a Float32Array (single channel).
 */
function boxBlur(channel, width, height, radius) {
  const output = new Float32Array(channel.length)
  const window = radius * 2 + 1
  const temp = new Float32Array(channel.length)

  for (let y = 0; y < height; y++) {
    let sum = 0
    const row = y * width

    for (let x = -radius; x <= radius; x++) {
      sum += channel[row + clamp(x, 0, width - 1)]
    }

    for (let x = 0; x < width; x++) {
      temp[row + x] = sum / window
      const remove = clamp(x - radius, 0, width - 1)
      const add = clamp(x + radius + 1, 0, width - 1)
      sum += channel[row + add] - channel[row + remove]
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0

    for (let y = -radius; y <= radius; y++) {
      const row = clamp(y, 0, height - 1) * width
      sum += temp[row + x]
    }

    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / window
      const removeRow = clamp(y - radius, 0, height - 1) * width
      const addRow = clamp(y + radius + 1, 0, height - 1) * width
      sum += temp[addRow + x] - temp[removeRow + x]
    }
  }

  return output
}

/**
 * Reduce uneven lighting by normalizing against a blurred illumination map.
 * @param {ImageData} imageData
 */
export function reduceShadows(imageData) {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const gray = new Float32Array(pixelCount)
  let graySum = 0

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value = luminance(data[i], data[i + 1], data[i + 2])
    gray[p] = value
    graySum += value
  }

  const grayMean = graySum / pixelCount
  const illumination = boxBlur(gray, width, height, blurRadius(width, height))

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const source = gray[p]
    const gain = clamp(
      (source / (illumination[p] + SHADOW_EPSILON)) * grayMean,
      source * MIN_GAIN,
      source * MAX_GAIN,
    )
    const scale = source > 0 ? gain / source : 1

    data[i] = clamp(Math.round(data[i] * scale), 0, 255)
    data[i + 1] = clamp(Math.round(data[i + 1] * scale), 0, 255)
    data[i + 2] = clamp(Math.round(data[i + 2] * scale), 0, 255)
  }

  return imageData
}

function percentile(values, ratio) {
  const sorted = values.slice().sort((a, b) => a - b)
  const index = clamp(
    Math.floor(sorted.length * ratio),
    0,
    sorted.length - 1,
  )
  return sorted[index]
}

/**
 * Stretch tonal range and apply mild gamma for readability.
 * @param {ImageData} imageData
 */
export function enhanceContrast(imageData) {
  const { data } = imageData
  const samples = []

  for (let i = 0; i < data.length; i += 4) {
    samples.push(luminance(data[i], data[i + 1], data[i + 2]))
  }

  const low = percentile(samples, CONTRAST_LOW_PERCENTILE)
  const high = percentile(samples, CONTRAST_HIGH_PERCENTILE)
  const range = Math.max(high - low, 1)

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const normalized = clamp((data[i + c] - low) / range, 0, 1)
      const gammaAdjusted = normalized ** CONTRAST_GAMMA
      data[i + c] = clamp(Math.round(gammaAdjusted * 255), 0, 255)
    }
  }

  return imageData
}

/**
 * Shadow reduction followed by contrast enhancement.
 * @param {ImageData} imageData
 */
export function enhancePage(imageData) {
  reduceShadows(imageData)
  enhanceContrast(imageData)
  return imageData
}
