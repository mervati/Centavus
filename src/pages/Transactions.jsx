import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import TransactionForm from '../components/TransactionForm'
import { formatCurrency, formatDate, todayISO } from '../utils/format'
import { Plus, Trash2, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TYPE_LABELS = {
  income:              'Receita',
  expense:             'Despesa',
  savings_deposit:     'Cofrinho +',
  savings_withdrawal:  'Cofrinho -',
  cofrinho_income:     'Cofrinho ↓',
  cofrinho_expense:    'Cofrinho ↑',
  credit_expense:      'Crédito',
}

const TYPE_COLORS = {
  income:             'text-emerald-600',
  expense:            'text-rose-600',
  savings_deposit:    'text-blue-600',
  savings_withdrawal: 'text-orange-500',
  cofrinho_income:    'text-blue-500',
  cofrinho_expense:   'text-orange-600',
  credit_expense:     'text-purple-600',
}

const TYPE_SIGNS = {
  income:             '+',
  expense:            '-',
  savings_deposit:    '+',
  savings_withdrawal: '+',
  cofrinho_income:    '+',
  cofrinho_expense:   '-',
  credit_expense:     '-',
}

function subtractDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const BASE_QUERY = '*, categories(name,icon,color), credit_cards(name,color)'
const BASE_ORDER = q => q
  .order('date', { ascending: false })
  .order('created_at', { ascending: false })
  .order('installment_number', { ascending: true })

export default function Transactions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [transactions, setTransactions]   = useState([])
  const [loading, setLoading]             = useState(true)
  const [loadingMore, setLoadingMore]     = useState(false)
  const [hasMore, setHasMore]             = useState(true)
  const [cutoffDate, setCutoffDate]       = useState(null)
  const [showModal, setShowModal]         = useState(false)
  const [editing, setEditing]             = useState(null)
  const [deleteModal, setDeleteModal]     = useState(null)
  const [filterType, setFilterType]       = useState('all')
  const [search, setSearch]               = useState('')
  const [filterMonth, setFilterMonth]     = useState('')
  const sentinelRef                       = useRef(null)

  // Carrega os últimos 30 dias
  const loadData = useCallback(async () => {
    setLoading(true)
    const to   = todayISO()
    const from = subtractDays(to, 30)
    const { data } = await BASE_ORDER(
      supabase.from('transactions').select(BASE_QUERY)
        .eq('user_id', user.id).gte('date', from).lte('date', to)
    )
    setTransactions(data ?? [])
    setCutoffDate(from)
    setHasMore(true)
    setLoading(false)
  }, [user.id])

  // Carrega um mês específico (quando filtro de mês é aplicado)
  const loadMonth = useCallback(async (month) => {
    setLoading(true)
    const [y, m] = month.split('-').map(Number)
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const next = new Date(y, m, 1)
    const to   = next.toISOString().split('T')[0]
    const { data } = await BASE_ORDER(
      supabase.from('transactions').select(BASE_QUERY)
        .eq('user_id', user.id).gte('date', from).lt('date', to)
    )
    setTransactions(data ?? [])
    setHasMore(false)
    setLoading(false)
  }, [user.id])

  // Carrega os próximos 30 dias (scroll infinito)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cutoffDate || filterMonth) return
    setLoadingMore(true)
    const to   = cutoffDate
    const from = subtractDays(to, 30)
    const { data } = await BASE_ORDER(
      supabase.from('transactions').select(BASE_QUERY)
        .eq('user_id', user.id).gte('date', from).lt('date', to)
    )
    if (!data || data.length === 0) {
      setHasMore(false)
    } else {
      setTransactions(prev => [...prev, ...data])
      setCutoffDate(from)
    }
    setLoadingMore(false)
  }, [cutoffDate, filterMonth, hasMore, loadingMore, user.id])

  // Recarrega dados respeitando o filtro ativo
  const refreshData = useCallback(() => {
    if (filterMonth) loadMonth(filterMonth)
    else loadData()
  }, [filterMonth, loadData, loadMonth])

  useEffect(() => {
    if (filterMonth) loadMonth(filterMonth)
    else loadData()
  }, [filterMonth]) // eslint-disable-line

  // Scroll infinito via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || filterMonth || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '120px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, filterMonth, hasMore])

  // Filtragem client-side (tipo e busca)
  const filtered = useMemo(() => {
    let list = transactions
    if (filterType !== 'all') list = list.filter(t => t.type === filterType)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t => t.description.toLowerCase().includes(q))
    }
    return list
  }, [transactions, filterType, search])

  const monthTotal = useMemo(() =>
    filtered.reduce((acc, t) => {
      const sign = ['income', 'savings_withdrawal', 'cofrinho_income'].includes(t.type) ? 1 : -1
      return acc + sign * Number(t.amount)
    }, 0)
  , [filtered])

  async function handleDelete(tx) {
    if (tx.type === 'credit_expense' && tx.installments > 1) {
      const { data } = await supabase
        .from('transactions').select('id')
        .eq('user_id', user.id).eq('type', 'credit_expense')
        .eq('card_id', tx.card_id).eq('date', tx.date)
        .eq('total_amount', tx.total_amount).eq('installments', tx.installments)
      setDeleteModal({ tx, seriesCount: data?.length ?? 1 })
    } else {
      if (!confirm('Remover esta transação?')) return
      await supabase.from('transactions').delete().eq('id', tx.id)
      refreshData()
    }
  }

  async function confirmDelete(mode) {
    const { tx } = deleteModal
    if (mode === 'single') {
      await supabase.from('transactions').delete().eq('id', tx.id)
    } else {
      await supabase.from('transactions').delete()
        .eq('user_id', user.id).eq('type', 'credit_expense')
        .eq('card_id', tx.card_id).eq('date', tx.date)
        .eq('total_amount', tx.total_amount).eq('installments', tx.installments)
    }
    setDeleteModal(null)
    refreshData()
  }

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
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="relative flex items-center gap-2">
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="flex-1 min-w-0 max-w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          {filterMonth && (
            <button
              onClick={() => setFilterMonth('')}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <X size={14} />
            </button>
          )}
          {!filterMonth && (
            <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">Últimos 30 dias</span>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[['all','Todas'],['income','Receitas'],['expense','Despesas'],['credit_expense','Crédito'],['savings_deposit','Cofrinho +'],['savings_withdrawal','Cofrinho -']].map(([val, label]) => (
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
                  {tx.type === 'credit_expense' && tx.credit_cards?.name ? ` · ${tx.credit_cards.name}` : ''}
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
                  onClick={() => handleDelete(tx)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Sentinel + feedback de carregamento */}
          {!filterMonth && (
            <>
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!hasMore && (
                <p className="text-center text-xs text-gray-400 py-3">Todas as transações carregadas</p>
              )}
            </>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar transação' : 'Nova transação'}>
        <TransactionForm
          initial={editing}
          onSuccess={() => { setShowModal(false); refreshData() }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Excluir parcelamento">
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Esta é a parcela{' '}
              <strong>{deleteModal.tx.installment_number}/{deleteModal.tx.installments}</strong>{' '}
              de uma compra parcelada. O que deseja excluir?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => confirmDelete('single')}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
              >
                Só esta parcela ({deleteModal.tx.installment_number}/{deleteModal.tx.installments})
              </button>
              <button
                onClick={() => confirmDelete('series')}
                className="w-full py-3 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                Toda a série ({deleteModal.seriesCount} parcelas)
              </button>
              <button
                onClick={() => setDeleteModal(null)}
                className="w-full py-2.5 text-gray-400 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
