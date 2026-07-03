import BottomNav from './BottomNav'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { WifiOff } from 'lucide-react'

export default function Layout({ children, title, action }) {
  const { isOnline, pendingCount } = useOnlineStatus()

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto w-full">
      {!isOnline && (
        <div className="sticky top-0 z-40 bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-2 px-4">
          <WifiOff size={13} />
          <span>
            Sem conexão
            {pendingCount > 0 && ` · ${pendingCount} transaç${pendingCount === 1 ? 'ão pendente' : 'ões pendentes'}`}
          </span>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="sticky top-0 z-40 bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-2 px-4">
          <span>Sincronizando {pendingCount} transaç{pendingCount === 1 ? 'ão' : 'ões'}...</span>
        </div>
      )}

      {title && (
        <header
          className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 pb-3 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {action}
        </header>
      )}
      <main className="pb-nav">{children}</main>
      <BottomNav />
    </div>
  )
}
