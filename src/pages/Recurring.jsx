import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import RecurringForm from '../components/RecurringForm'
import { formatCurrency } from '../utils/format'
import { Plus, Trash2, Pencil, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'

export default function Recurring() {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recurring_transactions')
      .select('*, categories(name,icon,color)')
      .eq('user_id', user.id)
      .order('day_of_month')
    setList(data ?? [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function toggleActive(rt) {
    await supabase
      .from('recurring_transactions')
      .update({ active: !rt.active })
      .eq('id', rt.id)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Remover esta transação recorrente? As transações já geradas não serão apagadas.')) return
    await supabase.from('recurring_transactions').delete().eq('id', id)
    loadData()
  }

  const income = list.filter(r => r.active && r.type === 'income').reduce((a, r) => a + Number(r.amount), 0)
  const expense = list.filter(r => r.active && r.type === 'expense').reduce((a, r) => a + Number(r.amount), 0)

  return (
    <Layout
      title="Recorrentes"
      action={
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white"
        >
          <Plus size={18} />
        </button>
      }
    >
      {/* Resumo */}
      {list.length > 0 && (
        <div className="px-4 pt-3 pb-1 grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
            <p className="text-xs text-emerald-600 mb-0.5">Entradas/mês</p>
            <p className="font-bold text-emerald-700 text-sm">+{formatCurrency(income)}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
            <p className="text-xs text-rose-600 mb-0.5">Saídas/mês</p>
            <p className="font-bold text-rose-700 text-sm">-{formatCurrency(expense)}</p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="px-4 py-3">
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-3 flex gap-2 items-start">
          <RefreshCw size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-700">
            As transações são geradas automaticamente no dia configurado de cada mês ao abrir o app.
          </p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🔄</p>
          <p className="text-sm font-medium text-gray-500 mb-1">Nenhuma transação recorrente</p>
          <p className="text-xs">Adicione salário, aluguel ou outras entradas/saídas fixas</p>
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {list.map(rt => (
            <div
              key={rt.id}
              className={`bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3 transition-opacity ${!rt.active ? 'opacity-40' : ''}`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: (rt.categories?.color ?? '#eab308') + '22' }}
              >
                {rt.categories?.icon ?? (rt.type === 'income' ? '💰' : '💸')}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{rt.description}</p>
                <p className="text-xs text-gray-500">
                  Todo dia {rt.day_of_month}
                  {rt.categories ? ` · ${rt.categories.name}` : ''}
                </p>
              </div>

              <p className={`font-semibold text-sm flex-shrink-0 ${rt.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {rt.type === 'income' ? '+' : '-'}{formatCurrency(rt.amount)}
              </p>

              <div className="flex items-center gap-0.5">
                <button onClick={() => toggleActive(rt)} className={rt.active ? 'text-yellow-500' : 'text-gray-300'}>
                  {rt.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button
                  onClick={() => { setEditing(rt); setShowModal(true) }}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-yellow-600"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(rt.id)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar recorrente' : 'Nova recorrente'}
      >
        <RecurringForm
          initial={editing}
          onSuccess={() => { setShowModal(false); loadData() }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </Layout>
  )
}
