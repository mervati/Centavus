import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BOT_TOKEN     = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

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

  return new Response(`Notificações de fatura: ${notified} enviadas`, { status: 200 })
})
