import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { todayISO } from '../utils/format'

const TYPES = [
  { value: 'income', label: 'Receita', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'expense', label: 'Despesa', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'savings_deposit', label: 'Cofrinho +', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'savings_withdrawal', label: 'Cofrinho -', color: 'bg-orange-100 text-orange-700 border-orange-200' },
]

export default function TransactionForm({ onSuccess, onCancel, initial }) {
  const { user } = useAuth()
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [categories, setCategories] = useState([])
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
        if (!initial?.category_id) setCategoryId('')
      })
  }, [type, user.id, initial?.category_id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!amount || Number(amount) <= 0) return setError('Informe um valor válido.')
    if (!description.trim()) return setError('Informe uma descrição.')
    setLoading(true)

    const row = {
      user_id: user.id,
      type,
      amount: Number(amount),
      description: description.trim(),
      date,
      category_id: categoryId || null,
    }

    const { error: err } = initial?.id
      ? await supabase.from('transactions').update(row).eq('id', initial.id)
      : await supabase.from('transactions').insert(row)

    setLoading(false)
    if (err) return setError(err.message)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        {TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
              type === t.value ? t.color + ' border-current' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Valor */}
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

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
        <input
          type="text"
          placeholder="Ex: Supermercado, Salário..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {/* Data */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {/* Categoria */}
      {(type === 'income' || type === 'expense') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <div className="border border-gray-300 rounded-xl overflow-y-auto max-h-44">
            <button
              type="button"
              onClick={() => setCategoryId('')}
              className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${!categoryId ? 'bg-yellow-50 text-yellow-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Sem categoria
            </button>
            {categories.map(c => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors border-t border-gray-100 ${categoryId === c.id ? 'bg-yellow-50 text-yellow-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
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
