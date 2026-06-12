/**
 * Browser-based V2 rasterization test using Playwright.
 * Verifies renderScale and jpegQuality actually change canvas output.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { chromium } from 'playwright'

const __dir = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dir, 'fixtures')
mkdirSync(FIXTURES, { recursive: true })

const SCALE_BY_LEVEL = { low: 2.0, medium: 1.5, high: 1.0 }
const QUALITY_BY_LEVEL = { low: 0.85, medium: 0.7, high: 0.5 }

async function createTextPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let p = 0; p < 3; p++) {
    const page = doc.addPage([612, 792])
    for (let line = 0; line < 35; line++) {
      page.drawText(
        `Page ${p + 1} line ${line + 1}: Diagnostic rasterization test content.`,
        { x: 50, y: 750 - line * 18, size: 11, font, color: rgb(0, 0, 0) },
      )
    }
  }
  return await doc.save()
}

async function createScannedStylePdf() {
  const doc = await PDFDocument.create()
  const canvas = await createNoiseJpeg(800, 1000, 0.9)
  const embedded = await doc.embedJpg(canvas)
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([612, 792])
    page.drawImage(embedded, { x: 0, y: 0, width: 612, height: 792 })
  }
  return await doc.save()
}

async function createMixedPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const jpeg = await createNoiseJpeg(400, 300, 0.85)
  const embedded = await doc.embedJpg(jpeg)

  const textPage = doc.addPage([612, 792])
  for (let line = 0; line < 25; line++) {
    textPage.drawText(`Mixed PDF text line ${line + 1}`, {
      x: 50,
      y: 750 - line * 22,
      size: 12,
      font,
    })
  }

  const imagePage = doc.addPage([612, 792])
  imagePage.drawImage(embedded, { x: 50, y: 400, width: 400, height: 300 })

  return await doc.save()
}

/** Build a real JPEG via Playwright canvas (noise = scan-like) */
async function createNoiseJpeg(width, height, quality) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const bytes = await page.evaluate(
    async ({ width, height, quality }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(width, height)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const v = Math.floor(Math.random() * 256)
        imageData.data[i] = v
        imageData.data[i + 1] = v
        imageData.data[i + 2] = v
        imageData.data[i + 3] = 255
      }
      ctx.putImageData(imageData, 0, 0)
      const blob = await new Promise((r) =>
        canvas.toBlob(r, 'image/jpeg', quality),
      )
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    },
    { width, height, quality },
  )
  await browser.close()
  return Uint8Array.from(bytes)
}

async function rasterizeInBrowser(pdfBytes, label) {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const results = await page.evaluate(
    async ({ pdfBytes, SCALE_BY_LEVEL, QUALITY_BY_LEVEL }) => {
      const pdfjsLib = await import(
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
      )
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'

      async function rasterize(pdfBytes, level) {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise
        const renderScale = SCALE_BY_LEVEL[level]
        const jpegQuality = QUALITY_BY_LEVEL[level]
        let totalJpegBytes = 0
        let totalW = 0
        let totalH = 0
        const numPages = pdf.numPages

        for (let i = 1; i <= numPages; i++) {
          const pg = await pdf.getPage(i)
          const viewport = pg.getViewport({ scale: renderScale })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          await pg.render({ canvasContext: ctx, viewport }).promise
          const blob = await new Promise((r) =>
            canvas.toBlob(r, 'image/jpeg', jpegQuality),
          )
          const bytes = new Uint8Array(await blob.arrayBuffer())
          totalJpegBytes += bytes.byteLength
          totalW += viewport.width
          totalH += viewport.height
        }

        return {
          level,
          renderScale,
          jpegQuality,
          pageCount: numPages,
          averageRenderWidth: Math.round(totalW / numPages),
          averageRenderHeight: Math.round(totalH / numPages),
          averagePageImageKB:
            Math.round((totalJpegBytes / numPages) / 1024 * 100) / 100,
          totalEmbeddedJpegBytes: totalJpegBytes,
        }
      }

      const out = []
      for (const level of ['low', 'medium', 'high']) {
        out.push(await rasterize(pdfBytes, level))
      }
      return out
    },
    {
      pdfBytes: Array.from(pdfBytes),
      SCALE_BY_LEVEL,
      QUALITY_BY_LEVEL,
    },
  )

  await browser.close()
  return { label, results }
}

async function runV2Assembly(originalBytes, rasterResults, levelIndex) {
  const { compressPdf } = await import('../src/workers/handlers/compressPdf.js')
  const level = ['low', 'medium', 'high'][levelIndex]
  const r = rasterResults[levelIndex]

  // Re-rasterize to get actual JPEG bytes for assembly test
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const assembly = await page.evaluate(
    async ({ pdfBytes, level, SCALE_BY_LEVEL, QUALITY_BY_LEVEL }) => {
      const pdfjsLib = await import(
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
      )
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'

      const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise
      const renderScale = SCALE_BY_LEVEL[level]
      const jpegQuality = QUALITY_BY_LEVEL[level]
      const images = []

      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i)
        const viewport = pg.getViewport({ scale: renderScale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        await pg.render({ canvasContext: ctx, viewport }).promise
        const blob = await new Promise((res) =>
          canvas.toBlob(res, 'image/jpeg', jpegQuality),
        )
        const bytes = new Uint8Array(await blob.arrayBuffer())
        images.push({
          bytes: Array.from(bytes),
          width: viewport.width,
          height: viewport.height,
        })
      }

      return images
    },
    {
      pdfBytes: Array.from(originalBytes),
      level,
      SCALE_BY_LEVEL,
      QUALITY_BY_LEVEL,
    },
  )
  await browser.close()

  const images = assembly.map((img) => ({
    bytes: Uint8Array.from(img.bytes),
    width: img.width,
    height: img.height,
  }))

  const totalJpegBytes = images.reduce((s, img) => s + img.bytes.byteLength, 0)
  const rasterDiagnostics = {
    renderScale: r.renderScale,
    jpegQuality: r.jpegQuality,
    pageCount: images.length,
    averageRenderWidth: r.averageRenderWidth,
    averageRenderHeight: r.averageRenderHeight,
    averagePageImageKB: r.averagePageImageKB,
    totalEmbeddedJpegBytes: totalJpegBytes,
  }

  const result = await compressPdf({
    buffer: originalBytes,
    level,
    images,
    rasterDiagnostics,
  })

  return {
    level,
    originalSizeKB: Math.round(originalBytes.byteLength / 1024 * 100) / 100,
    ...result.diagnostics,
  }
}

async function main() {
  const textPdf = await createTextPdf()
  const scannedPdf = await createScannedStylePdf()
  const mixedPdf = await createMixedPdf()

  writeFileSync(join(FIXTURES, 'browser-text.pdf'), textPdf)
  writeFileSync(join(FIXTURES, 'browser-scanned.pdf'), scannedPdf)
  writeFileSync(join(FIXTURES, 'browser-mixed.pdf'), mixedPdf)

  console.log('\n=== PDF sizes (KB) ===')
  console.log({
    text: Math.round(textPdf.byteLength / 1024 * 100) / 100,
    scanned: Math.round(scannedPdf.byteLength / 1024 * 100) / 100,
    mixed: Math.round(mixedPdf.byteLength / 1024 * 100) / 100,
  })

  for (const [label, bytes] of [
    ['text-heavy', textPdf],
    ['scanned', scannedPdf],
    ['mixed', mixedPdf],
  ]) {
    const { results } = await rasterizeInBrowser(bytes, label)
    console.log(`\n=== Raster diagnostics: ${label} ===`)
    console.log(JSON.stringify(results, null, 2))

    const assemblyHigh = await runV2Assembly(bytes, results, 2)
    const assemblyMedium = await runV2Assembly(bytes, results, 1)
    console.log(`\n=== V2 assembly (${label}) medium/high ===`)
    console.log(
      JSON.stringify(
        [
          {
            level: assemblyMedium.level,
            rebuiltPdfSizeKB: assemblyMedium.rebuiltPdfSizeKB,
            usedOriginal: assemblyMedium.usedOriginal,
            reason: assemblyMedium.reason,
            finalCompressionRatio: assemblyMedium.finalCompressionRatio,
          },
          {
            level: assemblyHigh.level,
            rebuiltPdfSizeKB: assemblyHigh.rebuiltPdfSizeKB,
            usedOriginal: assemblyHigh.usedOriginal,
            reason: assemblyHigh.reason,
            finalCompressionRatio: assemblyHigh.finalCompressionRatio,
          },
        ],
        null,
        2,
      ),
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
