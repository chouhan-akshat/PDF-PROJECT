import { useCallback, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import { compressPdfFile } from '../utils/pdfWorkerClient.js'

const RENDER_SCALE_BY_LEVEL = {
  low: 1.0,
  medium: 0.8,
  high: 0.6,
}

const QUALITY_BY_LEVEL = {
  low: 0.85,
  medium: 0.7,
  high: 0.5,
}

const V2_ELIGIBLE_CLASSIFICATIONS = new Set(['imageHeavy', 'mixed'])

export function usePdfCompression() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setDiagnostics(null)
  }, [])

  const compress = useCallback(async (file, options = {}) => {
    const { download = true, filename, level = 'medium' } = options

    setStatus('loading')
    setError(null)
    setDiagnostics(null)

    try {
      // 1. Try V1 first (fast path)
      let result = await compressPdfFile(file, { level })

      // If V1 returns usedOriginal because it is unsupported, classify and maybe V2
      if (
        result.diagnostics?.usedOriginal &&
        result.diagnostics?.reason?.includes('Unsupported')
      ) {
        const classification = result.diagnostics.pdfClassification
        const classificationSignals = result.diagnostics.classificationSignals

        if (classification === 'textHeavy') {
          const skipDiagnostics = {
            ...result.diagnostics,
            modeUsed: 'original',
            reason: 'text-heavy PDF not suitable for raster compression',
            compressionSkipped: true,
            compressionApplied: false,
            pageCount:
              classificationSignals?.pageCount ??
              result.diagnostics.pageCount ??
              0,
          }

          const outputName =
            filename ??
            `compressed-${new Date().toISOString().slice(0, 10)}.pdf`

          if (download) {
            downloadPdfBytes(result.bytes, outputName)
          }

          setDiagnostics(skipDiagnostics)
          setStatus('success')
          return { bytes: result.bytes, diagnostics: skipDiagnostics }
        }

        if (!V2_ELIGIBLE_CLASSIFICATIONS.has(classification)) {
          throw new Error(
            `Unsupported PDF classification for compression: ${classification ?? 'unknown'}`,
          )
        }

        setStatus('rasterizing')

        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()

        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
        const pdf = await loadingTask.promise
        const numPages = pdf.numPages

        const renderScale = RENDER_SCALE_BY_LEVEL[level] ?? 0.8
        const jpegQuality = QUALITY_BY_LEVEL[level] ?? 0.7
        const images = []
        let totalJpegBytes = 0
        let totalRenderWidth = 0
        let totalRenderHeight = 0

        for (let i = 1; i <= numPages; i++) {
          setStatus(`rendering_page_${i}_of_${numPages}`)
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: renderScale })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const context = canvas.getContext('2d')

          if (!context) {
            throw new Error(`Failed to get 2D context for page ${i}`)
          }

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise

          const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', jpegQuality)
          })

          if (blob) {
            const bytes = new Uint8Array(await blob.arrayBuffer())
            totalJpegBytes += bytes.byteLength
            totalRenderWidth += viewport.width
            totalRenderHeight += viewport.height
            images.push({
              bytes,
              width: viewport.width,
              height: viewport.height,
            })
          }
        }

        const rasterDiagnostics = {
          renderScale,
          jpegQuality,
          pageCount: numPages,
          averageRenderWidth:
            numPages > 0 ? Math.round(totalRenderWidth / numPages) : 0,
          averageRenderHeight:
            numPages > 0 ? Math.round(totalRenderHeight / numPages) : 0,
          averagePageImageKB:
            numPages > 0
              ? Math.round((totalJpegBytes / numPages) / 1024 * 100) / 100
              : 0,
          totalEmbeddedJpegBytes: totalJpegBytes,
        }

        setStatus('assembling')
        result = await compressPdfFile(file, {
          level,
          images,
          rasterDiagnostics,
          pdfClassification: classification,
          classificationSignals,
        })

        result.diagnostics = {
          ...result.diagnostics,
          pdfClassification: classification,
          classificationSignals,
        }
      }

      const outputName =
        filename ?? `compressed-${new Date().toISOString().slice(0, 10)}.pdf`

      if (download) {
        downloadPdfBytes(result.bytes, outputName)
      }

      setDiagnostics(result.diagnostics)
      setStatus('success')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus('error')
      throw err
    }
  }, [])

  return {
    compress,
    reset,
    status,
    error,
    diagnostics,
    isLoading: status !== 'idle' && status !== 'success' && status !== 'error',
    isSuccess: status === 'success',
  }
}
