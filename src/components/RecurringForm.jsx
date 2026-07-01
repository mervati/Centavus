import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import CategorySelect from './CategorySelect'

export default function RecurringForm({ initial, onSuccess, onCancel }) {
  const { user } = useAuth()
  const [type, setType] = useState(initial?.type ?? 'income')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [categories, setCategories] = useState([])
  const [dayOfMonth, setDayOfMonth] = useState(initial?.day_of_month ?? 5)
  const [startDate, setStartDate] = useState(
    initial?.start_date ? initial.start_date.slice(0, 7) : new Date().toISOString().slice(0, 7)
  )
  const [endDate, setEndDate] = useState(initial?.end_date ? initial.end_date.slice(0, 7) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!amount || Number(amount) <= 0) return setError('Informe um valor válido.')
    if (dayOfMonth < 1 || dayOfMonth > 28) return setError('Dia deve ser entre 1 e 28.')

    setLoading(true)
    const row = {
      user_id: user.id,
      description: description.trim(),
      amount: Number(amount),
      type,
      category_id: categoryId || null,
      day_of_month: Number(dayOfMonth),
      start_date: startDate + '-01',
      end_date: endDate ? endDate + '-28' : null,
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0,00"
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

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
