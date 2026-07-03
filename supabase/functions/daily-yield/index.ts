import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BOT_TOKEN     = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

const YIELD_PCT: Record<string, number> = {
  mercado_pago:      1.15,
  mercado_pago_meli: 1.20,
}

async function sendTelegram(chatId: string, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

Deno.serve(async () => {
  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const todayDay = today.getDate()
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── RENDIMENTO DIÁRIO (apenas dias úteis) ──────────────────────────────────
  let yieldMsg = 'Fim de semana — rendimento pulado'
  const dow = today.getUTCDay()

  if (dow !== 0 && dow !== 6) {
    let dailyCDI = 0
    try {
      const res  = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
      const data = await res.json()
      dailyCDI   = parseFloat(data[0].valor) / 100
    } catch {
      return new Response('Erro ao buscar CDI na API do Banco Central', { status: 500 })
    }

    if (dailyCDI <= 0) {
      return new Response('CDI inválido retornado pela API', { status: 500 })
    }

    const { data: users } = await supabase
      .from('user_settings')
      .select('id, initial_balance, savings_initial, yield_type, last_yield_update')
      .neq('yield_type', 'none')

    let updated = 0
    for (const u of (users ?? [])) {
      if (u.last_yield_update === todayStr) continue
      const pct = YIELD_PCT[u.yield_type]
      if (!pct) continue
      const dailyRate = dailyCDI * pct

      // Busca transações para calcular o saldo real atual
      const { data: txs } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', u.id)

      const sum = (type: string) =>
        (txs ?? []).filter((t: any) => t.type === type).reduce((a: number, t: any) => a + Number(t.amount), 0)

      const income  = sum('income')
      const expense = sum('expense')
      const savDep  = sum('savings_deposit')
      const savWith = sum('savings_withdrawal')
      const cofInc  = sum('cofrinho_income')
      const cofExp  = sum('cofrinho_expense')

      // Saldo real = base + todas as transações (igual ao frontend)
      const actualBalance = Number(u.initial_balance) + income - expense - savDep + savWith
      const actualSavings = Number(u.savings_initial) + savDep - savWith + cofInc - cofExp

      // Ganho calculado sobre o saldo real, somado ao base (não multiplicado)
      const gainBalance = Math.round(actualBalance * dailyRate * 100) / 100
      const gainSavings = Math.round(actualSavings * dailyRate * 100) / 100

      const newBalance = Math.round((Number(u.initial_balance) + gainBalance) * 100) / 100
      const newSavings = Math.round((Number(u.savings_initial) + gainSavings) * 100) / 100

      await supabase.from('user_settings').update({
        initial_balance:   newBalance,
        savings_initial:   newSavings,
        last_yield_update: todayStr,
      }).eq('id', u.id)
      updated++
    }

    yieldMsg = `Rendimento aplicado para ${updated} usuário(s) — CDI diário: ${(dailyCDI * 100).toFixed(5)}%`
  }

  // ── NOTIFICAÇÕES DE FATURA SEM VENCIMENTO (todos os dias) ─────────────────
  const { data: telegramUsers } = await supabase
    .from('user_settings')
    .select('id, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)

  let notified = 0

  for (const u of (telegramUsers ?? [])) {
    const { data: cards } = await supabase
      .from('credit_cards')
      .select('id, name, closing_day')
      .eq('user_id', u.id)

    for (const card of (cards ?? [])) {
      const closingDay = card.closing_day ?? 1

      // Busca todas as faturas sem vencimento e não pagas deste cartão
      const { data: txs } = await supabase
        .from('transactions')
        .select('bill_month')
        .eq('user_id', u.id)
        .eq('card_id', card.id)
        .eq('type', 'credit_expense')
        .is('bill_due_date', null)
        .eq('bill_paid', false)
        .order('bill_month')

      if (!txs?.length) continue

      // Filtra apenas meses que já fecharam
      const unfilledMonths = [...new Set(txs.map((t: { bill_month: string }) => (t.bill_month ?? '').slice(0, 7)))]
        .filter((ym: string) => {
          if (!ym) return false
          if (ym < currentYM) return true               // mês passado → sempre notifica
          if (ym === currentYM) return todayDay > closingDay  // mês atual → só após fechamento
          return false                                   // mês futuro → nunca
        })

      if (!unfilledMonths.length) continue

      const monthsList = unfilledMonths
        .map((ym: string) =>
          new Date(ym + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        )
        .join('\n• ')

      const plural = unfilledMonths.length > 1
      const msg =
        `💳 <b>Centavus — Fatura sem vencimento</b>\n\n` +
        `O cartão <b>${card.name}</b> possui ${plural ? 'faturas' : 'uma fatura'} sem data de vencimento:\n\n` +
        `• ${monthsList}\n\n` +
        `<a href="https://centavus.vercel.app/contas">👉 Abrir Faturas no Centavus</a>`

      await sendTelegram(u.telegram_chat_id, msg)
      notified++
    }
  }

  return new Response(`${yieldMsg} | Notificações de fatura: ${notified} enviadas`, { status: 200 })
})
