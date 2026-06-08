import { useState } from 'react'
import { useNotesCleaner } from '../hooks/useNotesCleaner.js'

export default function NotesCleanerTestPage({ onBack }) {
  const [files, setFiles] = useState([])
  const { clean, reset, status, error, logs, isLoading, isSuccess } =
    useNotesCleaner()

  function handleFileChange(event) {
    reset()
    const selected = Array.from(event.target.files ?? [])
    setFiles(selected)
  }

  async function handleClean() {
    try {
      await clean(files)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  return (
    <section style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
        Notes Cleaner (stage 1)
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        Shadow reduction + contrast enhancement → A4 PDF. No boundary detection
        or perspective correction yet. Processing runs sequentially in the worker.
      </p>

      {onBack && (
        <button type="button" onClick={onBack} style={{ marginTop: 12 }}>
          Back
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          capture="environment"
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
        onClick={handleClean}
        disabled={isLoading || files.length < 1}
        style={{ marginTop: 16 }}
      >
        {isLoading ? 'Cleaning in worker…' : 'Clean & export PDF'}
      </button>

      {isSuccess && (
        <p style={{ marginTop: 12, fontSize: 14, color: '#4ade80' }}>
          Cleaned PDF ready — download should have started.
        </p>
      )}

      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 14, color: '#f87171' }}>
          {error}
        </p>
      )}

      {logs.length > 0 && (
        <details style={{ marginTop: 12, fontSize: 12 }} open={Boolean(error)}>
          <summary>Worker diagnostics ({logs.length} entries)</summary>
          <pre
            style={{
              marginTop: 8,
              maxHeight: 240,
              overflow: 'auto',
              padding: 8,
              background: '#111',
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {logs
              .map((entry) => {
                const detail =
                  entry.detail && Object.keys(entry.detail).length > 0
                    ? ` ${JSON.stringify(entry.detail)}`
                    : ''
                return `${entry.step ?? 'log'} ${entry.status ?? ''}${detail}`
              })
              .join('\n')}
          </pre>
        </details>
      )}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
        Status: {status}
      </p>
    </section>
  )
}
