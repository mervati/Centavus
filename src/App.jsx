import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import SplashScreen from './components/SplashScreen'
import { supabase } from './lib/supabase'
import { getQueue, removeFromQueue } from './utils/offlineCache'

const Auth        = lazy(() => import('./pages/Auth'))
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Bills       = lazy(() => import('./pages/Bills'))
const Summary     = lazy(() => import('./pages/Summary'))
const Categories  = lazy(() => import('./pages/Categories'))
const Settings    = lazy(() => import('./pages/Settings'))
const Recurring   = lazy(() => import('./pages/Recurring'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/auth" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const [minDone, setMinDone] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setMinDone(true), 1600)
    return () => clearTimeout(id)
  }, [])

  const flushQueue = useCallback(async () => {
    if (!user) return
    const queue = getQueue()
    if (!queue.length) return
    for (const item of queue) {
      const { _queueId, ...tx } = item
      const { error } = await supabase.from('transactions').insert(tx)
      if (!error) removeFromQueue(_queueId)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    window.addEventListener('online', flushQueue)
    if (navigator.onLine) flushQueue()
    return () => window.removeEventListener('online', flushQueue)
  }, [user, flushQueue])

  if (loading || !minDone) return <SplashScreen />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/transacoes" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/contas" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
        <Route path="/resumo" element={<ProtectedRoute><Summary /></ProtectedRoute>} />
        <Route path="/categorias" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/recorrentes" element={<ProtectedRoute><Recurring /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
