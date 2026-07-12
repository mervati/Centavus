import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN        = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL          = 'https://centavus.vercel.app/contas'

async function send(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
}

function formatBillMonth(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  const now = new Date()
  const currentUTCHour = now.getUTCHours()
  const currentYM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  const { data: users } = await supabase
    .from('user_settings')
    .select('id, telegram_chat_id, telegram_notify_hour')
    .not('telegram_chat_id', 'is', null)

  if (!users?.length) return new Response(JSON.stringify({ sent: 0 }))

  let sent = 0

  for (const user of users) {
    // Só envia no horário configurado pelo usuário (mesmo das notificações)
    const notifyHourBRT = user.telegram_notify_hour ?? 8
    const notifyHourUTC = (notifyHourBRT + 3) % 24  // BRT = UTC-3
    if (currentUTCHour !== notifyHourUTC) continue

    // Faturas em aberto do mês atual, com dados do cartão
    const { data: txs } = await supabase
      .from('transactions')
      .select('card_id, bill_month, bill_due_date, credit_cards(name, due_day)')
      .eq('user_id', user.id)
      .eq('type', 'credit_expense')
      .eq('bill_paid', false)
      .not('card_id', 'is', null)

    if (!txs?.length) continue

    // Agrupa por cartão; considera "sem vencimento" quando o cartão não tem due_day
    // E nenhuma transação da fatura do mês atual tem bill_due_date
    const byCard: Record<string, { name: string; dueDay: number | null; hasDueDate: boolean }> = {}
    for (const t of txs) {
      const bm = (t.bill_month ?? '').slice(0, 7)
      if (bm !== currentYM) continue
      const id = t.card_id
      if (!byCard[id]) byCard[id] = {
        name: t.credit_cards?.name ?? 'Cartão',
        dueDay: t.credit_cards?.due_day ?? null,
        hasDueDate: false,
      }
      if (t.bill_due_date) byCard[id].hasDueDate = true
    }

    const missing = Object.values(byCard).filter(c => !c.dueDay && !c.hasDueDate)
    if (missing.length === 0) continue

    const mes = formatBillMonth(currentYM)
    let msg = `💳 <b>Centavus — Fatura sem vencimento</b>\n\n`
    for (const c of missing) {
      msg += `O cartão <b>${c.name}</b> possui uma fatura sem data de vencimento:\n\n• ${mes}\n\n`
    }
    msg += `👉 <a href="${APP_URL}">Abrir Faturas no Centavus</a>`

    await send(user.telegram_chat_id, msg)
    sent++
  }

  return new Response(JSON.stringify({ sent }))
})
