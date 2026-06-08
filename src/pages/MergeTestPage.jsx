import { useRef, useState } from 'react'
import { usePdfMerge } from '../hooks/usePdfMerge.js'

export default function MergeTestPage({ onBack }) {
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const { merge, reset, status, error, isLoading, isSuccess } = usePdfMerge()

  function handleFileChange(event) {
    reset()
    const selected = Array.from(event.target.files ?? [])
    setFiles(selected)
  }

  async function handleMerge() {
    try {
      await merge(files)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  return (
    <section style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Merge PDF (test)</h1>
      <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        Select two or more PDFs. Merging runs in a Web Worker; the UI stays
        responsive.
      </p>

      {onBack && (
        <button type="button" onClick={onBack} style={{ marginTop: 12 }}>
          Back
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {files.length > 0 && (
        <ol style={{ marginTop: 12, paddingLeft: 20, fontSize: 14 }}>
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              {file.name} ({Math.round(file.size / 1024)} KB)
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={handleMerge}
        disabled={isLoading || files.length < 1}
        style={{ marginTop: 16 }}
      >
        {isLoading ? 'Merging in worker…' : 'Merge & download'}
      </button>

      {isSuccess && (
        <p style={{ marginTop: 12, fontSize: 14, color: '#4ade80' }}>
          Merge complete — download should have started.
        </p>
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
