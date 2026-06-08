import { lazy, Suspense, useState } from 'react'
import AppLayout from './components/layout/AppLayout'

const HomePage = lazy(() => import('./pages/HomePage'))
const MergeTestPage = lazy(() => import('./pages/MergeTestPage'))
const ImageToPdfTestPage = lazy(() => import('./pages/ImageToPdfTestPage'))
const NotesCleanerTestPage = lazy(() => import('./pages/NotesCleanerTestPage'))

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted">Loading…</p>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')

  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        {page === 'merge-test' ? (
          <MergeTestPage onBack={() => setPage('home')} />
        ) : page === 'image-to-pdf-test' ? (
          <ImageToPdfTestPage onBack={() => setPage('home')} />
        ) : page === 'notes-cleaner-test' ? (
          <NotesCleanerTestPage onBack={() => setPage('home')} />
        ) : (
          <HomePage
            onOpenMergeTest={() => setPage('merge-test')}
            onOpenImageToPdfTest={() => setPage('image-to-pdf-test')}
            onOpenNotesCleanerTest={() => setPage('notes-cleaner-test')}
          />
        )}
      </Suspense>
    </AppLayout>
  )
}
