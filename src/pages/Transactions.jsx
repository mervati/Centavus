import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import TransactionForm from '../components/TransactionForm'
import { formatCurrency, formatDate } from '../utils/format'
import { Plus, Trash2, Pencil, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TYPE_LABELS = {
  income: 'Receita',
  expense: 'Despesa',
  savings_deposit: 'Cofrinho +',
  savings_withdrawal: 'Cofrinho -',
}

const TYPE_COLORS = {
  income: 'text-emerald-600',
  expense: 'text-rose-600',
  savings_deposit: 'text-blue-600',
  savings_withdrawal: 'text-orange-500',
}

const TYPE_SIGNS = {
  income: '+',
  expense: '-',
  savings_deposit: '+',
  savings_withdrawal: '+',
}

export default function Transactions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name,icon,color)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions(data ?? [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let list = transactions
    if (filterMonth) {
      list = list.filter(t => t.date.startsWith(filterMonth))
    }
    if (filterType !== 'all') {
      list = list.filter(t => t.type === filterType)
    }
    setFiltered(list)
  }, [transactions, filterType, filterMonth])

  async function handleDelete(id) {
    if (!confirm('Remover esta transação?')) return
    await supabase.from('transactions').delete().eq('id', id)
    loadData()
  }

  const monthTotal = filtered.reduce((acc, t) => {
    const sign = ['income', 'savings_withdrawal'].includes(t.type) ? 1 : -1
    return acc + sign * Number(t.amount)
  }, 0)

  return (
    <Layout
      title="Transações"
      action={
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/recorrentes')}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white"
          >
            <Plus size={18} />
          </button>
        </div>
      }
    >
      {/* Filters */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[['all', 'Todas'], ['income', 'Receitas'], ['expense', 'Despesas'], ['savings_deposit', 'Cofrinho +'], ['savings_withdrawal', 'Cofrinho -']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterType(val)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filterType === val ? 'bg-yellow-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="px-4 mb-3">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Total do período</span>
          <span className={`font-bold ${monthTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {monthTotal >= 0 ? '+' : ''}{formatCurrency(monthTotal)}
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-sm">Nenhuma transação encontrada</p>
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {filtered.map(tx => (
            <div key={tx.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                {tx.categories?.icon ?? (tx.type === 'income' ? '💰' : tx.type === 'expense' ? '💸' : '🐷')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{tx.description}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(tx.date)} · {tx.categories?.name ?? TYPE_LABELS[tx.type]}
                </p>
              </div>
              <p className={`font-semibold text-sm flex-shrink-0 ${TYPE_COLORS[tx.type]}`}>
                {TYPE_SIGNS[tx.type]}{formatCurrency(tx.amount)}
              </p>
              <div className="flex gap-1 ml-1">
                <button
                  onClick={() => { setEditing(tx); setShowModal(true) }}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-yellow-600"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(tx.id)}
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
        title={editing ? 'Editar transação' : 'Nova transação'}
      >
        <TransactionForm
          initial={editing}
          onSuccess={() => { setShowModal(false); loadData() }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </Layout>
  )
}
