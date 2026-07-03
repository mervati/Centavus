import { useState, useEffect } from 'react'
import { getPendingCount } from '../utils/offlineCache'

export function useOnlineStatus() {
  const [isOnline, setIsOnline]       = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(getPendingCount)

  useEffect(() => {
    const onOnline        = () => setIsOnline(true)
    const onOffline       = () => setIsOnline(false)
    const onQueueChanged  = () => setPendingCount(getPendingCount())

    window.addEventListener('online',                   onOnline)
    window.addEventListener('offline',                  onOffline)
    window.addEventListener('centavus-queue-changed',   onQueueChanged)

    return () => {
      window.removeEventListener('online',                  onOnline)
      window.removeEventListener('offline',                 onOffline)
      window.removeEventListener('centavus-queue-changed',  onQueueChanged)
    }
  }, [])

  return { isOnline, pendingCount }
}
