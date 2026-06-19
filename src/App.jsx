import { lazy, Suspense, useState, useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'

const HomePage = lazy(() => import('./pages/HomePage'))
const MergeTestPage = lazy(() => import('./pages/MergeTestPage'))
const ImageToPdfTestPage = lazy(() => import('./pages/ImageToPdfTestPage'))
const NotesCleanerTestPage = lazy(() => import('./pages/NotesCleanerTestPage'))
const CompressTestPage = lazy(() => import('./pages/CompressTestPage'))
const SplitTestPage = lazy(() => import('./pages/SplitTestPage'))
const RotateTestPage = lazy(() => import('./pages/RotateTestPage'))
const RearrangeTestPage = lazy(() => import('./pages/RearrangeTestPage'))
const DeletePagesPage = lazy(() => import('./pages/DeletePagesPage'))

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted">Loading…</p>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')

  useEffect(() => {
    const pageTitles = {
      home: 'HeyPDF - Free Client-Side PDF Tools',
      'merge-test': 'Merge PDF | HeyPDF',
      'image-to-pdf-test': 'Image to PDF | HeyPDF',
      'notes-cleaner-test': 'Clean PDF Notes | HeyPDF',
      'compress-test': 'Compress PDF | HeyPDF',
      'split-test': 'Split PDF | HeyPDF',
      'rotate-test': 'Rotate PDF | HeyPDF',
      'rearrange-test': 'Rearrange PDF Pages | HeyPDF',
      'delete-pages-test': 'Delete PDF Pages | HeyPDF',
    }
    const title = pageTitles[page] || 'HeyPDF'
    const path = page === 'home' ? '/' : `/${page}`

    document.title = title

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title,
        page_location: window.location.href,
      })
    }
  }, [page])

  return (
    <AppLayout currentPage={page} onNavigate={setPage}>
      <Suspense fallback={<PageFallback />}>
        {page === 'merge-test' ? (
          <MergeTestPage onBack={() => setPage('home')} />
        ) : page === 'image-to-pdf-test' ? (
          <ImageToPdfTestPage onBack={() => setPage('home')} />
        ) : page === 'notes-cleaner-test' ? (
          <NotesCleanerTestPage onBack={() => setPage('home')} />
        ) : page === 'compress-test' ? (
          <CompressTestPage onBack={() => setPage('home')} />
        ) : page === 'split-test' ? (
          <SplitTestPage onBack={() => setPage('home')} />
        ) : page === 'rotate-test' ? (
          <RotateTestPage onBack={() => setPage('home')} />
        ) : page === 'rearrange-test' ? (
          <RearrangeTestPage onBack={() => setPage('home')} />
        ) : page === 'delete-pages-test' ? (
          <DeletePagesPage onBack={() => setPage('home')} />
        ) : (
          <HomePage
            onOpenMergeTest={() => setPage('merge-test')}
            onOpenImageToPdfTest={() => setPage('image-to-pdf-test')}
            onOpenNotesCleanerTest={() => setPage('notes-cleaner-test')}
            onOpenCompressTest={() => setPage('compress-test')}
            onOpenSplitTest={() => setPage('split-test')}
            onOpenRotateTest={() => setPage('rotate-test')}
            onOpenRearrangeTest={() => setPage('rearrange-test')}
            onOpenDeletePagesTest={() => setPage('delete-pages-test')}
          />
        )}
      </Suspense>
    </AppLayout>
  )
}
