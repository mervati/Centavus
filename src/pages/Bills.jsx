import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import BillForm from '../components/BillForm'
import { formatCurrency, formatDate, daysUntil, isOverdue, todayISO } from '../utils/format'
import { Plus, Trash2, Pencil, CheckCircle2, Circle, RefreshCw } from 'lucide-react'

export default function Bills() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('pending')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bills')
      .select('*, categories(name,icon,color)')
      .eq('user_id', user.id)
      .order('due_date')
    setBills(data ?? [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function togglePaid(bill) {
    const now = new Date().toISOString()
    await supabase
      .from('bills')
      .update({ paid: !bill.paid, paid_at: !bill.paid ? now : null })
      .eq('id', bill.id)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Remover esta conta?')) return
    await supabase.from('bills').delete().eq('id', id)
    loadData()
  }

  const filtered = bills.filter(b => {
    if (filter === 'all') return true
    if (filter === 'pending') return !b.paid
    if (filter === 'paid') return b.paid
    if (filter === 'overdue') return !b.paid && isOverdue(b.due_date)
    return true
  })

  const totalPending = bills.filter(b => !b.paid).reduce((a, b) => a + Number(b.amount), 0)

  function getBadge(bill) {
    if (bill.paid) return { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' }
    const days = daysUntil(bill.due_date)
    if (isOverdue(bill.due_date)) return { label: 'Vencida', cls: 'bg-rose-100 text-rose-700' }
    if (days === 0) return { label: 'Hoje', cls: 'bg-amber-100 text-amber-700' }
    if (days <= 3) return { label: `${days}d`, cls: 'bg-amber-100 text-amber-700' }
    return { label: `${days}d`, cls: 'bg-gray-100 text-gray-600' }
  }

  return (
    <Layout
      title="Contas a pagar"
      action={
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white"
        >
          <Plus size={18} />
        </button>
      }
    >
      {/* Summary */}
      <div className="px-4 py-3">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-600 font-medium mb-0.5">Total em aberto</p>
            <p className="text-2xl font-bold text-rose-700">{formatCurrency(totalPending)}</p>
          </div>
          <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {[['pending', 'Em aberto'], ['overdue', 'Vencidas'], ['paid', 'Pagas'], ['all', 'Todas']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === val ? 'bg-yellow-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-sm">Nenhuma conta aqui</p>
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {filtered.map(bill => {
            const badge = getBadge(bill)
            return (
              <div key={bill.id} className={`bg-white rounded-2xl p-3.5 shadow-sm border flex items-center gap-3 ${bill.paid ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
                <button
                  onClick={() => togglePaid(bill)}
                  className={`flex-shrink-0 ${bill.paid ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-400'}`}
                >
                  {bill.paid ? <CheckCircle2 size={24} fill="currentColor" /> : <Circle size={24} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className={`font-medium text-sm ${bill.paid ? 'line-through text-gray-400' : 'text-gray-900'} truncate`}>
                      {bill.description}
                    </p>
                    {bill.recurring && <RefreshCw size={11} className="text-gray-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">Vence {formatDate(bill.due_date)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <p className={`font-semibold text-sm flex-shrink-0 ${bill.paid ? 'text-gray-400' : 'text-rose-600'}`}>
                  {formatCurrency(bill.amount)}
                </p>

                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditing(bill); setShowModal(true) }}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-yellow-600"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(bill.id)}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar conta' : 'Nova conta'}
      >
        <BillForm
          initial={editing}
          onSuccess={() => { setShowModal(false); loadData() }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </Layout>
  )
}
