const QUEUE_KEY = 'centavus_offline_queue'

function notify() {
  window.dispatchEvent(new CustomEvent('centavus-queue-changed'))
}

export function addToQueue(tx) {
  const queue = getQueue()
  queue.push({ ...tx, _queueId: `${Date.now()}-${Math.random()}` })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  notify()
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}

export function removeFromQueue(queueId) {
  const queue = getQueue().filter(t => t._queueId !== queueId)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  notify()
}

export function getPendingCount() {
  return getQueue().length
}
