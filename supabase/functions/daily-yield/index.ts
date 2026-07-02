import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const YIELD_PCT: Record<string, number> = {
  mercado_pago:      1.15,
  mercado_pago_meli: 1.20,
}

Deno.serve(async () => {
  const today = new Date()
  const dow = today.getUTCDay()
  if (dow === 0 || dow === 6) {
    return new Response('Fim de semana — nada a fazer', { status: 200 })
  }

  const todayStr = today.toISOString().split('T')[0]

  // Busca taxa diária CDI na API do Banco Central (série 12 = CDI Over diário)
  let dailyCDI = 0
  try {
    const res = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
    const data = await res.json()
    dailyCDI = parseFloat(data[0].valor) / 100 // ex: "0.0547" → 0.000547
  } catch {
    return new Response('Erro ao buscar CDI na API do Banco Central', { status: 500 })
  }

  if (dailyCDI <= 0) {
    return new Response('CDI inválido retornado pela API', { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: users } = await supabase
    .from('user_settings')
    .select('id, initial_balance, savings_initial, yield_type, last_yield_update')
    .neq('yield_type', 'none')

  if (!users?.length) {
    return new Response('Sem usuários com rendimento ativo', { status: 200 })
  }

  let updated = 0
  for (const u of users) {
    if (u.last_yield_update === todayStr) continue

    const pct = YIELD_PCT[u.yield_type]
    if (!pct) continue

    const dailyRate  = dailyCDI * pct
    const newBalance = Math.round(Number(u.initial_balance) * (1 + dailyRate) * 100) / 100
    const newSavings = Math.round(Number(u.savings_initial) * (1 + dailyRate) * 100) / 100

    await supabase.from('user_settings').update({
      initial_balance:   newBalance,
      savings_initial:   newSavings,
      last_yield_update: todayStr,
    }).eq('id', u.id)

    updated++
  }

  return new Response(`Rendimento aplicado para ${updated} usuário(s) — CDI diário: ${(dailyCDI * 100).toFixed(5)}%`, { status: 200 })
})
