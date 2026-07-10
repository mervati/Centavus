import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
)

function calcBillMonth(purchaseDate: string, closingDay: number, installmentIndex: number): string {
  try {
    const d = new Date(purchaseDate + "T12:00:00")
    if (isNaN(d.getTime())) throw new Error(`Invalid date: ${purchaseDate}`)

    const purchaseDay = d.getDate()
    const year = d.getFullYear()
    const month = d.getMonth()

    let billYear = year
    let billMonth = month

    if (purchaseDay >= closingDay) {
      billMonth += 1
    }

    billMonth += installmentIndex

    while (billMonth > 11) {
      billMonth -= 12
      billYear += 1
    }

    const billDate = new Date(billYear, billMonth, 1)
    return billDate.toISOString().split("T")[0]
  } catch (error) {
    console.error(`calcBillMonth error: ${error.message} (purchaseDate: ${purchaseDate}, closingDay: ${closingDay}, installmentIndex: ${installmentIndex})`)
    throw error
  }
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]
}

serve(async (req) => {
  try {
    const today = todayISO()
    const currentYM = today.slice(0, 7)

    // Busca todos os recurring_transactions ativos
    const { data: recurringTxs, error: fetchError } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("active", true)

    if (fetchError) throw fetchError
    if (!recurringTxs || recurringTxs.length === 0) {
      return new Response(JSON.stringify({ message: "No recurring transactions", created: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    let createdCount = 0

    // Para cada template recorrente
    for (const template of recurringTxs) {
      // Se já foi criado neste mês, pula
      if (template.last_created_month === currentYM) continue

      // Verifica se é o dia correto OU se já passou do dia (para pegar atrasados)
      const nowDate = new Date()
      const todayDate = nowDate.getDate()
      const templateDay = template.day_of_month

      // Cria se: é o dia correto OU já passou do dia neste mês
      if (todayDate < templateDay) continue

      // Busca o cartão para pegar closing_day
      const { data: card } = await supabase
        .from("credit_cards")
        .select("closing_day")
        .eq("id", template.card_id)
        .single()

      const closingDay = card?.closing_day ?? 1

      // Cria data com o dia configurado da recorrência
      if (!template.day_of_month || template.day_of_month < 1 || template.day_of_month > 31) {
        console.error(`Invalid day_of_month for template ${template.id}: ${template.day_of_month}`)
        continue
      }

      const txDate = new Date(today + "T12:00:00")
      txDate.setDate(template.day_of_month)
      const txDateStr = txDate.toISOString().split("T")[0]

      if (!txDateStr || txDateStr === "Invalid Date") {
        console.error(`Failed to create date for template ${template.id}. today: ${today}, day: ${template.day_of_month}`)
        continue
      }

      // Cria as parcelas para este mês
      const txType = template.card_id ? "credit_expense" : template.type
      const rows = Array.from({ length: template.installments }, (_, i) => ({
        user_id: template.user_id,
        type: txType,
        amount: Math.round((template.amount / template.installments) * 100) / 100,
        total_amount: template.amount,
        description:
          template.installments > 1
            ? `${template.description} ${i + 1}/${template.installments}`
            : template.description,
        date: txDateStr,
        category_id: template.category_id,
        payment_method: template.card_id ? "credit" : (template.payment_method ?? (template.type === 'income' ? 'transfer' : 'cash')),
        card_id: template.card_id,
        installments: template.installments,
        installment_number: i + 1,
        bill_month: calcBillMonth(txDateStr, closingDay, i),
        bill_paid: false,
        is_recurring: i === 0,
        recurring_group_id: template.group_id,
      }))

      // Insere as transações
      console.log(`Inserting ${rows.length} rows for template ${template.id} (group: ${template.group_id})`)
      console.log(`First row: ${JSON.stringify(rows[0])}`)
      const { error: insertError, data: insertData } = await supabase.from("transactions").insert(rows)
      if (insertError) {
        console.error(`Error creating recurring transactions for group ${template.group_id}:`, insertError)
        continue
      }
      console.log(`Successfully inserted for group ${template.group_id}. Data: ${JSON.stringify(insertData)}`)

      // Atualiza last_created_month
      await supabase
        .from("recurring_transactions")
        .update({ last_created_month: currentYM, updated_at: new Date().toISOString() })
        .eq("id", template.id)

      createdCount++
    }

    return new Response(JSON.stringify({ message: "Success", created: createdCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
