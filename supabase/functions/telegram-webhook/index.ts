import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN        = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function send(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const body = await req.json().catch(() => null)
  const message = body?.message
  if (!message) return new Response('ok')

  const chatId = message.chat.id as number
  const text   = (message.text ?? '') as string

  if (text.startsWith('/start ')) {
    const userId = text.split(' ')[1]?.trim()
    if (!userId) {
      await send(chatId, '❌ Link inválido. Abra o app e tente novamente.')
      return new Response('ok')
    }

    const { error } = await supabase
      .from('user_settings')
      .update({ telegram_chat_id: String(chatId) })
      .eq('id', userId)

    if (error) {
      await send(chatId, '❌ Não foi possível conectar. Tente novamente pelo app.')
    } else {
      await send(
        chatId,
        '✅ <b>Telegram conectado com sucesso!</b>\n\nVocê receberá notificações sobre suas contas a vencer. Configure os dias de antecedência no app.',
      )
    }
  } else if (text === '/start') {
    await send(chatId, '👋 Olá! Para conectar, abra o app Centavus → Configurações → Telegram e toque em "Conectar".')
  }

  return new Response('ok')
})
