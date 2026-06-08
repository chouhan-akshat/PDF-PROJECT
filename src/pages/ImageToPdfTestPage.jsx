import { useState } from 'react'
import { useImageToPdf } from '../hooks/useImageToPdf.js'

export default function ImageToPdfTestPage({ onBack }) {
  const [files, setFiles] = useState([])
  const { convert, reset, status, error, isLoading, isSuccess } = useImageToPdf()

  function handleFileChange(event) {
    reset()
    const selected = Array.from(event.target.files ?? [])
    setFiles(selected)
  }

  async function handleConvert() {
    try {
      await convert(files)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  return (
    <section style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
        Image to PDF (test)
      </h1>
      <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        JPG, JPEG, PNG, WEBP — one or many. Images are read and processed
        sequentially in the worker.
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
        onClick={handleConvert}
        disabled={isLoading || files.length < 1}
        style={{ marginTop: 16 }}
      >
        {isLoading ? 'Converting in worker…' : 'Create PDF & download'}
      </button>

      {isSuccess && (
        <p style={{ marginTop: 12, fontSize: 14, color: '#4ade80' }}>
          PDF created — download should have started.
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
