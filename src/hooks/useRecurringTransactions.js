import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { todayISO } from '../utils/format'

function pad(n) { return String(n).padStart(2, '0') }

export function useRecurringTransactions() {
  const { user } = useAuth()

  const generate = useCallback(async () => {
    if (!user) return

    const { data: list } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)

    if (!list || list.length === 0) return

    const today = todayISO()

    for (const rt of list) {
      // Busca todos os meses já gerados para esse recorrente
      const { data: existing } = await supabase
        .from('transactions')
        .select('date')
        .eq('recurring_transaction_id', rt.id)

      const coveredMonths = new Set((existing || []).map(t => t.date.slice(0, 7)))

      // Itera do mês inicial até o mês atual
      const startParts = rt.start_date.split('-')
      let year = parseInt(startParts[0])
      let month = parseInt(startParts[1])

      const todayParts = today.split('-')
      const todayYear = parseInt(todayParts[0])
      const todayMonth = parseInt(todayParts[1])

      while (year < todayYear || (year === todayYear && month <= todayMonth)) {
        const ym = `${year}-${pad(month)}`

        if (!coveredMonths.has(ym)) {
          // Calcula o último dia do mês para não ultrapassar
          const lastDay = new Date(year, month, 0).getDate()
          const day = Math.min(rt.day_of_month, lastDay)
          const txDate = `${ym}-${pad(day)}`

          // Só gera se a data já passou ou é hoje
          if (txDate <= today) {
            if (!rt.end_date || txDate <= rt.end_date) {
              await supabase.from('transactions').insert({
                user_id: user.id,
                category_id: rt.category_id || null,
                amount: rt.amount,
                type: rt.type,
                description: rt.description,
                date: txDate,
                recurring_transaction_id: rt.id,
              })
            }
          }
        }

        month++
        if (month > 12) { month = 1; year++ }
      }
    }
  }, [user])

  useEffect(() => { generate() }, [generate])

  return { generate }
}
