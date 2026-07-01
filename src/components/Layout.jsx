import BottomNav from './BottomNav'

export default function Layout({ children, title, action }) {
  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {title && (
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between safe-top">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {action}
        </header>
      )}
      <main className="pb-nav">{children}</main>
      <BottomNav />
    </div>
  )
}
