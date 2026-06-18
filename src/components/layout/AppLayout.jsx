import Navbar from './Navbar'
import Footer from './Footer'

export default function AppLayout({ children, currentPage, onNavigate }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="mx-auto w-full max-w-content-max flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <Footer />
    </div>
  )
}
