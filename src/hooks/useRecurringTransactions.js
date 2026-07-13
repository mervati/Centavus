import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { todayISO } from '../utils/format'

function pad(n) { return String(n).padStart(2, '0') }

// Calcula em qual mês de fatura a compra cai, com base no dia de fechamento do cartão
function calcBillMonth(purchaseDate, closingDay) {
  const d = new Date(purchaseDate + 'T12:00:00')
  const purchaseDay = d.getDate()
  const base = purchaseDay >= closingDay
    ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
    : new Date(d.getFullYear(), d.getMonth(), 1)
  return base.toISOString().split('T')[0]
}

// Resolve o tipo/carteira da transação a partir do template recorrente
function resolveTxFields(rt, txDate, card) {
  // Despesa no cartão de crédito
  if (rt.type === 'expense' && rt.card_id && card) {
    return {
      type: 'credit_expense',
      payment_method: 'credit',
      wallet: null,
      card_id: rt.card_id,
      total_amount: rt.amount,
      installments: 1,
      installment_number: 1,
      bill_month: calcBillMonth(txDate, card.closing_day ?? 1),
      bill_paid: false,
      is_recurring: true,
    }
  }
  // Receita no cofrinho
  if (rt.type === 'income' && rt.payment_method === 'cash') {
    return { type: 'cofrinho_income', payment_method: 'pix', wallet: 'cofrinho' }
  }
  // Receita no banco
  if (rt.type === 'income') {
    return { type: 'income', payment_method: 'pix', wallet: 'banco' }
  }
  // Despesa comum (pix/banco)
  return { type: 'expense', payment_method: 'pix', wallet: 'banco' }
}

export function useRecurringTransactions() {
  const { user } = useAuth()

  const generate = useCallback(async () => {
    if (!user) return

    const [{ data: list }, { data: cards }] = await Promise.all([
      supabase.from('recurring_transactions').select('*').eq('user_id', user.id).eq('active', true),
      supabase.from('credit_cards').select('id, closing_day').eq('user_id', user.id),
    ])

    if (!list || list.length === 0) return

    const cardMap = {}
    for (const c of (cards || [])) cardMap[c.id] = c

    const today = todayISO()

    // Busca meses já gerados de todos os recorrentes de uma vez (dedup por recurring_transaction_id)
    const ids = list.map(rt => rt.id)
    const { data: allExisting } = await supabase
      .from('transactions')
      .select('date, recurring_transaction_id')
      .in('recurring_transaction_id', ids)

    const coveredByRt = {}
    for (const t of (allExisting || [])) {
      const rid = t.recurring_transaction_id
      if (!coveredByRt[rid]) coveredByRt[rid] = new Set()
      coveredByRt[rid].add(t.date.slice(0, 7))
    }

    const toInsert = []

    for (const rt of list) {
      const coveredMonths = coveredByRt[rt.id] || new Set()
      const card = rt.card_id ? cardMap[rt.card_id] : null

      const startParts = rt.start_date.split('-')
      let year = parseInt(startParts[0])
      let month = parseInt(startParts[1])

      const todayParts = today.split('-')
      const todayYear = parseInt(todayParts[0])
      const todayMonth = parseInt(todayParts[1])

      while (year < todayYear || (year === todayYear && month <= todayMonth)) {
        const ym = `${year}-${pad(month)}`

        if (!coveredMonths.has(ym)) {
          const lastDay = new Date(year, month, 0).getDate()
          const day = Math.min(rt.day_of_month, lastDay)
          const txDate = `${ym}-${pad(day)}`

          if (txDate <= today && (!rt.end_date || txDate <= rt.end_date)) {
            toInsert.push({
              user_id:                  user.id,
              category_id:              rt.category_id || null,
              amount:                   rt.amount,
              description:              rt.description,
              date:                     txDate,
              recurring_transaction_id: rt.id,
              recurring_group_id:       rt.group_id ?? null,
              ...resolveTxFields(rt, txDate, card),
            })
          }
        }

        month++
        if (month > 12) { month = 1; year++ }
      }
    }

    if (toInsert.length > 0) {
      // Herda o vencimento já definido para a fatura (card_id + bill_month), se existir,
      // para novas compras não nascerem sem data numa fatura que já tem vencimento
      const creditCardIds = [...new Set(toInsert.filter(t => t.type === 'credit_expense').map(t => t.card_id))]
      if (creditCardIds.length > 0) {
        const { data: existingDueDates } = await supabase
          .from('transactions')
          .select('card_id, bill_month, bill_due_date')
          .in('card_id', creditCardIds)
          .not('bill_due_date', 'is', null)
        const dueDateByKey = {}
        for (const t of (existingDueDates ?? [])) dueDateByKey[`${t.card_id}__${t.bill_month}`] = t.bill_due_date
        for (const t of toInsert) {
          if (t.type === 'credit_expense') {
            t.bill_due_date = dueDateByKey[`${t.card_id}__${t.bill_month}`] ?? null
          }
        }
      }

      await supabase.from('transactions').insert(toInsert)
    }
  }, [user])

  useEffect(() => { generate() }, [generate])

  return { generate }
}
