import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:maahervati@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Busca contas que vencem amanhã e ainda não foram pagas
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: bills } = await supabase
    .from('bills')
    .select('id, description, amount, due_date, user_id')
    .eq('due_date', tomorrowStr)
    .eq('paid', false)

  if (!bills?.length) return new Response('Sem contas para amanhã', { status: 200 })

  // Agrupa por usuário
  const byUser: Record<string, typeof bills> = {}
  for (const b of bills) {
    if (!byUser[b.user_id]) byUser[b.user_id] = []
    byUser[b.user_id].push(b)
  }

  let sent = 0
  for (const [userId, userBills] of Object.entries(byUser)) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (!subs?.length) continue

    const total = userBills.reduce((a, b) => a + Number(b.amount), 0)
    const body = userBills.length === 1
      ? `${userBills[0].description} — R$ ${Number(userBills[0].amount).toFixed(2).replace('.', ',')}`
      : `${userBills.length} contas vencem amanhã — Total: R$ ${total.toFixed(2).replace('.', ',')}`

    const payload = JSON.stringify({
      title: '💰 Centavus — Lembrete',
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      url: '/contas',
    })

    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        sent++
      } catch (e) {
        // Subscription expirada — remove
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }
  }

  return new Response(`Notificações enviadas: ${sent}`, { status: 200 })
})
