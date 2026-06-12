import { useState } from 'react'
import { usePdfSplit } from '../hooks/usePdfSplit.js'

export default function SplitTestPage({ onBack }) {
  const [file, setFile] = useState(null)
  const {
    split,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfSplit()

  function handleFileChange(event) {
    reset()
    setFile(event.target.files?.[0] ?? null)
  }

  async function handleSplit() {
    try {
      await split(file)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  return (
    <section style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Split PDF (V1)</h1>
      <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        Splits every page into its own PDF and downloads a ZIP archive. Processing
        runs fully client-side in a Web Worker.
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
          {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
      )}

      <button
        type="button"
        onClick={handleSplit}
        disabled={isLoading || !file}
        style={{ marginTop: 16 }}
      >
        {isLoading ? 'Splitting in worker…' : 'Split PDF'}
      </button>

      {isSuccess && diagnostics && (
        <div style={{ marginTop: 12, fontSize: 14, color: '#4ade80' }}>
          <p>Split complete — ZIP download should have started.</p>
          <dl style={{ marginTop: 8 }}>
            <dt>Page count</dt>
            <dd>{diagnostics.pageCount}</dd>
            <dt>Generated files</dt>
            <dd>{diagnostics.generatedFiles}</dd>
            <dt>ZIP size</dt>
            <dd>{diagnostics.zipSizeKB} KB</dd>
            <dt>Processing time</dt>
            <dd>{diagnostics.processingTimeMs} ms</dd>
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
