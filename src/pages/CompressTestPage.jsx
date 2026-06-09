import { useState } from 'react'
import { usePdfCompression } from '../hooks/usePdfCompression.js'

const LEVELS = [
  { value: 'low', label: 'Low', quality: '85' },
  { value: 'medium', label: 'Medium', quality: '70' },
  { value: 'high', label: 'High', quality: '50' },
]

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatRatio(value) {
  if (typeof value !== 'number') return 'n/a'
  return `${Math.round((1 - value) * 100)}% smaller`
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

  return (
    <section style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
        PDF Compression (V1)
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        Compresses supported image-based PDFs in a Web Worker. Unsupported PDFs
        are returned unchanged.
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
        <div style={{ marginTop: 12, fontSize: 14, color: '#4ade80' }}>
          <p>Compression complete - download should have started.</p>
          <dl style={{ marginTop: 8 }}>
            <dt>Original size</dt>
            <dd>{formatBytes(diagnostics.originalSize)}</dd>
            <dt>Compressed size</dt>
            <dd>{formatBytes(diagnostics.compressedSize)}</dd>
            <dt>Compression ratio</dt>
            <dd>{formatRatio(diagnostics.compressionRatio)}</dd>
            <dt>Processing time</dt>
            <dd>{diagnostics.processingTimeMs} ms</dd>
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
