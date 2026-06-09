import { PDFDocument } from 'pdf-lib'
import { PdfWorkerMessage } from '../../constants/pdfWorkerTypes.js'
import { detectImageFormat } from '../../utils/imageMime.js'
import { reduceShadows, enhanceContrast } from './enhancePage.js'
import {
  buildFinishDiagnostic,
  createImageLogger,
  createSessionState,
  errorMessage,
} from './notesCleanerDiagnostics.js'
import { addA4ImageBytesPage } from './pdfA4Page.js'

const JPEG_QUALITY = 0.92
const MAX_PROCESSING_EDGE = 2400
const ANALYSIS_MAX_EDGE = 900
const DOCUMENT_CONFIDENCE_THRESHOLD = 0.55
const PERSPECTIVE_CONFIDENCE_THRESHOLD = 0.68
const MIN_CROP_SAVINGS_RATIO = 0.02

/** @type {Map<number, ReturnType<typeof createSessionState> & { pdf: import('pdf-lib').PDFDocument }>} */
const sessions = new Map()

function clearSession(jobId) {
  sessions.delete(jobId)
}

function postWorkerLog(jobId, payload) {
  self.postMessage({
    id: jobId,
    type: PdfWorkerMessage.NOTES_CLEANER_LOG,
    payload,
  })
}

function mimeFromFormat(format) {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function scaleRect(rect, scaleX, scaleY) {
  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }
}

function scalePoints(points, scaleX, scaleY) {
  return points?.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }))
}

function createSobelEdges(gray, width, height) {
  const magnitude = new Float32Array(width * height)
  let sum = 0
  let sumSquares = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const row = y * width
      const top = row - width
      const bottom = row + width

      const gx =
        -gray[top + x - 1] -
        2 * gray[row + x - 1] -
        gray[bottom + x - 1] +
        gray[top + x + 1] +
        2 * gray[row + x + 1] +
        gray[bottom + x + 1]
      const gy =
        -gray[top + x - 1] -
        2 * gray[top + x] -
        gray[top + x + 1] +
        gray[bottom + x - 1] +
        2 * gray[bottom + x] +
        gray[bottom + x + 1]
      const value = Math.hypot(gx, gy)

      magnitude[row + x] = value
      sum += value
      sumSquares += value * value
      count += 1
    }
  }

  const mean = count ? sum / count : 0
  const variance = count ? sumSquares / count - mean * mean : 0
  const stdDev = Math.sqrt(Math.max(0, variance))

  return {
    magnitude,
    threshold: clamp(mean + stdDev * 1.15, 32, 145),
    mean,
    stdDev,
  }
}

function projectionPeak(values, from, to) {
  let peak = 0
  const start = clamp(from, 0, values.length - 1)
  const end = clamp(to, 0, values.length - 1)

  for (let i = start; i <= end; i++) {
    peak = Math.max(peak, values[i])
  }

  return peak
}

function createBrightnessMask(gray, width, height, grayMean, grayStdDev) {
  const histogram = new Uint32Array(256)
  const pixelCount = width * height
  const borderSize = Math.max(2, Math.round(Math.min(width, height) * 0.04))
  let borderSum = 0
  let borderSquares = 0
  let borderCount = 0

  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]] += 1
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (
        x >= borderSize &&
        x < width - borderSize &&
        y >= borderSize &&
        y < height - borderSize
      ) {
        continue
      }

      const value = gray[y * width + x]
      borderSum += value
      borderSquares += value * value
      borderCount += 1
    }
  }

  let totalWeighted = 0
  for (let value = 0; value < histogram.length; value++) {
    totalWeighted += value * histogram[value]
  }

  let backgroundWeight = 0
  let backgroundWeighted = 0
  let bestVariance = 0
  let otsuThreshold = grayMean

  for (let value = 0; value < histogram.length; value++) {
    backgroundWeight += histogram[value]
    if (backgroundWeight === 0) continue

    const foregroundWeight = pixelCount - backgroundWeight
    if (foregroundWeight === 0) break

    backgroundWeighted += value * histogram[value]
    const backgroundMean = backgroundWeighted / backgroundWeight
    const foregroundMean =
      (totalWeighted - backgroundWeighted) / foregroundWeight
    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) *
      (backgroundMean - foregroundMean)

    if (variance > bestVariance) {
      bestVariance = variance
      otsuThreshold = value
    }
  }

  const borderMean = borderCount ? borderSum / borderCount : grayMean
  const borderVariance = borderCount
    ? borderSquares / borderCount - borderMean * borderMean
    : 0
  const borderStdDev = Math.sqrt(Math.max(0, borderVariance))
  const borderLooksLikeBackground = borderMean < grayMean - 8
  const threshold = clamp(
    borderLooksLikeBackground
      ? Math.max(
          otsuThreshold,
          borderMean + Math.max(10, borderStdDev * 0.7),
          grayMean + grayStdDev * 0.1,
        )
      : Math.max(otsuThreshold, grayMean - grayStdDev * 0.25),
    24,
    245,
  )
  const mask = new Uint8Array(pixelCount)
  let maskCount = 0

  for (let i = 0; i < gray.length; i++) {
    if (gray[i] >= threshold) {
      mask[i] = 1
      maskCount += 1
    }
  }

  return {
    mask,
    maskCount,
    threshold,
    borderMean,
    borderStdDev,
    borderLooksLikeBackground,
  }
}

function findPageComponents(mask, gray, width, height) {
  const components = []
  const stack = new Int32Array(mask.length)
  const minPixels = Math.max(64, Math.round(mask.length * 0.004))

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue

    let stackLength = 0
    let count = 0
    let graySum = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    mask[start] = 2
    stack[stackLength] = start
    stackLength += 1

    while (stackLength > 0) {
      stackLength -= 1
      const index = stack[stackLength]
      const x = index % width
      const y = Math.floor(index / width)

      count += 1
      graySum += gray[index]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      const left = index - 1
      const right = index + 1
      const top = index - width
      const bottom = index + width

      if (x > 0 && mask[left] === 1) {
        mask[left] = 2
        stack[stackLength] = left
        stackLength += 1
      }
      if (x < width - 1 && mask[right] === 1) {
        mask[right] = 2
        stack[stackLength] = right
        stackLength += 1
      }
      if (y > 0 && mask[top] === 1) {
        mask[top] = 2
        stack[stackLength] = top
        stackLength += 1
      }
      if (y < height - 1 && mask[bottom] === 1) {
        mask[bottom] = 2
        stack[stackLength] = bottom
        stackLength += 1
      }
    }

    if (count < minPixels) continue

    components.push({
      count,
      mean: graySum / count,
      rect: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
    })
  }

  return components
}

function edgeSupportForRect(magnitude, threshold, width, height, rect) {
  const rowEdges = new Uint16Array(height)
  const colEdges = new Uint16Array(width)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (magnitude[y * width + x] < threshold) continue
      rowEdges[y] += 1
      colEdges[x] += 1
    }
  }

  const searchRadius = Math.max(3, Math.round(Math.min(width, height) * 0.012))
  const right = rect.x + rect.width - 1
  const bottom = rect.y + rect.height - 1
  const topSupport = projectionPeak(
    rowEdges,
    rect.y - searchRadius,
    rect.y + searchRadius,
  )
  const bottomSupport = projectionPeak(
    rowEdges,
    bottom - searchRadius,
    bottom + searchRadius,
  )
  const leftSupport = projectionPeak(
    colEdges,
    rect.x - searchRadius,
    rect.x + searchRadius,
  )
  const rightSupport = projectionPeak(
    colEdges,
    right - searchRadius,
    right + searchRadius,
  )
  const horizontalSupport =
    (topSupport + bottomSupport) / Math.max(1, rect.width * 2)
  const verticalSupport =
    (leftSupport + rightSupport) / Math.max(1, rect.height * 2)

  return clamp((horizontalSupport + verticalSupport) / 0.12, 0, 1)
}

function aspectRatioScoreFor(rect) {
  const ratio = rect.width / Math.max(1, rect.height)

  if (ratio >= 0.55 && ratio <= 1.65) return 1
  if (ratio >= 0.4 && ratio < 0.55) return clamp((ratio - 0.4) / 0.15, 0, 1)
  if (ratio > 1.65 && ratio <= 2.4) return clamp((2.4 - ratio) / 0.75, 0, 1)
  return 0
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function polygonArea(points) {
  let area = 0

  for (let i = 0; i < points.length; i++) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }

  return Math.abs(area) / 2
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
}

function isConvexQuad(points) {
  let sign = 0

  for (let i = 0; i < points.length; i++) {
    const value = cross(
      points[i],
      points[(i + 1) % points.length],
      points[(i + 2) % points.length],
    )

    if (Math.abs(value) < 1e-6) continue
    const currentSign = Math.sign(value)
    if (sign === 0) {
      sign = currentSign
    } else if (sign !== currentSign) {
      return false
    }
  }

  return sign !== 0
}

function fitLine(points, orientation) {
  if (points.length < 8) return null

  let sumA = 0
  let sumB = 0
  let sumAA = 0
  let sumAB = 0

  for (const point of points) {
    const a = orientation === 'horizontal' ? point.x : point.y
    const b = orientation === 'horizontal' ? point.y : point.x
    sumA += a
    sumB += b
    sumAA += a * a
    sumAB += a * b
  }

  const count = points.length
  const denominator = count * sumAA - sumA * sumA
  if (Math.abs(denominator) < 1e-6) return null

  const slope = (count * sumAB - sumA * sumB) / denominator
  const intercept = (sumB - slope * sumA) / count

  return { orientation, slope, intercept, support: points.length }
}

function intersectLines(horizontal, vertical) {
  const denominator = 1 - horizontal.slope * vertical.slope
  if (Math.abs(denominator) < 1e-6) return null

  const y =
    (horizontal.slope * vertical.intercept + horizontal.intercept) /
    denominator
  const x = vertical.slope * y + vertical.intercept
  return { x, y }
}

function collectLinePoints(magnitude, threshold, width, height, rect, side) {
  const points = []
  const band = Math.max(8, Math.round(Math.min(rect.width, rect.height) * 0.12))
  const left = clamp(rect.x - band, 1, width - 2)
  const right = clamp(rect.x + rect.width + band, 1, width - 2)
  const top = clamp(rect.y - band, 1, height - 2)
  const bottom = clamp(rect.y + rect.height + band, 1, height - 2)

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const value = magnitude[y * width + x]
      if (value < threshold) continue

      if (side === 'top' && Math.abs(y - rect.y) <= band) {
        points.push({ x, y })
      } else if (
        side === 'bottom' &&
        Math.abs(y - (rect.y + rect.height - 1)) <= band
      ) {
        points.push({ x, y })
      } else if (side === 'left' && Math.abs(x - rect.x) <= band) {
        points.push({ x, y })
      } else if (
        side === 'right' &&
        Math.abs(x - (rect.x + rect.width - 1)) <= band
      ) {
        points.push({ x, y })
      }
    }
  }

  return points
}

function lineSupportScoreFor(lines, pointSets) {
  const supports = [
    lines.top?.support ?? 0,
    lines.bottom?.support ?? 0,
    lines.left?.support ?? 0,
    lines.right?.support ?? 0,
  ]
  const totalSupport = supports.reduce((sum, value) => sum + value, 0)
  const totalCandidates = Math.max(
    1,
    pointSets.top.length +
      pointSets.bottom.length +
      pointSets.left.length +
      pointSets.right.length,
  )
  const fitScore = clamp(totalSupport / totalCandidates, 0, 1)
  const presenceScore =
    supports.filter((value) => value >= 8).length / supports.length

  return clamp(fitScore * 0.45 + presenceScore * 0.55, 0, 1)
}

function detectPerspectiveFromAnalysis(imageData, analysis) {
  const { width, height } = imageData
  const rect = analysis.detail?.componentRect ?? analysis.cropRect
  const gray = new Uint8ClampedArray(width * height)

  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p++) {
    gray[p] = luminance(
      imageData.data[i],
      imageData.data[i + 1],
      imageData.data[i + 2],
    )
  }

  const { magnitude, threshold } = createSobelEdges(gray, width, height)
  const pointSets = {
    top: collectLinePoints(magnitude, threshold, width, height, rect, 'top'),
    bottom: collectLinePoints(
      magnitude,
      threshold,
      width,
      height,
      rect,
      'bottom',
    ),
    left: collectLinePoints(magnitude, threshold, width, height, rect, 'left'),
    right: collectLinePoints(magnitude, threshold, width, height, rect, 'right'),
  }
  const lines = {
    top: fitLine(pointSets.top, 'horizontal'),
    bottom: fitLine(pointSets.bottom, 'horizontal'),
    left: fitLine(pointSets.left, 'vertical'),
    right: fitLine(pointSets.right, 'vertical'),
  }

  if (!lines.top || !lines.bottom || !lines.left || !lines.right) {
    return {
      confidence: 0,
      shouldPerspectiveCorrect: false,
      corners: null,
      reason: 'insufficient-boundary-lines',
      detail: {
        lineSupportScore: lineSupportScoreFor(lines, pointSets),
        cornerGeometryScore: 0,
        convexityScore: 0,
        areaConsistencyScore: 0,
        aspectRatioScore: 0,
      },
    }
  }

  const corners = [
    intersectLines(lines.top, lines.left),
    intersectLines(lines.top, lines.right),
    intersectLines(lines.bottom, lines.right),
    intersectLines(lines.bottom, lines.left),
  ]

  if (corners.some((corner) => !corner)) {
    return {
      confidence: 0,
      shouldPerspectiveCorrect: false,
      corners: null,
      reason: 'corner-intersection-failed',
      detail: {
        lineSupportScore: lineSupportScoreFor(lines, pointSets),
        cornerGeometryScore: 0,
        convexityScore: 0,
        areaConsistencyScore: 0,
        aspectRatioScore: 0,
      },
    }
  }

  const margin = Math.max(width, height) * 0.04
  const inBoundsRatio =
    corners.filter(
      (corner) =>
        corner.x >= -margin &&
        corner.x <= width + margin &&
        corner.y >= -margin &&
        corner.y <= height + margin,
    ).length / corners.length
  const minSide = Math.min(
    distance(corners[0], corners[1]),
    distance(corners[1], corners[2]),
    distance(corners[2], corners[3]),
    distance(corners[3], corners[0]),
  )
  const sideScore = clamp(
    minSide / Math.max(1, Math.min(width, height) * 0.2),
    0,
    1,
  )
  const cornerGeometryScore = clamp(
    inBoundsRatio * 0.7 + sideScore * 0.3,
    0,
    1,
  )
  const convexityScore = isConvexQuad(corners) ? 1 : 0
  const quadArea = polygonArea(corners)
  const rectArea = Math.max(1, rect.width * rect.height)
  const areaRatio = quadArea / rectArea
  const areaConsistencyScore =
    areaRatio >= 0.55 && areaRatio <= 1.45
      ? 1
      : areaRatio < 0.55
        ? clamp(areaRatio / 0.55, 0, 1)
        : clamp((2 - areaRatio) / 0.55, 0, 1)
  const targetWidth = Math.max(
    distance(corners[0], corners[1]),
    distance(corners[3], corners[2]),
  )
  const targetHeight = Math.max(
    distance(corners[0], corners[3]),
    distance(corners[1], corners[2]),
  )
  const aspectRatioScore = aspectRatioScoreFor({
    x: 0,
    y: 0,
    width: targetWidth,
    height: targetHeight,
  })
  const lineSupportScore = lineSupportScoreFor(lines, pointSets)
  const confidence = clamp(
    lineSupportScore * 0.3 +
      cornerGeometryScore * 0.25 +
      convexityScore * 0.15 +
      areaConsistencyScore * 0.1 +
      aspectRatioScore * 0.1 +
      analysis.confidence * 0.1,
    0,
    1,
  )

  return {
    confidence,
    shouldPerspectiveCorrect:
      analysis.confidence >= DOCUMENT_CONFIDENCE_THRESHOLD &&
      confidence >= PERSPECTIVE_CONFIDENCE_THRESHOLD &&
      convexityScore === 1 &&
      cornerGeometryScore >= 0.75 &&
      areaConsistencyScore >= 0.55,
    corners,
    outputSize: {
      width: Math.max(1, Math.round(targetWidth)),
      height: Math.max(1, Math.round(targetHeight)),
    },
    reason:
      confidence >= PERSPECTIVE_CONFIDENCE_THRESHOLD
        ? 'perspective-corners-detected'
        : 'low-perspective-confidence',
    detail: {
      lineSupportScore,
      cornerGeometryScore,
      convexityScore,
      areaConsistencyScore,
      aspectRatioScore,
    },
  }
}

function scorePageComponent(component, context) {
  const { width, height, borderMean, edgeMagnitude, edgeThreshold } = context
  const pixelCount = width * height
  const rectArea = component.rect.width * component.rect.height
  const componentAreaRatio = component.count / pixelCount
  const rectAreaRatio = rectArea / pixelCount
  const cropSavings = 1 - rectAreaRatio
  const fillRatio = component.count / Math.max(1, rectArea)
  const componentAreaScore =
    componentAreaRatio >= 0.12 && componentAreaRatio <= 0.96
      ? 1
      : componentAreaRatio < 0.12
        ? clamp(componentAreaRatio / 0.12, 0, 1)
        : clamp((1 - componentAreaRatio) / 0.04, 0, 1)
  const fillRatioScore = clamp((fillRatio - 0.45) / 0.4, 0, 1)
  const backgroundContrastScore = clamp(
    (component.mean - borderMean) / 55,
    0,
    1,
  )
  const rectangularityScore = clamp((fillRatio - 0.58) / 0.34, 0, 1)
  const edgeSupportScore = edgeSupportForRect(
    edgeMagnitude,
    edgeThreshold,
    width,
    height,
    component.rect,
  )
  const cropUsefulnessScore = clamp(cropSavings / 0.18, 0, 1)
  const aspectRatioScore = aspectRatioScoreFor(component.rect)
  const confidence = clamp(
    componentAreaScore * 0.2 +
      fillRatioScore * 0.2 +
      backgroundContrastScore * 0.2 +
      rectangularityScore * 0.15 +
      edgeSupportScore * 0.15 +
      cropUsefulnessScore * 0.05 +
      aspectRatioScore * 0.05,
    0,
    1,
  )

  return {
    confidence,
    cropSavings,
    fillRatio,
    componentAreaRatio,
    rectAreaRatio,
    componentAreaScore,
    fillRatioScore,
    backgroundContrastScore,
    rectangularityScore,
    edgeSupportScore,
    cropUsefulnessScore,
    aspectRatioScore,
  }
}

function detectCropFromPageComponent(imageData) {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const gray = new Uint8ClampedArray(pixelCount)
  let graySum = 0
  let graySquares = 0

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value = luminance(data[i], data[i + 1], data[i + 2])
    gray[p] = value
    graySum += value
    graySquares += value * value
  }

  const grayMean = graySum / pixelCount
  const grayVariance = graySquares / pixelCount - grayMean * grayMean
  const grayStdDev = Math.sqrt(Math.max(0, grayVariance))
  const { magnitude, threshold: edgeThreshold } = createSobelEdges(
    gray,
    width,
    height,
  )
  const {
    mask,
    maskCount,
    threshold,
    borderMean,
    borderStdDev,
    borderLooksLikeBackground,
  } = createBrightnessMask(gray, width, height, grayMean, grayStdDev)
  const components = findPageComponents(mask, gray, width, height)

  if (maskCount < pixelCount * 0.004 || components.length === 0) {
    return {
      confidence: 0,
      cropRect: { x: 0, y: 0, width, height },
      reason: 'no-page-like-component',
      detail: {
        componentAreaScore: 0,
        fillRatioScore: 0,
        backgroundContrastScore: 0,
        rectangularityScore: 0,
        edgeSupportScore: 0,
        cropUsefulnessScore: 0,
        aspectRatioScore: 0,
        threshold,
        edgeThreshold,
        maskCount,
        borderMean,
        borderStdDev,
        borderLooksLikeBackground,
      },
    }
  }

  let best = null

  for (const component of components) {
    const score = scorePageComponent(component, {
      width,
      height,
      borderMean,
      edgeMagnitude: magnitude,
      edgeThreshold,
    })

    if (!best || score.confidence > best.score.confidence) {
      best = { component, score }
    }
  }

  const { component, score } = best
  const padX = Math.round(width * 0.045)
  const padY = Math.round(height * 0.045)
  const cropRect = {
    x: clamp(component.rect.x - padX, 0, width - 1),
    y: clamp(component.rect.y - padY, 0, height - 1),
    width: clamp(component.rect.width + padX * 2, 1, width),
    height: clamp(component.rect.height + padY * 2, 1, height),
  }

  cropRect.width = Math.min(cropRect.width, width - cropRect.x)
  cropRect.height = Math.min(cropRect.height, height - cropRect.y)

  const cropSavings = 1 - (cropRect.width * cropRect.height) / pixelCount
  const isDocumentCandidate =
    score.confidence >= DOCUMENT_CONFIDENCE_THRESHOLD

  return {
    confidence: score.confidence,
    cropRect,
    isDocumentCandidate,
    reason: isDocumentCandidate
      ? 'page-like-component-detected'
      : 'low-confidence-page-component',
    detail: {
      componentRect: component.rect,
      componentAreaRatio: score.componentAreaRatio,
      rectAreaRatio: score.rectAreaRatio,
      fillRatio: score.fillRatio,
      cropSavings,
      componentAreaScore: score.componentAreaScore,
      fillRatioScore: score.fillRatioScore,
      backgroundContrastScore: score.backgroundContrastScore,
      rectangularityScore: score.rectangularityScore,
      edgeSupportScore: score.edgeSupportScore,
      cropUsefulnessScore: score.cropUsefulnessScore,
      aspectRatioScore: score.aspectRatioScore,
      threshold,
      edgeThreshold,
      maskCount,
      componentCount: components.length,
      borderMean,
      borderStdDev,
      borderLooksLikeBackground,
      grayMean,
      grayStdDev,
    },
  }
}

async function detectDocumentCrop(bitmap) {
  const scale = Math.min(
    1,
    ANALYSIS_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  )
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Could not acquire analysis canvas context.')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)

  const analysisImageData = ctx.getImageData(0, 0, width, height)
  const analysis = detectCropFromPageComponent(analysisImageData)
  const perspective = detectPerspectiveFromAnalysis(analysisImageData, analysis)
  const scaledCorners = scalePoints(
    perspective.corners,
    bitmap.width / width,
    bitmap.height / height,
  )
  const sourceRect = scaleRect(
    analysis.cropRect,
    bitmap.width / width,
    bitmap.height / height,
  )
  const boundedSourceRect = {
    x: clamp(Math.round(sourceRect.x), 0, bitmap.width - 1),
    y: clamp(Math.round(sourceRect.y), 0, bitmap.height - 1),
    width: clamp(Math.round(sourceRect.width), 1, bitmap.width),
    height: clamp(Math.round(sourceRect.height), 1, bitmap.height),
  }

  boundedSourceRect.width = Math.min(
    boundedSourceRect.width,
    bitmap.width - boundedSourceRect.x,
  )
  boundedSourceRect.height = Math.min(
    boundedSourceRect.height,
    bitmap.height - boundedSourceRect.y,
  )

  const cropSavings =
    1 -
    (boundedSourceRect.width * boundedSourceRect.height) /
      (bitmap.width * bitmap.height)
  const isDocumentCandidate =
    analysis.confidence >= DOCUMENT_CONFIDENCE_THRESHOLD
  const shouldCrop =
    isDocumentCandidate && cropSavings >= MIN_CROP_SAVINGS_RATIO

  return {
    confidence: analysis.confidence,
    isDocumentCandidate,
    cropRect: boundedSourceRect,
    analysisRect: analysis.cropRect,
    analysisSize: { width, height },
    perspective: {
      ...perspective,
      corners: scaledCorners,
      analysisCorners: perspective.corners,
    },
    shouldCrop,
    reason: shouldCrop ? analysis.reason : analysis.reason || 'crop-skipped',
    detail: analysis.detail,
  }
}

function solveLinearSystem(matrix, values) {
  const size = values.length

  for (let column = 0; column < size; column++) {
    let pivot = column

    for (let row = column + 1; row < size; row++) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) {
        pivot = row
      }
    }

    if (Math.abs(matrix[pivot][column]) < 1e-10) {
      throw new Error('Homography matrix is singular.')
    }

    ;[matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]]
    ;[values[column], values[pivot]] = [values[pivot], values[column]]

    const divisor = matrix[column][column]
    for (let col = column; col < size; col++) {
      matrix[column][col] /= divisor
    }
    values[column] /= divisor

    for (let row = 0; row < size; row++) {
      if (row === column) continue

      const factor = matrix[row][column]
      for (let col = column; col < size; col++) {
        matrix[row][col] -= factor * matrix[column][col]
      }
      values[row] -= factor * values[column]
    }
  }

  return values
}

function homographyFromDestToSource(source, targetWidth, targetHeight) {
  const destination = [
    { x: 0, y: 0 },
    { x: targetWidth - 1, y: 0 },
    { x: targetWidth - 1, y: targetHeight - 1 },
    { x: 0, y: targetHeight - 1 },
  ]
  const matrix = []
  const values = []

  for (let i = 0; i < 4; i++) {
    const { x, y } = destination[i]
    const u = source[i].x
    const v = source[i].y

    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    values.push(u)
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    values.push(v)
  }

  const h = solveLinearSystem(matrix, values)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

function sampleBilinear(data, width, height, x, y) {
  const boundedX = clamp(x, 0, width - 1)
  const boundedY = clamp(y, 0, height - 1)
  const x0 = Math.floor(boundedX)
  const y0 = Math.floor(boundedY)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const dx = boundedX - x0
  const dy = boundedY - y0
  const topLeft = (y0 * width + x0) * 4
  const topRight = (y0 * width + x1) * 4
  const bottomLeft = (y1 * width + x0) * 4
  const bottomRight = (y1 * width + x1) * 4
  const result = [0, 0, 0, 0]

  for (let channel = 0; channel < 4; channel++) {
    const top =
      data[topLeft + channel] * (1 - dx) + data[topRight + channel] * dx
    const bottom =
      data[bottomLeft + channel] * (1 - dx) +
      data[bottomRight + channel] * dx
    result[channel] = Math.round(top * (1 - dy) + bottom * dy)
  }

  return result
}

function warpPerspective(sourceCanvas, corners) {
  const sourceWidth = sourceCanvas.width
  const sourceHeight = sourceCanvas.height
  const targetWidthRaw = Math.max(
    distance(corners[0], corners[1]),
    distance(corners[3], corners[2]),
  )
  const targetHeightRaw = Math.max(
    distance(corners[0], corners[3]),
    distance(corners[1], corners[2]),
  )
  const scale = Math.min(
    1,
    MAX_PROCESSING_EDGE / Math.max(targetWidthRaw, targetHeightRaw),
  )
  const targetWidth = Math.max(1, Math.round(targetWidthRaw * scale))
  const targetHeight = Math.max(1, Math.round(targetHeightRaw * scale))
  const homography = homographyFromDestToSource(
    corners,
    targetWidth,
    targetHeight,
  )
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const outputCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })

  if (!sourceCtx || !outputCtx) {
    throw new Error('Could not acquire canvas context for perspective warp.')
  }

  const sourceData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight)
  const outputData = outputCtx.createImageData(targetWidth, targetHeight)

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const denominator =
        homography[6] * x + homography[7] * y + homography[8]
      const sourceX = (homography[0] * x + homography[1] * y + homography[2]) /
        denominator
      const sourceY = (homography[3] * x + homography[4] * y + homography[5]) /
        denominator
      const pixel = sampleBilinear(
        sourceData.data,
        sourceWidth,
        sourceHeight,
        sourceX,
        sourceY,
      )
      const index = (y * targetWidth + x) * 4

      outputData.data[index] = pixel[0]
      outputData.data[index + 1] = pixel[1]
      outputData.data[index + 2] = pixel[2]
      outputData.data[index + 3] = pixel[3]
    }
  }

  outputCtx.putImageData(outputData, 0, 0)
  return outputCanvas
}

function createScaledBitmapCanvas(bitmap) {
  const scale = Math.min(
    1,
    MAX_PROCESSING_EDGE / Math.max(bitmap.width, bitmap.height),
  )
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Could not acquire source canvas context.')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)

  return { canvas, scale }
}

/**
 * Run enhancement and encode as JPEG for PDF embedding.
 * @param {ArrayBuffer} buffer
 * @param {string} label
 * @param {ReturnType<typeof createImageLogger>} logger
 */
async function enhanceImageToJpeg(buffer, label, logger) {
  const bytes = new Uint8Array(buffer)
  const format = detectImageFormat(bytes)

  if (!format) {
    throw new Error(`"${label}" is not a valid JPG, PNG, or WEBP image.`)
  }

  const bitmap = await logger.run(
    'createImageBitmap',
    async () => {
      const image = await createImageBitmap(
        new Blob([buffer], { type: mimeFromFormat(format) }),
      )
      return image
    },
    (image) => ({
      width: image.width,
      height: image.height,
      format,
    }),
  )

  try {
    let detection

    try {
      detection = await logger.run(
        'documentBoundaryDetection',
        async () => detectDocumentCrop(bitmap),
        (result) => ({
          confidence: Number(result.confidence.toFixed(3)),
          isDocumentCandidate: result.isDocumentCandidate,
          shouldCrop: result.shouldCrop,
          cropRect: result.cropRect,
          analysisRect: result.analysisRect,
          analysisSize: result.analysisSize,
          reason: result.reason,
          componentAreaScore: result.detail?.componentAreaScore,
          fillRatioScore: result.detail?.fillRatioScore,
          backgroundContrastScore: result.detail?.backgroundContrastScore,
          rectangularityScore: result.detail?.rectangularityScore,
          edgeSupportScore: result.detail?.edgeSupportScore,
          cropUsefulnessScore: result.detail?.cropUsefulnessScore,
          aspectRatioScore: result.detail?.aspectRatioScore,
          cropSavings: result.detail?.cropSavings,
          fillRatio: result.detail?.fillRatio,
          componentAreaRatio: result.detail?.componentAreaRatio,
          rectAreaRatio: result.detail?.rectAreaRatio,
          detectedCorners: result.perspective?.corners,
          beforeCorners: result.perspective?.corners,
          afterRectSize: result.perspective?.outputSize,
          stage2BConfidence:
            result.perspective?.confidence == null
              ? undefined
              : Number(result.perspective.confidence.toFixed(3)),
          lineSupportScore: result.perspective?.detail?.lineSupportScore,
          cornerGeometryScore:
            result.perspective?.detail?.cornerGeometryScore,
          convexityScore: result.perspective?.detail?.convexityScore,
          areaConsistencyScore:
            result.perspective?.detail?.areaConsistencyScore,
          perspectiveAspectRatioScore:
            result.perspective?.detail?.aspectRatioScore,
          perspectiveReason: result.perspective?.reason,
        }),
      )
    } catch (err) {
      detection = {
        confidence: 0,
        isDocumentCandidate: false,
        cropRect: { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
        shouldCrop: false,
        reason: 'detection-failed-stage1-fallback',
      }
      logger.log('documentBoundaryFallback', 'success', {
        confidence: 0,
        shouldCrop: false,
        cropRect: detection.cropRect,
        reason: detection.reason,
        error: errorMessage(err),
      })
    }

    const { ctx, width, height, selectedAction } = await logger.run(
      'offscreenCanvas',
      async () => {
        const perspective = detection.perspective

        if (perspective?.shouldPerspectiveCorrect && perspective.corners) {
          try {
            const { canvas: sourceCanvas, scale } = createScaledBitmapCanvas(
              bitmap,
            )
            const scaledCorners = perspective.corners.map((point) => ({
              x: point.x * scale,
              y: point.y * scale,
            }))
            const corrected = warpPerspective(sourceCanvas, scaledCorners)
            const correctedCtx = corrected.getContext('2d', {
              willReadFrequently: true,
            })

            if (!correctedCtx) {
              throw new Error('Could not acquire corrected canvas context.')
            }

            return {
              canvas: corrected,
              ctx: correctedCtx,
              width: corrected.width,
              height: corrected.height,
              cropApplied: false,
              selectedAction: 'perspectiveCorrected',
              warpApplied: true,
              warpOutputWidth: corrected.width,
              warpOutputHeight: corrected.height,
              beforeCorners: perspective.corners,
              afterRectSize: {
                width: corrected.width,
                height: corrected.height,
              },
            }
          } catch (err) {
            logger.log('perspectiveCorrectionFallback', 'success', {
              selectedAction: detection.shouldCrop
                ? 'stage2ACropFallback'
                : 'originalFallback',
              warpApplied: false,
              beforeCorners: perspective.corners,
              error: errorMessage(err),
            })
          }
        }

        const source = detection.shouldCrop
          ? detection.cropRect
          : { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
        const selectedAction = detection.shouldCrop
          ? 'stage2ACropFallback'
          : 'originalFallback'
        const scale = Math.min(
          1,
          MAX_PROCESSING_EDGE / Math.max(source.width, source.height),
        )
        const width = Math.max(1, Math.round(source.width * scale))
        const height = Math.max(1, Math.round(source.height * scale))
        const canvas = new OffscreenCanvas(width, height)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx) {
          throw new Error('Could not acquire 2d context from OffscreenCanvas.')
        }

        ctx.drawImage(
          bitmap,
          source.x,
          source.y,
          source.width,
          source.height,
          0,
          0,
          width,
          height,
        )
        return {
          canvas,
          ctx,
          width,
          height,
          cropApplied: detection.shouldCrop,
          selectedAction,
          warpApplied: false,
          warpOutputWidth: null,
          warpOutputHeight: null,
          beforeCorners: detection.perspective?.corners,
          afterRectSize: {
            width,
            height,
          },
        }
      },
      (result) => ({
        width: result.width,
        height: result.height,
        cropApplied: result.cropApplied,
        selectedAction: result.selectedAction,
        warpApplied: result.warpApplied,
        warpOutputWidth: result.warpOutputWidth,
        warpOutputHeight: result.warpOutputHeight,
        beforeCorners: result.beforeCorners,
        afterRectSize: result.afterRectSize,
      }),
    )

    if (selectedAction === 'perspectiveCorrected') {
      logger.log('Perspective correction applied successfully', 'success', {
        selectedAction,
        warpApplied: true,
        warpOutputWidth: width,
        warpOutputHeight: height,
      })
    }

    const imageData = await logger.run(
      'getImageData',
      async () => ctx.getImageData(0, 0, width, height),
      (data) => ({ width: data.width, height: data.height, length: data.data.length }),
    )

    await logger.run('reduceShadows', async () => {
      reduceShadows(imageData)
      return imageData
    })

    await logger.run('enhanceContrast', async () => {
      enhanceContrast(imageData)
      return imageData
    })

    const jpegBytes = await logger.run(
      'jpegEncode',
      async () => {
        const exportCanvas = new OffscreenCanvas(imageData.width, imageData.height)
        const exportCtx = exportCanvas.getContext('2d')

        if (!exportCtx) {
          throw new Error('Could not acquire 2d context for JPEG export canvas.')
        }

        exportCtx.putImageData(imageData, 0, 0)
        const blob = await exportCanvas.convertToBlob({
          type: 'image/jpeg',
          quality: JPEG_QUALITY,
        })

        if (!blob?.size) {
          throw new Error('JPEG encoding returned an empty blob.')
        }

        return new Uint8Array(await blob.arrayBuffer())
      },
      (encoded) => ({ byteLength: encoded.byteLength }),
    )

    return jpegBytes
  } finally {
    bitmap.close()
  }
}

/**
 * @param {import('pdf-lib').PDFDocument} pdf
 * @param {{ name: string, buffer: ArrayBuffer, index: number }} image
 * @param {ReturnType<typeof createImageLogger>} logger
 */
async function addCleanedPage(pdf, image, logger) {
  const { name, buffer, index } = image
  const label = name || `image ${index + 1}`

  if (!buffer?.byteLength) {
    throw new Error(`"${label}" is empty.`)
  }

  const jpegBytes = await enhanceImageToJpeg(buffer, label, logger)

  await logger.run(
    'pdfLibEmbed',
    async () => {
      await addA4ImageBytesPage(pdf, jpegBytes, label)
    },
    () => ({ pageCount: pdf.getPageCount() }),
  )
}

export const notesCleanerSession = {
  async start(jobId, payload = {}) {
    if (sessions.has(jobId)) {
      clearSession(jobId)
    }

    const session = {
      ...createSessionState(payload.count ?? 0),
      pdf: await PDFDocument.create(),
    }
    sessions.set(jobId, session)

    console.log(
      `[NotesCleaner] job=${jobId} session started expectedCount=${session.expectedCount}`,
    )
    postWorkerLog(jobId, {
      step: 'session',
      status: 'start',
      detail: { expectedCount: session.expectedCount },
    })
  },

  async append(jobId, payload) {
    const session = sessions.get(jobId)
    if (!session) {
      throw new Error(
        `Notes Cleaner session not found for job ${jobId}. START may not have run yet.`,
      )
    }

    const label = payload.name || `image ${payload.index + 1}`
    const logger = createImageLogger(jobId, label, (entry) =>
      postWorkerLog(jobId, entry),
    )

    session.appendReceived += 1
    session.appendInProgress = true

    console.log(
      `[NotesCleaner] job=${jobId} append #${session.appendReceived} image="${label}" bufferBytes=${payload.buffer?.byteLength ?? 0}`,
    )
    postWorkerLog(jobId, {
      step: 'append',
      status: 'start',
      detail: {
        index: payload.index,
        name: label,
        bufferBytes: payload.buffer?.byteLength ?? 0,
      },
    })

    try {
      await addCleanedPage(session.pdf, payload, logger)
      session.appendSucceeded += 1
      session.pageCount += 1
      session.lastImageLogs = logger.entries

      postWorkerLog(jobId, {
        step: 'append',
        status: 'success',
        detail: { index: payload.index, pageCount: session.pageCount },
      })
    } catch (err) {
      const message = errorMessage(err)
      session.appendFailures += 1
      session.lastAppendError = message
      session.lastImageLogs = logger.entries

      console.error(
        `[NotesCleaner] job=${jobId} append failed image="${label}": ${message}`,
      )
      postWorkerLog(jobId, {
        step: 'append',
        status: 'failure',
        detail: { index: payload.index, error: message, steps: logger.entries },
      })

      clearSession(jobId)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      session.appendInProgress = false
    }
  },

  async finish(jobId) {
    const session = sessions.get(jobId)

    if (!session) {
      throw new Error(
        `Notes Cleaner session not found for job ${jobId}. It may have been cancelled by a failed APPEND.`,
      )
    }

    console.log(
      `[NotesCleaner] job=${jobId} finish pageCount=${session.pageCount} appendReceived=${session.appendReceived}`,
    )
    postWorkerLog(jobId, {
      step: 'finish',
      status: 'start',
      detail: {
        pageCount: session.pageCount,
        appendReceived: session.appendReceived,
        appendSucceeded: session.appendSucceeded,
        appendInProgress: session.appendInProgress,
      },
    })

    if (session.pageCount === 0) {
      const diagnostic = buildFinishDiagnostic(session)
      clearSession(jobId)
      throw new Error(diagnostic)
    }

    try {
      const bytes = await session.pdf.save()
      clearSession(jobId)
      return { bytes, transfer: [bytes.buffer] }
    } catch (err) {
      clearSession(jobId)
      throw new Error(`pdf.save failed: ${errorMessage(err)}`, { cause: err })
    }
  },

  cancel(jobId) {
    console.warn(`[NotesCleaner] job=${jobId} session cancelled`)
    postWorkerLog(jobId, { step: 'session', status: 'cancelled', detail: {} })
    clearSession(jobId)
  },
}
