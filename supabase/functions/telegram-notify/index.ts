import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN        = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function send(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  const currentUTCHour = new Date().getUTCHours()

  const { data: users } = await supabase
    .from('user_settings')
    .select('id, telegram_chat_id, telegram_notify_days_1, telegram_notify_days_2, telegram_notify_hour')
    .not('telegram_chat_id', 'is', null)

  if (!users?.length) return new Response(JSON.stringify({ sent: 0 }))

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let sent = 0

  for (const user of users) {
    const notifyHourBRT = user.telegram_notify_hour ?? 8
    const notifyHourUTC = (notifyHourBRT + 3) % 24  // BRT = UTC-3

    if (currentUTCHour !== notifyHourUTC) continue

    const days1 = user.telegram_notify_days_1 ?? 1
    const days2: number | null = user.telegram_notify_days_2 ?? null

    const alertDays = [days1, ...(days2 !== null ? [days2] : [])]
    const billsByDay: Record<number, { description: string; amount: string }[]> = {}

    for (const daysBefore of alertDays) {
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + daysBefore)
      const targetStr = targetDate.toISOString().split('T')[0]

      const { data: bills } = await supabase
        .from('bills')
        .select('description, amount')
        .eq('user_id', user.id)
        .eq('paid', false)
        .eq('due_date', targetStr)
        .order('description')

      if (bills?.length) billsByDay[daysBefore] = bills
    }

    if (Object.keys(billsByDay).length === 0) continue

    let msg = `📋 <b>Centavus — Contas a vencer</b>\n\n`

    const sortedDays = Object.keys(billsByDay).map(Number).sort((a, b) => a - b)

    for (const d of sortedDays) {
      const emoji = d === 0 ? '🔴' : '🟡'
      const label = d === 0
        ? `${emoji} Vencem <b>hoje</b>:`
        : `${emoji} Vencem em <b>${d} dia${d > 1 ? 's' : ''}</b>:`
      msg += `${label}\n`
      billsByDay[d].forEach(b => {
        msg += `• ${b.description} — ${formatBRL(Number(b.amount))}\n`
      })
      msg += '\n'
    }

    const total = Object.values(billsByDay).flat().reduce((a, b) => a + Number(b.amount), 0)
    msg += `💰 Total: <b>${formatBRL(total)}</b>`

    await send(user.telegram_chat_id, msg)
    sent++
  }

  return new Response(JSON.stringify({ sent }))
})
