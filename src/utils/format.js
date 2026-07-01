export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateFull(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function getMonthName(month, year) {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function todayISO() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

export function isOverdue(dueDateStr) {
  return dueDateStr < todayISO()
}

export function daysUntil(dueDateStr) {
  const today = new Date(todayISO())
  const due = new Date(dueDateStr)
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24))
  return diff
}
