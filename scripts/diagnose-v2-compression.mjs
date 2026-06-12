/**
 * V2 compression diagnostic runner (Node).
 * Creates test PDFs, exercises worker assembly, and simulates level settings.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { compressPdf } from '../src/workers/handlers/compressPdf.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dir, 'fixtures')
mkdirSync(FIXTURES, { recursive: true })

const SCALE_BY_LEVEL = { low: 2.0, medium: 1.5, high: 1.0 }
const QUALITY_BY_LEVEL = { low: 0.85, medium: 0.7, high: 0.5 }

function log(title, data) {
  console.log(`\n=== ${title} ===`)
  console.log(JSON.stringify(data, null, 2))
}

async function createTextHeavyPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let p = 0; p < 5; p++) {
    const page = doc.addPage([612, 792])
    for (let line = 0; line < 40; line++) {
      page.drawText(
        `Page ${p + 1} line ${line + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
        { x: 50, y: 750 - line * 18, size: 11, font, color: rgb(0, 0, 0) },
      )
    }
  }
  const bytes = await doc.save()
  const path = join(FIXTURES, 'text-heavy.pdf')
  writeFileSync(path, bytes)
  return { path, bytes, type: 'text-heavy' }
}

async function createScannedPdf(pageCount = 3) {
  const doc = await PDFDocument.create()
  // Minimal valid JPEG (1x1 red pixel)
  const tinyJpeg = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xf1, 0x5e, 0xb5,
    0xff, 0xd9,
  ])

  for (let i = 0; i < pageCount; i++) {
    const embedded = await doc.embedJpg(tinyJpeg)
    const page = doc.addPage([612, 792])
    page.drawImage(embedded, { x: 0, y: 0, width: 612, height: 792 })
  }
  const bytes = await doc.save()
  const path = join(FIXTURES, 'scanned.pdf')
  writeFileSync(path, bytes)
  return { path, bytes, type: 'scanned' }
}

async function createMixedPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const tinyJpeg = readFileSync(join(FIXTURES, 'scanned.pdf'))
  const scannedDoc = await PDFDocument.load(tinyJpeg)
  const [embeddedPage] = await doc.copyPages(scannedDoc, [0])

  const textPage = doc.addPage([612, 792])
  for (let line = 0; line < 30; line++) {
    textPage.drawText(`Mixed content text line ${line + 1}`, {
      x: 50,
      y: 750 - line * 22,
      size: 12,
      font,
    })
  }

  const copied = await doc.addPage(embeddedPage)
  copied.drawText('Overlay text on image page', { x: 50, y: 700, size: 14, font })

  const bytes = await doc.save()
  const path = join(FIXTURES, 'mixed.pdf')
  writeFileSync(path, bytes)
  return { path, bytes, type: 'mixed' }
}

async function runV1Test(pdf) {
  const result = await compressPdf({
    buffer: pdf.bytes,
    level: 'high',
    name: pdf.type,
  })
  return {
    type: pdf.type,
    mode: 'V1',
    ...result.diagnostics,
  }
}

async function runV2AssemblyTest(pdf, level, images) {
  const totalJpegBytes = images.reduce((s, img) => s + img.bytes.byteLength, 0)
  const rasterDiagnostics = {
    renderScale: SCALE_BY_LEVEL[level],
    jpegQuality: QUALITY_BY_LEVEL[level],
    pageCount: images.length,
    averageRenderWidth:
      images.length > 0
        ? Math.round(images.reduce((s, img) => s + img.width, 0) / images.length)
        : 0,
    averageRenderHeight:
      images.length > 0
        ? Math.round(images.reduce((s, img) => s + img.height, 0) / images.length)
        : 0,
    averagePageImageKB:
      images.length > 0
        ? Math.round((totalJpegBytes / images.length) / 1024 * 100) / 100
        : 0,
    totalEmbeddedJpegBytes: totalJpegBytes,
  }

  const result = await compressPdf({
    buffer: pdf.bytes,
    level,
    name: pdf.type,
    images,
    rasterDiagnostics,
  })

  return {
    type: pdf.type,
    level,
    ...result.diagnostics,
  }
}

/** Simulate rasterized pages at different scales using repeated JPEG payload */
function mockRasterizedPages(pageCount, width, height, jpegBytesPerPage) {
  const baseJpeg = new Uint8Array(jpegBytesPerPage)
  baseJpeg.fill(0xab)
  return Array.from({ length: pageCount }, () => ({
    bytes: baseJpeg.slice(),
    width,
    height,
  }))
}

async function main() {
  log('Level settings in code', {
    SCALE_BY_LEVEL,
    QUALITY_BY_LEVEL,
    note: 'User expected renderScale ~1.0/0.8/0.6; code uses pdfjs viewport scale 2.0/1.5/1.0',
  })

  const textPdf = await createTextHeavyPdf()
  const scannedPdf = await createScannedPdf(5)
  await createMixedPdf()

  log('Test PDF sizes', {
    textHeavy: textPdf.bytes.byteLength,
    scanned: scannedPdf.bytes.byteLength,
    mixed: readFileSync(join(FIXTURES, 'mixed.pdf')).byteLength,
  })

  const v1Scanned = await runV1Test(scannedPdf)
  const v1Text = await runV1Test(textPdf)
  log('V1 scanned PDF', v1Scanned)
  log('V1 text PDF (should be unsupported → V2 path in app)', v1Text)

  const levels = ['low', 'medium', 'high']
  const v2ScaleTests = []

  for (const level of levels) {
    const scale = SCALE_BY_LEVEL[level]
    const w = Math.round(612 * scale)
    const h = Math.round(792 * scale)
  // Approximate JPEG size scaling with pixel count and quality
    const approxJpegPerPage = Math.round(w * h * 0.08 * QUALITY_BY_LEVEL[level])
    const images = mockRasterizedPages(5, w, h, approxJpegPerPage)
    v2ScaleTests.push(await runV2AssemblyTest(textPdf, level, images))
  }

  log('V2 assembly by level (mock rasterized text PDF)', v2ScaleTests)

  const levelComparison = v2ScaleTests.map((r) => ({
    level: r.level,
    renderScale: r.renderScale,
    jpegQuality: r.jpegQuality,
    averageRenderWidth: r.averageRenderWidth,
    averageRenderHeight: r.averageRenderHeight,
    averagePageImageKB: r.averagePageImageKB,
    rebuiltPdfSizeKB: r.rebuiltPdfSizeKB,
    usedOriginal: r.usedOriginal,
    finalCompressionRatio: r.finalCompressionRatio,
  }))
  log('Level comparison summary', levelComparison)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
