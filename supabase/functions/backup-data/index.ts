import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN        = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Envia um arquivo como documento no Telegram
async function sendDocument(chatId: string, filename: string, content: string, caption: string) {
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', caption)
  form.append('parse_mode', 'HTML')
  form.append('document', new Blob([content], { type: 'application/json' }), filename)

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  return res.ok
}

// Verifica se já passou tempo suficiente desde o último backup
function isDue(frequency: string, lastSent: string | null, today: Date): boolean {
  if (!lastSent) return true
  const last = new Date(lastSent + 'T00:00:00Z')
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  if (frequency === 'daily')   return diffDays >= 1
  if (frequency === 'weekly')  return diffDays >= 7
  if (frequency === 'monthly') return diffDays >= 30
  return false
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const { data: users } = await supabase
    .from('user_settings')
    .select('id, telegram_chat_id, backup_frequency, backup_last_sent')
    .not('telegram_chat_id', 'is', null)
    .not('backup_frequency', 'is', null)
    .neq('backup_frequency', 'off')

  if (!users?.length) return new Response(JSON.stringify({ sent: 0 }))

  let sent = 0

  for (const user of users) {
    if (!isDue(user.backup_frequency, user.backup_last_sent, today)) continue

    // Coleta todos os dados do usuário
    const [transactions, bills, cards, recurring, categories] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', user.id),
      supabase.from('bills').select('*').eq('user_id', user.id),
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      supabase.from('recurring_transactions').select('*').eq('user_id', user.id),
      supabase.from('categories').select('*').eq('user_id', user.id),
    ])

    const backup = {
      app: 'Centavus',
      version: 1,
      generated_at: new Date().toISOString(),
      user_id: user.id,
      data: {
        transactions:           transactions.data ?? [],
        bills:                  bills.data ?? [],
        credit_cards:           cards.data ?? [],
        recurring_transactions: recurring.data ?? [],
        categories:             categories.data ?? [],
      },
    }

    const filename = `centavus-backup-${todayStr}.json`
    const caption =
      `💾 <b>Backup Centavus</b>\n` +
      `${todayStr}\n\n` +
      `• ${backup.data.transactions.length} transações\n` +
      `• ${backup.data.bills.length} contas\n` +
      `• ${backup.data.credit_cards.length} cartões\n` +
      `• ${backup.data.recurring_transactions.length} recorrências\n\n` +
      `Guarde este arquivo em local seguro.`

    const ok = await sendDocument(user.telegram_chat_id, filename, JSON.stringify(backup, null, 2), caption)

    if (ok) {
      await supabase
        .from('user_settings')
        .update({ backup_last_sent: todayStr })
        .eq('id', user.id)
      sent++
    }
  }

  return new Response(JSON.stringify({ sent }))
})
