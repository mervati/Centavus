import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import CategorySelect from './CategorySelect'
import { todayISO } from '../utils/format'

export default function BillForm({ onSuccess, onCancel, initial }) {
  const { user } = useAuth()
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? todayISO())
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [recurring, setRecurring] = useState(initial?.recurring ?? false)
  const [recurringType, setRecurringType] = useState(initial?.recurring_type ?? 'monthly')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [user.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!amount || Number(amount) <= 0) return setError('Informe um valor válido.')
    setLoading(true)

    const row = {
      user_id: user.id,
      description: description.trim(),
      amount: Number(amount),
      due_date: dueDate,
      category_id: categoryId || null,
      recurring,
      recurring_type: recurring ? recurringType : null,
    }

    const { error: err } = initial?.id
      ? await supabase.from('bills').update(row).eq('id', initial.id)
      : await supabase.from('bills').insert(row)

    setLoading(false)
    if (err) return setError(err.message)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
        <input
          type="text"
          placeholder="Ex: Aluguel, Netflix, Luz..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
        <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setRecurring(v => !v)}
          className={`w-10 h-6 rounded-full transition-colors relative ${recurring ? 'bg-yellow-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${recurring ? 'left-5' : 'left-1'}`} />
        </div>
        <span className="text-sm font-medium text-gray-700">Recorrente</span>
      </label>

      {recurring && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidade</label>
          <select
            value={recurringType}
            onChange={e => setRecurringType(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
          >
            <option value="monthly">Mensal</option>
            <option value="weekly">Semanal</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
      )}

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
          {loading ? 'Salvando...' : initial?.id ? 'Atualizar' : 'Adicionar'}
        </button>
      </div>
    </form>
  )
}
