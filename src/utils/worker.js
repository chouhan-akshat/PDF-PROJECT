/**
 * Create a Vite-friendly Web Worker for PDF and other heavy tasks.
 * Usage: const worker = createWorker(() => new Worker(new URL('../workers/pdf.worker.js', import.meta.url)))
 */
export function createWorker(factory) {
  const worker = factory()
  return worker
}
