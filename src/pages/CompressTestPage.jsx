import { useState } from 'react'
import { usePdfCompression } from '../hooks/usePdfCompression.js'

const LEVELS = [
  { value: 'low', label: 'Low', quality: '85' },
  { value: 'medium', label: 'Medium', quality: '70' },
  { value: 'high', label: 'High', quality: '50' },
]

const CLASSIFICATION_LABELS = {
  imageHeavy: 'Image-heavy PDF detected',
  textHeavy: 'Text-heavy PDF detected',
  mixed: 'Mixed-content PDF detected',
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatRatio(value) {
  if (typeof value !== 'number') return 'n/a'
  return `${Math.round((1 - value) * 100)}% smaller`
}

function classificationLabel(classification) {
  return CLASSIFICATION_LABELS[classification] ?? classification ?? 'n/a'
}

function compressionStatusLabel(diagnostics) {
  if (diagnostics.compressionSkipped) return 'Compression skipped'
  if (diagnostics.compressionApplied) return 'Compression applied'
  if (diagnostics.usedOriginal) return 'Compression skipped'
  return 'Compression applied'
}

export default function CompressTestPage({ onBack }) {
  const [file, setFile] = useState(null)
  const [level, setLevel] = useState('medium')
  const {
    compress,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfCompression()

  function handleFileChange(event) {
    reset()
    setFile(event.target.files?.[0] ?? null)
  }

  async function handleCompress() {
    try {
      await compress(file, { level })
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  const statusColor =
    diagnostics?.compressionSkipped || diagnostics?.usedOriginal
      ? '#fbbf24'
      : '#4ade80'

  return (
    <section style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
        PDF Compression
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        V1 compresses image-only JPEG PDFs. V2 rasterizes image-heavy and mixed
        PDFs. Text-heavy PDFs are returned unchanged.
      </p>

      {onBack && (
        <button type="button" onClick={onBack} style={{ marginTop: 12 }}>
          Back
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          {file.name} ({formatBytes(file.size)})
        </p>
      )}

      <fieldset
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 12,
          border: 0,
          padding: 0,
        }}
      >
        {LEVELS.map((item) => (
          <label key={item.value} style={{ fontSize: 14 }}>
            <input
              type="radio"
              name="compression-level"
              value={item.value}
              checked={level === item.value}
              onChange={() => setLevel(item.value)}
              disabled={isLoading}
            />{' '}
            {item.label} ({item.quality})
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        onClick={handleCompress}
        disabled={isLoading || !file}
        style={{ marginTop: 16 }}
      >
        {isLoading ? 'Compressing in worker...' : 'Compress & download'}
      </button>

      {isSuccess && diagnostics && (
        <div style={{ marginTop: 12, fontSize: 14, color: statusColor }}>
          <p>
            {compressionStatusLabel(diagnostics)} — download should have started.
          </p>

          {diagnostics.pdfClassification && (
            <p style={{ marginTop: 8, fontWeight: 600 }}>
              {classificationLabel(diagnostics.pdfClassification)}
            </p>
          )}

          <dl style={{ marginTop: 8 }}>
            <dt>PDF classification</dt>
            <dd>{diagnostics.pdfClassification ?? 'n/a'}</dd>
            <dt>Compression status</dt>
            <dd>{compressionStatusLabel(diagnostics)}</dd>
            <dt>Mode used</dt>
            <dd>{diagnostics.modeUsed ?? 'V1'}</dd>
            <dt>Pages processed</dt>
            <dd>{diagnostics.pageCount ?? 0}</dd>
            <dt>Original size</dt>
            <dd>{formatBytes(diagnostics.originalSize)}</dd>
            <dt>Compressed size</dt>
            <dd>{formatBytes(diagnostics.compressedSize)}</dd>
            <dt>Compression ratio</dt>
            <dd>{formatRatio(diagnostics.compressionRatio)}</dd>
            {diagnostics.modeUsed === 'V2' && (
              <>
                <dt>Render scale</dt>
                <dd>{diagnostics.renderScale ?? 'n/a'}</dd>
                <dt>JPEG quality</dt>
                <dd>{diagnostics.jpegQuality ?? diagnostics.quality ?? 'n/a'}</dd>
                <dt>Average page image</dt>
                <dd>
                  {diagnostics.averagePageImageKB != null
                    ? `${diagnostics.averagePageImageKB} KB`
                    : 'n/a'}
                </dd>
                <dt>Total embedded JPEG</dt>
                <dd>
                  {diagnostics.totalEmbeddedJpegBytes != null
                    ? formatBytes(diagnostics.totalEmbeddedJpegBytes)
                    : 'n/a'}
                </dd>
                <dt>Average render dimensions</dt>
                <dd>
                  {diagnostics.averageRenderWidth != null &&
                  diagnostics.averageRenderHeight != null
                    ? `${diagnostics.averageRenderWidth} × ${diagnostics.averageRenderHeight} px`
                    : 'n/a'}
                </dd>
                <dt>Rebuilt PDF size (before comparison)</dt>
                <dd>
                  {diagnostics.rebuiltPdfSizeKB != null
                    ? `${diagnostics.rebuiltPdfSizeKB} KB`
                    : 'n/a'}
                </dd>
                <dt>Final compression ratio (rebuilt vs original)</dt>
                <dd>
                  {diagnostics.finalCompressionRatio != null
                    ? formatRatio(diagnostics.finalCompressionRatio)
                    : 'n/a'}
                </dd>
              </>
            )}
            <dt>Processing time</dt>
            <dd>{diagnostics.processingTime ?? diagnostics.processingTimeMs} ms</dd>
            <dt>Result</dt>
            <dd>{diagnostics.reason}</dd>
          </dl>
        </div>
      )}

      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 14, color: '#f87171' }}>
          {error}
        </p>
      )}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
        Status: {status}
      </p>
    </section>
  )
}
