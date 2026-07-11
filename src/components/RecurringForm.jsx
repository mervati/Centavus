import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import CategorySelect from './CategorySelect'
import CurrencyInput from './CurrencyInput'
import { formatCurrency } from '../utils/format'

export default function RecurringForm({ initial, onSuccess, onCancel }) {
  const { user } = useAuth()
  const [type, setType] = useState(initial?.type ?? 'income')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? 0)
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [categories, setCategories] = useState([])
  const [cards, setCards] = useState([])
  const [cardId, setCardId] = useState(initial?.card_id ?? '')
  const [paymentMethod, setPaymentMethod] = useState(initial?.card_id ? 'credit' : 'pix')
  const [destination, setDestination] = useState(initial?.payment_method ?? 'transfer')
  const [dayOfMonth, setDayOfMonth] = useState(initial?.day_of_month ?? 5)
  const [startDate, setStartDate] = useState(
    initial?.start_date ? initial.start_date.slice(0, 7) : new Date().toISOString().slice(0, 7)
  )
  const [endDate, setEndDate] = useState(initial?.end_date ? initial.end_date.slice(0, 7) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cardUsage, setCardUsage] = useState({})

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type === 'income' ? 'income' : 'expense')
      .order('name')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (initial?.category_id && data?.find(c => c.id === initial.category_id)) {
          setCategoryId(initial.category_id)
        } else {
          setCategoryId('')
        }
      })
  }, [user.id, type, initial?.category_id])

  useEffect(() => {
    if (type === 'expense') {
      supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
        .then(({ data }) => {
          setCards(data ?? [])
          if (initial?.card_id && data?.find(c => c.id === initial.card_id)) {
            setCardId(initial.card_id)
          }
        })
      if (!initial) setPaymentMethod('pix')
    } else {
      setCards([])
      setCardId('')
      setPaymentMethod('pix')
    }
  }, [user.id, type, initial?.card_id])

  useEffect(() => {
    if (!cardId) { setCardUsage({}); return }
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .eq('type', 'credit_expense')
      .eq('bill_paid', false)
      .then(({ data }) => {
        const used = (data ?? []).reduce((s, t) => s + Number(t.amount), 0)
        setCardUsage({ [cardId]: used })
      })
  }, [cardId, user.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!amount || amount <= 0) return setError('Informe um valor válido.')
    if (!categoryId) return setError('Selecione uma categoria.')
    if (dayOfMonth < 1 || dayOfMonth > 28) return setError('Dia deve ser entre 1 e 28.')

    setLoading(true)
    const row = {
      user_id: user.id,
      description: description.trim(),
      amount,
      type,
      category_id: categoryId || null,
      card_id: type === 'expense' ? cardId || null : null,
      payment_method: type === 'income' ? destination : (paymentMethod === 'credit' ? 'credit' : 'pix'),
      day_of_month: Number(dayOfMonth),
      installments: 1,
      start_date: startDate + '-01',
      end_date: endDate ? endDate + '-28' : null,
      last_created_month: initial?.id ? undefined : null,
    }

    const { error: err } = initial?.id
      ? await supabase.from('recurring_transactions').update(row).eq('id', initial.id)
      : await supabase.from('recurring_transactions').insert(row)

    setLoading(false)
    if (err) return setError(err.message)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
      <div className="flex gap-2">
        {[['income', 'Receita'], ['expense', 'Despesa']].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setType(val)}
            className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
              type === val
                ? val === 'income'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border-rose-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Destino (apenas para receita) */}
      {type === 'income' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[['transfer', 'Banco'], ['cash', 'Cofrinho']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDestination(val)}
                className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                  destination === val
                    ? val === 'transfer'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forma de pagamento (apenas para despesa) */}
      {type === 'expense' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[['pix', 'Pix'], ['credit', 'Crédito']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setPaymentMethod(val)
                  if (val === 'pix') setCardId('')
                }}
                className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                  paymentMethod === val
                    ? val === 'credit'
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cartões (apenas se selecionou crédito) */}
          {paymentMethod === 'credit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cartão</label>
              <div className="grid grid-cols-2 gap-2">
                {cards.length === 0 ? (
                  <p className="text-xs text-center text-gray-500 col-span-2 bg-gray-50 rounded-xl py-3">
                    Nenhum cartão cadastrado
                  </p>
                ) : (
                  cards.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setCardId(card.id)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                        cardId === card.id
                          ? 'text-white'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                      style={cardId === card.id ? { backgroundColor: card.color, borderColor: card.color } : {}}
                    >
                      {card.name}
                    </button>
                  ))
                )}
              </div>
              {cardId && (() => {
                const card = cards.find(c => c.id === cardId)
                const used = cardUsage[cardId] || 0
                const limit = Number(card?.credit_limit) || 0
                const available = limit - used
                const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
                const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

                return limit > 0 ? (
                  <div className="mt-2 px-0.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-emerald-600 font-semibold">Disponível: {formatCurrency(Math.max(available, 0))}</span>
                      <span className="text-gray-400">Limite: {formatCurrency(limit)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>
      )}

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Ex: Salário"
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {/* Valor */}
      <CurrencyInput label="Valor (R$)" value={amount} onChange={setAmount} />

      {/* Categoria */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
        <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
      </div>

      {/* Dia do mês */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Todo dia</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="28"
            value={dayOfMonth}
            onChange={e => setDayOfMonth(e.target.value)}
            className="w-24 border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <span className="text-sm text-gray-500">do mês (máx. 28)</span>
        </div>
      </div>

      {/* Mês de início */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">A partir de</label>
        <input
          type="month"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {/* Mês de fim (opcional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Até (opcional)</label>
        <input
          type="month"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-yellow-600 text-white font-medium disabled:opacity-60"
        >
          {loading ? 'Salvando...' : initial?.id ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}
