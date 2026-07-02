import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import TransactionForm from '../components/TransactionForm'
import { formatCurrency, formatDate, daysUntil, isOverdue, todayISO } from '../utils/format'
import { calcYieldInfo } from '../utils/yield'
import { Plus, TrendingUp, TrendingDown, PiggyBank, AlertCircle, LogOut, Settings, ChevronRight } from 'lucide-react'
import { useRecurringTransactions } from '../hooks/useRecurringTransactions'

const DEFAULT_CATEGORIES = [
  { name: 'Salário', type: 'income', color: '#22c55e', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#10b981', icon: '💻' },
  { name: 'Investimentos', type: 'income', color: '#06b6d4', icon: '📈' },
  { name: 'Outros (entrada)', type: 'income', color: '#8b5cf6', icon: '➕' },
  { name: 'Alimentação', type: 'expense', color: '#f97316', icon: '🍔' },
  { name: 'Transporte', type: 'expense', color: '#3b82f6', icon: '🚗' },
  { name: 'Moradia', type: 'expense', color: '#6366f1', icon: '🏠' },
  { name: 'Saúde', type: 'expense', color: '#ef4444', icon: '❤️' },
  { name: 'Educação', type: 'expense', color: '#f59e0b', icon: '📚' },
  { name: 'Lazer', type: 'expense', color: '#ec4899', icon: '🎮' },
  { name: 'Roupas', type: 'expense', color: '#8b5cf6', icon: '👗' },
  { name: 'Outros (saída)', type: 'expense', color: '#6b7280', icon: '➖' },
]

export default function Dashboard() {
  const { user, signOut } = useAuth()
  useRecurringTransactions()
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [balance, setBalance] = useState(0)
  const [savings, setSavings] = useState(0)
  const [recentTx, setRecentTx] = useState([])
  const [upcomingBills, setUpcomingBills] = useState([])
  const [showTxModal, setShowTxModal] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [initBalance, setInitBalance] = useState('')
  const [initSavings, setInitSavings] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [projection, setProjection] = useState(null)
  const [yieldInfo, setYieldInfo] = useState({ active: false, netBalance: 0, netSavings: 0, grossYieldBank: 0, grossYieldSavings: 0, irLabel: '' })

  const loadData = useCallback(async () => {
    const [{ data: s }, { data: tx }, { data: bills }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('id', user.id).single(),
      supabase.from('transactions').select('*, categories(name,icon,color)').eq('user_id', user.id),
      supabase.from('bills').select('*').eq('user_id', user.id).eq('paid', false).gte('due_date', todayISO()).order('due_date').limit(5),
    ])

    if (!s) {
      setLoading(false)
      setShowSetupModal(true)
      return
    }

    setSettings(s)

    const sum = (type) => (tx || []).filter(t => t.type === type).reduce((a, t) => a + Number(t.amount), 0)
    const income   = sum('income')
    const expense  = sum('expense')
    const savDep   = sum('savings_deposit')
    const savWith  = sum('savings_withdrawal')
    const cofInc   = sum('cofrinho_income')
    const cofExp   = sum('cofrinho_expense')

    const currentBalance = Number(s.initial_balance) + income - expense - savDep + savWith
    const currentSavings = Number(s.savings_initial) + savDep - savWith + cofInc - cofExp
    setBalance(currentBalance)
    setSavings(currentSavings)
    setYieldInfo(calcYieldInfo(s, currentBalance, currentSavings))

    // Projeção fim do mês
    const today = new Date()
    const dayElapsed = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - dayElapsed
    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const monthTx = (tx || []).filter(t => t.date.startsWith(currentYM))
    const monthIncome  = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    if (dayElapsed > 0 && daysRemaining > 0) {
      const dailyNet = (monthIncome - monthExpense) / dayElapsed
      setProjection(currentBalance + currentSavings + dailyNet * daysRemaining)
    } else {
      setProjection(null)
    }

    const recent = [...(tx || [])].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5)
    setRecentTx(recent)
    setUpcomingBills(bills || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function handleSetup(e) {
    e.preventDefault()
    setSetupLoading(true)
    const { error } = await supabase.from('user_settings').upsert({
      id: user.id,
      initial_balance: Number(initBalance) || 0,
      savings_initial: Number(initSavings) || 0,
    })
    if (!error) {
      // Insert default categories
      await supabase.from('categories').insert(
        DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id }))
      )
      setShowSetupModal(false)
      loadData()
    }
    setSetupLoading(false)
  }

  const txTypeStyle = t => ({
    income: 'text-emerald-600',
    expense: 'text-rose-600',
    savings_deposit: 'text-blue-600',
    savings_withdrawal: 'text-orange-500',
  })[t] || 'text-gray-600'

  const txSign = t => ['income', 'savings_withdrawal'].includes(t) ? '+' : '-'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-4 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Centavus" className="w-9 h-9 rounded-xl" />
            <div>
              <p className="text-yellow-400 text-xs tracking-widest uppercase">Centavus</p>
              <p className="text-white font-semibold text-sm">{user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/configuracoes')}
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={signOut}
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <p className="text-yellow-400/80 text-xs uppercase tracking-wide mb-1">Saldo Total</p>
        <p className={`text-3xl font-bold text-white ${(balance + savings) < 0 ? 'text-rose-300' : ''}`}>
          {formatCurrency(balance + savings)}
        </p>
        {yieldInfo.active && (yieldInfo.grossYieldBank + yieldInfo.grossYieldSavings) > 0 && (
          <p className="text-white/60 text-xs mt-0.5">
            Líquido est.: {formatCurrency(yieldInfo.netBalance + yieldInfo.netSavings)} · IR {yieldInfo.irLabel}
          </p>
        )}
        {projection !== null && (
          <p className="text-white/40 text-xs mt-1">
            {projection >= (balance + savings) ? '↗' : '↘'} Projeção fim do mês: {formatCurrency(projection)}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="px-4 -mt-4 space-y-3 mb-6">
        {/* Saldo Banco — full width */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Saldo Banco</p>
              <p className={`text-lg font-bold ${balance < 0 ? 'text-rose-600' : 'text-yellow-700'}`}>{formatCurrency(balance)}</p>
              {yieldInfo.active && yieldInfo.grossYieldBank > 0 && (
                <p className="text-xs text-emerald-600 mt-0.5">+{formatCurrency(yieldInfo.grossYieldBank)} rendimento</p>
              )}
            </div>
          </div>
        </div>

        {/* Cofrinho + A pagar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <PiggyBank size={16} className="text-blue-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Cofrinho</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(savings)}</p>
            {yieldInfo.active && yieldInfo.grossYieldSavings > 0 && (
              <p className="text-xs text-emerald-600 mt-0.5">+{formatCurrency(yieldInfo.grossYieldSavings)} rendimento</p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertCircle size={16} className="text-amber-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">A pagar</span>
            </div>
            <p className="text-lg font-bold text-amber-700">{upcomingBills.length} conta{upcomingBills.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Add transaction button */}
      <div className="px-4 mb-6">
        <button
          onClick={() => setShowTxModal(true)}
          className="w-full py-3.5 rounded-2xl bg-yellow-600 text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={20} />
          Nova transação
        </button>
      </div>

      {/* Upcoming bills */}
      {upcomingBills.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Próximas contas</h2>
            <button onClick={() => navigate('/contas')} className="text-yellow-600 text-sm flex items-center gap-0.5">
              Ver todas <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingBills.map(bill => {
              const days = daysUntil(bill.due_date)
              const overdue = isOverdue(bill.due_date)
              return (
                <div key={bill.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${overdue ? 'bg-rose-500' : days <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{bill.description}</p>
                    <p className="text-xs text-gray-500">Vence {formatDate(bill.due_date)} · {overdue ? 'Vencida' : days === 0 ? 'Hoje' : `${days}d`}</p>
                  </div>
                  <p className="font-semibold text-rose-600 text-sm flex-shrink-0">{formatCurrency(bill.amount)}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent transactions */}
      {recentTx.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Últimas transações</h2>
            <button onClick={() => navigate('/transacoes')} className="text-yellow-600 text-sm flex items-center gap-0.5">
              Ver todas <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {recentTx.map(tx => (
              <div key={tx.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                  {tx.categories?.icon ?? (tx.type === 'income' ? '💰' : tx.type === 'expense' ? '💸' : '🐷')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{tx.description}</p>
                  <p className="text-xs text-gray-500">{formatDate(tx.date)} · {tx.categories?.name ?? tx.type}</p>
                </div>
                <p className={`font-semibold text-sm flex-shrink-0 ${txTypeStyle(tx.type)}`}>
                  {txSign(tx.type)}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Setup Modal */}
      <Modal open={showSetupModal} onClose={() => {}} title="Configuração inicial">
        <p className="text-sm text-gray-600 mb-4">Informe seus saldos atuais para começar a usar o app.</p>
        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo atual (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={initBalance}
              onChange={e => setInitBalance(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo no cofrinho (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={initSavings}
              onChange={e => setInitSavings(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <button
            type="submit"
            disabled={setupLoading}
            className="w-full py-3 rounded-xl bg-yellow-600 text-white font-semibold disabled:opacity-60"
          >
            {setupLoading ? 'Configurando...' : 'Começar'}
          </button>
        </form>
      </Modal>

      {/* Transaction Modal */}
      <Modal open={showTxModal} onClose={() => setShowTxModal(false)} title="Nova transação">
        <TransactionForm
          onSuccess={() => { setShowTxModal(false); loadData() }}
          onCancel={() => setShowTxModal(false)}
        />
      </Modal>
    </Layout>
  )
}
