import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import TransactionForm from '../components/TransactionForm'
import { formatCurrency, formatDate, daysUntil, isOverdue, todayISO } from '../utils/format'
import { Plus, TrendingUp, TrendingDown, PiggyBank, AlertCircle, LogOut, Settings, ChevronRight, Percent, Check, Edit2, Eye, EyeOff, GripVertical } from 'lucide-react'
import CurrencyInput from '../components/CurrencyInput'
import { useRecurringTransactions } from '../hooks/useRecurringTransactions'

const DEFAULT_CATEGORIES = [
  { name: 'Salário', type: 'income', color: '#22c55e', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#10b981', icon: '💻' },
  { name: 'Investimentos', type: 'income', color: '#06b6d4', icon: '📈' },
  { name: 'Rendimento', type: 'income', color: '#059669', icon: '📊' },
  { name: 'Outros (entrada)', type: 'income', color: '#8b5cf6', icon: '➕' },
  { name: 'Alimentação', type: 'expense', color: '#f97316', icon: '🍔' },
  { name: 'Transporte', type: 'expense', color: '#3b82f6', icon: '🚗' },
  { name: 'Moradia', type: 'expense', color: '#6366f1', icon: '🏠' },
  { name: 'Saúde', type: 'expense', color: '#ef4444', icon: '❤️' },
  { name: 'Educação', type: 'expense', color: '#f59e0b', icon: '📚' },
  { name: 'Lazer', type: 'expense', color: '#ec4899', icon: '🎮' },
  { name: 'Roupas', type: 'expense', color: '#8b5cf6', icon: '👗' },
  { name: 'Cartão', type: 'expense', color: '#a855f7', icon: '💳' },
  { name: 'Re-balanço', type: 'expense', color: '#f97316', icon: '⚖️' },
  { name: 'Outros (saída)', type: 'expense', color: '#6b7280', icon: '➖' },
]

export default function Dashboard() {
  const { user, signOut } = useAuth()
  useRecurringTransactions()
  const navigate = useNavigate()
  const [settings, setSettings]         = useState(null)
  const [rawTx, setRawTx]               = useState([])   // lean: {amount, type, date}
  const [recentTx, setRecentTx]         = useState([])
  const [upcomingBills, setUpcomingBills] = useState([])
  const [showTxModal, setShowTxModal]   = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [initBalance, setInitBalance]   = useState('')
  const [initSavings, setInitSavings]   = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [showYieldModal, setShowYieldModal] = useState(false)
  const [yieldTarget, setYieldTarget]   = useState('bank')  // 'bank' | 'savings'
  const [yieldMode, setYieldMode]       = useState('diff')  // 'diff'=só rendimento | 'full'=saldo completo
  const [yieldAmt, setYieldAmt]         = useState(0)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [editMode, setEditMode]         = useState(false)
  const [dashboardLayout, setDashboardLayout] = useState([
    { id: 'saldo_banco', visible: true, order: 1 },
    { id: 'cofrinho_apagar', visible: true, order: 2 },
    { id: 'proximas_contas', visible: true, order: 3 },
    { id: 'ultimas_transacoes', visible: true, order: 4 },
  ])

  // Valores derivados — recalculam só quando rawTx ou settings mudam
  const balance = useMemo(() => {
    if (!settings) return 0
    const sum = type => rawTx.filter(t => t.type === type).reduce((a, t) => a + Number(t.amount), 0)
    return Number(settings.initial_balance) + sum('income') - sum('expense') - sum('savings_deposit') + sum('savings_withdrawal')
  }, [rawTx, settings])

  const savings = useMemo(() => {
    if (!settings) return 0
    const sum = type => rawTx.filter(t => t.type === type).reduce((a, t) => a + Number(t.amount), 0)
    return Number(settings.savings_initial) + sum('savings_deposit') - sum('savings_withdrawal') + sum('cofrinho_income') - sum('cofrinho_expense')
  }, [rawTx, settings])

  const projection = useMemo(() => {
    if (!settings || rawTx.length === 0) return null
    const today = new Date()
    const dayElapsed = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - dayElapsed
    if (dayElapsed <= 0 || daysRemaining <= 0) return null
    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const monthTx = rawTx.filter(t => t.date.startsWith(currentYM))
    const monthIncome  = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    return balance + savings + ((monthIncome - monthExpense) / dayElapsed) * daysRemaining
  }, [rawTx, settings, balance, savings])

  const bankYield = useMemo(() =>
    rawTx.filter(t => t.type === 'income' && t.description === 'Rendimento')
         .reduce((a, t) => a + Number(t.amount), 0)
  , [rawTx])

  const savingsYield = useMemo(() =>
    rawTx.filter(t => t.type === 'cofrinho_income' && t.description === 'Rendimento')
         .reduce((a, t) => a + Number(t.amount), 0)
  , [rawTx])

  const loadData = useCallback(async () => {
    const today = new Date()
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0]

    const [{ data: s }, { data: tx }, { data: recent }, { data: bills }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('id', user.id).single(),
      supabase.from('transactions').select('amount,type,date,description').eq('user_id', user.id),
      // rico: últimas 5 transações com categorias para exibição
      supabase.from('transactions')
        .select('*, categories(name,icon,color)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('bills').select('*').eq('user_id', user.id).eq('paid', false).gte('due_date', firstDayOfMonth).lt('due_date', firstDayOfNextMonth).order('due_date'),
    ])

    if (!s) {
      setLoading(false)
      setShowSetupModal(true)
      return
    }

    setSettings(s)
    setRawTx(tx ?? [])
    setRecentTx(recent ?? [])
    setUpcomingBills(bills || [])
    if (s?.dashboard_layout) {
      try {
        setDashboardLayout(JSON.parse(s.dashboard_layout))
      } catch (e) {
        // Use default layout
      }
    }
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
      await supabase.from('categories').insert(
        DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id }))
      )
      setShowSetupModal(false)
      loadData()
    }
    setSetupLoading(false)
  }

  async function handleYield() {
    const currentVal = yieldTarget === 'bank' ? balance : savings
    const gain = yieldMode === 'diff' ? yieldAmt : yieldAmt - currentVal
    if (gain <= 0) return
    setYieldLoading(true)

    // Busca a categoria "Rendimento"
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Rendimento')
      .maybeSingle()

    await supabase.from('transactions').insert({
      user_id:     user.id,
      amount:      gain,
      type:        yieldTarget === 'bank' ? 'income' : 'cofrinho_income',
      description: 'Rendimento',
      date:        todayISO(),
      category_id: category?.id ?? null,
    })
    setShowYieldModal(false)
    setYieldAmt(0)
    setYieldLoading(false)
    loadData()
  }

  async function toggleCardVisibility(id) {
    const updated = dashboardLayout.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
    setDashboardLayout(updated)
    await supabase.from('user_settings').update({ dashboard_layout: JSON.stringify(updated) }).eq('id', user.id)
  }

  async function moveCard(id, direction) {
    const idx = dashboardLayout.findIndex(c => c.id === id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === dashboardLayout.length - 1)) return
    const updated = [...dashboardLayout]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[updated[idx].order, updated[swapIdx].order] = [updated[swapIdx].order, updated[idx].order]
    updated.sort((a, b) => a.order - b.order)
    setDashboardLayout(updated)
    await supabase.from('user_settings').update({ dashboard_layout: JSON.stringify(updated) }).eq('id', user.id)
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
              onClick={() => setEditMode(!editMode)}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${editMode ? 'bg-yellow-500 text-white' : 'bg-white/20 text-white'}`}
            >
              <Edit2 size={18} />
            </button>
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
        {projection !== null && (
          <p className="text-white/40 text-xs mt-1">
            {projection >= (balance + savings) ? '↗' : '↘'} Projeção fim do mês: {formatCurrency(projection)}
          </p>
        )}
      </div>

      {/* Edit Mode */}
      {editMode && (
        <div className="px-4 py-4 bg-yellow-50 border-b-2 border-yellow-200 space-y-2">
          <p className="text-xs font-semibold text-yellow-900 uppercase tracking-wide">Customizar dashboard</p>
          <div className="space-y-2">
            {dashboardLayout.map((card, idx) => {
              const cardNames = {
                saldo_banco: 'Saldo Banco',
                cofrinho_apagar: 'Cofrinho + A pagar',
                proximas_contas: 'Próximas contas',
                ultimas_transacoes: 'Últimas transações',
              }
              return (
                <div key={card.id} className="flex items-center gap-2 bg-white rounded-xl p-3 border border-yellow-100">
                  <GripVertical size={16} className="text-yellow-600 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-900">{cardNames[card.id]}</span>
                  <button
                    onClick={() => moveCard(card.id, 'up')}
                    disabled={idx === 0}
                    className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveCard(card.id, 'down')}
                    disabled={idx === dashboardLayout.length - 1}
                    className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleCardVisibility(card.id)}
                    className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-yellow-200"
                  >
                    {card.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="px-4 -mt-4 space-y-3 mb-6">
        {/* Saldo Banco — full width */}
        {dashboardLayout.find(c => c.id === 'saldo_banco')?.visible && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Saldo Banco</p>
              <p className={`text-lg font-bold ${balance < 0 ? 'text-rose-600' : 'text-yellow-700'}`}>{formatCurrency(balance)}</p>
              {bankYield > 0 && (
                <p className="text-xs text-emerald-600 font-medium mt-0.5">↗ +{formatCurrency(bankYield)} rendimento</p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Cofrinho + A pagar */}
        {dashboardLayout.find(c => c.id === 'cofrinho_apagar')?.visible && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <PiggyBank size={16} className="text-blue-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Cofrinho</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(savings)}</p>
            {savingsYield > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-0.5">↗ +{formatCurrency(savingsYield)}</p>
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
        )}
      </div>

      {/* Add transaction button */}
      <div className="px-4 mb-6 flex gap-3">
        <button
          onClick={() => setShowTxModal(true)}
          className="flex-1 py-3.5 rounded-2xl bg-yellow-600 text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={20} />
          Nova transação
        </button>
        <button
          onClick={() => { setShowYieldModal(true); setYieldAmt(0); setYieldTarget('bank'); setYieldMode('diff') }}
          className="py-3.5 px-4 rounded-2xl border-2 border-yellow-600 text-yellow-700 font-semibold flex items-center justify-center gap-2"
        >
          <Percent size={18} />
          Rendimento
        </button>
      </div>

      {/* Upcoming bills */}
      {dashboardLayout.find(c => c.id === 'proximas_contas')?.visible && upcomingBills.length > 0 && (
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
      {dashboardLayout.find(c => c.id === 'ultimas_transacoes')?.visible && recentTx.length > 0 && (
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

      {/* Rendimento Modal */}
      <Modal open={showYieldModal} onClose={() => setShowYieldModal(false)} title="Registrar rendimento">
        {(() => {
          const currentVal = yieldTarget === 'bank' ? balance : savings
          const gain = yieldMode === 'diff' ? yieldAmt : yieldAmt - currentVal
          const canConfirm = gain > 0

          return (
            <div className="space-y-5">
              {/* Destino */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Destino</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ key: 'bank', label: 'Banco', cur: balance }, { key: 'savings', label: 'Cofrinho', cur: savings }].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setYieldTarget(opt.key); setYieldAmt(0) }}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${yieldTarget === opt.key ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500'}`}
                    >
                      {opt.label}
                      <span className="block text-xs font-normal mt-0.5 opacity-70">{formatCurrency(opt.cur)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo de entrada */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Inserir como</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ key: 'diff', label: 'Valor do rendimento' }, { key: 'full', label: 'Saldo novo completo' }].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setYieldMode(opt.key); setYieldAmt(0) }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${yieldMode === opt.key ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {yieldMode === 'diff' ? 'Valor do rendimento' : 'Novo saldo total'}
                </p>
                <CurrencyInput value={yieldAmt} onChange={setYieldAmt} autoFocus />
                {yieldMode === 'full' && yieldAmt > 0 && (
                  <p className={`text-xs mt-2 font-medium ${canConfirm ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {canConfirm
                      ? `Rendimento calculado: +${formatCurrency(gain)}`
                      : `O valor deve ser maior que o saldo atual (${formatCurrency(currentVal)})`}
                  </p>
                )}
              </div>

              {/* Confirmar */}
              <button
                onClick={handleYield}
                disabled={yieldLoading || !canConfirm}
                className="w-full py-3.5 rounded-2xl bg-yellow-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Check size={18} />
                {yieldLoading ? 'Salvando...' : `Confirmar +${formatCurrency(canConfirm ? gain : 0)}`}
              </button>
            </div>
          )
        })()}
      </Modal>

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
