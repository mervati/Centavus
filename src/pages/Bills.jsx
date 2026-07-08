import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import BillForm from '../components/BillForm'
import { formatCurrency, formatDate, daysUntil, isOverdue, todayISO } from '../utils/format'
import { Plus, Trash2, Pencil, CheckCircle2, Circle, RefreshCw, Search, X, CreditCard, Wallet, RotateCcw } from 'lucide-react'

function formatBillMonth(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function Bills() {
  const { user } = useAuth()
  const [tab, setTab]                   = useState('contas')
  const [bills, setBills]               = useState([])
  const [faturas, setFaturas]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState(null)
  const [filter, setFilter]             = useState('pending')
  const [search, setSearch]             = useState('')
  const [payingFatura, setPayingFatura] = useState(null)
  const [editingFatura, setEditingFatura] = useState(null)
  const [editDueDate, setEditDueDate]   = useState('')
  const [cardUnpaid, setCardUnpaid]     = useState({})
  const [cardLimits, setCardLimits]     = useState({})
  const [selectedMonth, setSelectedMonth] = useState('')
  const [showFuture, setShowFuture]       = useState(false)
  const [settings, setSettings]         = useState(null)
  const [rawTx, setRawTx]               = useState([])
  const pillsRef = useRef(null)

  const loadBills = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: bill }, { data: tx }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('id', user.id).single(),
      supabase.from('bills').select('*, categories(name,icon,color)').eq('user_id', user.id).order('due_date'),
      supabase.from('transactions').select('amount,type,date').eq('user_id', user.id),
    ])
    setSettings(s)
    setBills(bill ?? [])
    setRawTx(tx ?? [])
    setLoading(false)
  }, [user.id])

  const loadFaturas = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, credit_cards(id, name, color, closing_day, credit_limit)')
      .eq('user_id', user.id)
      .eq('type', 'credit_expense')
      .order('bill_month')
      .order('date')

    if (!data?.length) { setFaturas([]); setCardUnpaid({}); setCardLimits({}); return }

    const map = {}
    const unpaid = {}
    const limits = {}
    data.forEach(tx => {
      const bm = (tx.bill_month ?? '').slice(0, 7)
      const key = `${tx.card_id}__${bm}`
      if (!map[key]) map[key] = {
        key, card: tx.credit_cards, cardId: tx.card_id,
        billMonth: bm, items: [], total: 0, allPaid: true,
        dueDate: null,
      }
      map[key].items.push(tx)
      map[key].total += Number(tx.amount)
      if (!tx.bill_paid) {
        map[key].allPaid = false
        unpaid[tx.card_id] = (unpaid[tx.card_id] || 0) + Number(tx.amount)
      }
      if (tx.bill_due_date) map[key].dueDate = tx.bill_due_date
      if (tx.credit_cards?.credit_limit) limits[tx.card_id] = Number(tx.credit_cards.credit_limit)
    })

    setCardUnpaid(unpaid)
    setCardLimits(limits)
    const sorted = Object.values(map).sort((a, b) => a.billMonth.localeCompare(b.billMonth))
    setFaturas(sorted)
    const currentYM = new Date().toISOString().slice(0, 7)
    const fMonths = [...new Set(sorted.map(f => f.billMonth))].sort()
    setSelectedMonth(prev => {
      if (prev && fMonths.includes(prev)) return prev
      return fMonths.includes(currentYM) ? currentYM : (fMonths[fMonths.length - 1] ?? currentYM)
    })
  }, [user.id])

  useEffect(() => { loadBills(); loadFaturas() }, [loadBills, loadFaturas])

  async function togglePaid(bill) {
    const now = new Date().toISOString()
    if (!bill.paid) {
      const { data: tx } = await supabase.from('transactions').insert({
        user_id: user.id, category_id: bill.category_id || null,
        amount: bill.amount, type: 'expense',
        description: bill.description, date: todayISO(),
      }).select('id').single()
      await supabase.from('bills').update({ paid: true, paid_at: now, transaction_id: tx?.id ?? null }).eq('id', bill.id)
    } else {
      if (bill.transaction_id) await supabase.from('transactions').delete().eq('id', bill.transaction_id)
      await supabase.from('bills').update({ paid: false, paid_at: null, transaction_id: null }).eq('id', bill.id)
    }
    loadBills()
  }

  async function handleDelete(id) {
    if (!confirm('Remover esta conta?')) return
    await supabase.from('bills').delete().eq('id', id)
    loadBills()
  }

  async function payFatura(fatura) {
    setPayingFatura(fatura.key)
    const monthLabel = formatBillMonth(fatura.billMonth)
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'expense',
      amount: Math.round(fatura.total * 100) / 100,
      description: `Fatura ${fatura.card.name} - ${monthLabel}`,
      date: todayISO(),
      category_id: null,
      payment_method: 'pix',
      wallet: 'banco',
    })
    await supabase.from('transactions')
      .update({ bill_paid: true })
      .in('id', fatura.items.map(i => i.id))
    setPayingFatura(null)
    loadFaturas()
  }

  async function unpayFatura(fatura) {
    const monthLabel = formatBillMonth(fatura.billMonth)
    const { data: payTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('description', `Fatura ${fatura.card.name} - ${monthLabel}`)
      .eq('amount', Math.round(fatura.total * 100) / 100)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (payTx) await supabase.from('transactions').delete().eq('id', payTx.id)
    await supabase.from('transactions')
      .update({ bill_paid: false })
      .in('id', fatura.items.map(i => i.id))
    loadFaturas()
  }

  async function saveFaturaDueDate(fatura, dueDate) {
    await supabase.from('transactions')
      .update({ bill_due_date: dueDate || null })
      .in('id', fatura.items.map(i => i.id))
    setEditingFatura(null)
    loadFaturas()
  }

  function startEditDueDate(fatura) {
    setEditingFatura(fatura.key)
    setEditDueDate(fatura.dueDate || '')
  }

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

  const currentYM   = new Date().toISOString().slice(0, 7)

  const filtered = bills.filter(b => {
    if (b.due_date?.slice(0, 7) > currentYM) return false  // futuros ficam na seção expandida
    if (filter === 'pending' && b.paid) return false
    if (filter === 'paid'    && !b.paid) return false
    if (filter === 'overdue' && (b.paid || !isOverdue(b.due_date))) return false
    if (search.trim() && !b.description.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  const totalPending = bills.filter(b => !b.paid && b.due_date?.startsWith(currentYM)).reduce((a, b) => a + Number(b.amount), 0)

  const futureBills = bills.filter(b => !b.paid && b.due_date?.slice(0, 7) > currentYM)
  const futureBillsByMonth = futureBills.reduce((acc, b) => {
    const ym = b.due_date.slice(0, 7)
    if (!acc[ym]) acc[ym] = []
    acc[ym].push(b)
    return acc
  }, {})
  const futureMonths = Object.keys(futureBillsByMonth).sort()

  // Uma linha por cartão em Contas a pagar: apenas a fatura mais próxima (menor bill_month)
  const openFaturasByCard = Object.values(
    faturas.filter(f => !f.allPaid).reduce((acc, f) => {
      const key = f.cardId
      if (!acc[key] || f.billMonth < acc[key].billMonth) {
        acc[key] = { cardId: f.cardId, card: f.card, total: f.total, billMonth: f.billMonth, key: f.key, dueDate: f.dueDate }
      }
      return acc
    }, {})
  )

  // totalFaturas = apenas a fatura mais próxima por cartão (para o Total em aberto)
  const totalFaturas    = openFaturasByCard.reduce((a, f) => a + f.total, 0)
  // totalFaturasAll = soma de todos os meses em aberto (para o banner da aba Faturas)
  const totalFaturasAll = faturas.filter(f => !f.allPaid).reduce((a, f) => a + f.total, 0)

  useEffect(() => {
    if (!pillsRef.current || !selectedMonth) return
    const active = pillsRef.current.querySelector('[data-active="true"]')
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedMonth, tab])

  const availableMonths = useMemo(() => {
    const currentYM = new Date().toISOString().slice(0, 7)
    const fMonths = [...new Set(faturas.map(f => f.billMonth))].sort()
    const latest = fMonths.length > 0 && fMonths[fMonths.length - 1] > currentYM
      ? fMonths[fMonths.length - 1]
      : currentYM
    const [ly, lm] = latest.split('-').map(Number)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(ly, lm - 1 - (11 - i), 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [faturas])

  const visibleFaturas = useMemo(
    () => selectedMonth ? faturas.filter(f => f.billMonth === selectedMonth) : faturas,
    [faturas, selectedMonth]
  )

  function getBadge(bill) {
    if (bill.paid) return { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' }
    const days = daysUntil(bill.due_date)
    if (isOverdue(bill.due_date)) return { label: 'Vencida', cls: 'bg-rose-100 text-rose-700' }
    if (days === 0) return { label: 'Hoje', cls: 'bg-amber-100 text-amber-700' }
    if (days <= 3)  return { label: `${days}d`, cls: 'bg-amber-100 text-amber-700' }
    return { label: `${days}d`, cls: 'bg-gray-100 text-gray-600' }
  }

  return (
    <Layout
      title="Contas"
      action={tab === 'contas' ? (
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white">
          <Plus size={18} />
        </button>
      ) : null}
    >
      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-2">
        <button onClick={() => setTab('contas')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'contas' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}>
          Contas a pagar
        </button>
        <button onClick={() => setTab('faturas')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            tab === 'faturas' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}>
          <CreditCard size={14} /> Faturas
        </button>
      </div>

      {/* ===== TAB: CONTAS A PAGAR ===== */}
      {tab === 'contas' && (
        <>
          <div className="px-4 py-3">
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-600 font-medium mb-0.5">Total em aberto</p>
                <p className="text-2xl font-bold text-rose-700">{formatCurrency(totalPending + totalFaturas)}</p>
                {totalFaturas > 0 && (
                  <p className="text-xs text-rose-400 mt-0.5">
                    Contas: {formatCurrency(totalPending)} · Faturas: {formatCurrency(totalFaturas)}
                  </p>
                )}
                <p className="text-xs text-rose-500 font-medium mt-2">
                  💳 Saldo após pagamento: {formatCurrency((balance + savings) - (totalPending + totalFaturas))}
                </p>
              </div>
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          {/* Próximos meses */}
          {futureMonths.length > 0 && (
            <div className="px-4 mb-1">
              {!showFuture ? (
                <button
                  onClick={() => setShowFuture(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium flex items-center justify-center gap-1.5 hover:border-yellow-400 hover:text-yellow-700 transition-colors"
                >
                  Ver próximos meses
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">{futureBills.length}</span>
                </button>
              ) : (
                <div className="space-y-3 mb-3">
                  {futureMonths.map(ym => (
                    <div key={ym}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 capitalize">
                        {new Date(ym + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        <span className="ml-2 normal-case font-normal text-gray-400">
                          · {formatCurrency(futureBillsByMonth[ym].reduce((a, b) => a + Number(b.amount), 0))}
                        </span>
                      </p>
                      <div className="space-y-2">
                        {futureBillsByMonth[ym].map(bill => {
                          const badge = getBadge(bill)
                          return (
                            <div key={bill.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
                              <button onClick={() => togglePaid(bill)} className="flex-shrink-0 text-gray-300 hover:text-emerald-400">
                                <Circle size={24} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="font-medium text-sm truncate text-gray-900">{bill.description}</p>
                                  {bill.recurring && <RefreshCw size={11} className="text-gray-400 flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-gray-500">Vence {formatDate(bill.due_date)}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                                </div>
                              </div>
                              <p className="font-semibold text-sm text-rose-600 flex-shrink-0">{formatCurrency(bill.amount)}</p>
                              <div className="flex gap-1">
                                <button onClick={() => { setEditing(bill); setShowModal(true) }}
                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-yellow-600">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDelete(bill.id)}
                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-600">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setShowFuture(false)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium flex items-center justify-center gap-1.5 hover:border-yellow-400 hover:text-yellow-700 transition-colors"
                  >
                    Mostrar menos
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="px-4 mb-3 relative">
            <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Buscar por descrição..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={15} />
              </button>
            )}
          </div>

          <div className="px-4 mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {[['pending','Em aberto'],['overdue','Vencidas'],['paid','Pagas'],['all','Todas']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filter === val ? 'bg-yellow-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="px-4 space-y-2 pb-4">
              {filtered.length === 0 && openFaturasByCard.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-sm">Nenhuma conta aqui</p>
                </div>
              )}

              {filtered.map(bill => {
                const badge = getBadge(bill)
                return (
                  <div key={bill.id} className={`bg-white rounded-2xl p-3.5 shadow-sm border flex items-center gap-3 ${bill.paid ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
                    <button onClick={() => togglePaid(bill)}
                      className={`flex-shrink-0 ${bill.paid ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-400'}`}>
                      {bill.paid ? <CheckCircle2 size={24} fill="currentColor" /> : <Circle size={24} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className={`font-medium text-sm truncate ${bill.paid ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {bill.description}
                        </p>
                        {bill.recurring && <RefreshCw size={11} className="text-gray-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">Vence {formatDate(bill.due_date)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                      </div>
                    </div>
                    <p className={`font-semibold text-sm flex-shrink-0 ${bill.paid ? 'text-gray-400' : 'text-rose-600'}`}>
                      {formatCurrency(bill.amount)}
                    </p>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(bill); setShowModal(true) }}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-yellow-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(bill.id)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Faturas em aberto — uma linha por cartão */}
              {openFaturasByCard.length > 0 && (
                <>
                  {filtered.length > 0 && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2 pb-1">
                      Faturas de crédito
                    </p>
                  )}
                  {openFaturasByCard.map(fc => {
                    const limit    = cardLimits[fc.cardId] || 0
                    const used     = cardUnpaid[fc.cardId] || 0
                    const pct      = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
                    const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    return (
                      <div key={fc.cardId} className="bg-white rounded-2xl p-3.5 shadow-sm border border-purple-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: (fc.card?.color ?? '#9333ea') + '22' }}>
                            <CreditCard size={15} style={{ color: fc.card?.color ?? '#9333ea' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900">{fc.card?.name}</p>
                            <p className="text-xs text-gray-500">{formatBillMonth(fc.billMonth)}</p>
                          </div>
                          <p className="font-semibold text-sm text-purple-600 flex-shrink-0">
                            {formatCurrency(fc.total)}
                          </p>
                        </div>
                        {limit > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">
                                <span className={pct >= 90 ? 'text-rose-600 font-semibold' : pct >= 70 ? 'text-amber-600 font-semibold' : 'text-gray-700'}>
                                  {formatCurrency(used)}
                                </span>{' '}usado
                              </span>
                              <span className="text-gray-400">{formatCurrency(limit - used)} disponível</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== TAB: FATURAS ===== */}
      {tab === 'faturas' && (
        <>
          {totalFaturasAll > 0 && (
            <div className="px-4 py-3">
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium mb-0.5">Total em aberto</p>
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(totalFaturasAll)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <CreditCard size={22} className="text-purple-600" />
                </div>
              </div>
            </div>
          )}

          {faturas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-2">💳</p>
              <p className="text-sm">Nenhuma fatura encontrada</p>
              <p className="text-xs mt-1">Adicione uma despesa no crédito para ver aqui</p>
            </div>
          ) : (
            <>
              {/* Seletor de meses */}
              {availableMonths.length > 0 && (
                <div ref={pillsRef} className="px-4 mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                  {availableMonths.map(ym => (
                    <button key={ym} data-active={selectedMonth === ym ? 'true' : 'false'}
                      onClick={() => setSelectedMonth(ym)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex flex-col items-center leading-tight ${
                        selectedMonth === ym
                          ? 'bg-yellow-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-yellow-400'
                      }`}>
                      <span>{(() => { const s = new Date(ym + '-15').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); return s.charAt(0).toUpperCase() + s.slice(1) })()}</span>
                      <span className="text-xs opacity-80">{ym.slice(0, 4)}</span>
                    </button>
                  ))}
                </div>
              )}

            <div className="px-4 pb-4 mt-3">
              {visibleFaturas.length === 0 && (
                <div className="flex flex-col items-center text-center py-6">
                  <p className="text-sm font-semibold text-gray-700 mb-3 capitalize">
                    {formatBillMonth(selectedMonth)}
                  </p>
                  <div className="w-64 h-64 flex items-center justify-center overflow-hidden">
                    <img
                      src="/empty-faturas.png"
                      alt="Sem faturas"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-base font-bold text-gray-800 mt-2">Nenhuma fatura encontrada</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                    Para {formatBillMonth(selectedMonth)} você não possui faturas ou despesas registradas.
                  </p>
                </div>
              )}
            </div>
            <div className="px-4 space-y-3 pb-4">
              {visibleFaturas.map(fatura => (
                <div key={fatura.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-3.5 border-b border-gray-50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: (fatura.card?.color ?? '#9333ea') + '22' }}>
                        <CreditCard size={16} style={{ color: fatura.card?.color ?? '#9333ea' }} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{fatura.card?.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{formatBillMonth(fatura.billMonth)}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      fatura.allPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {fatura.allPaid ? 'Paga' : 'Em aberto'}
                    </span>
                  </div>

                  {/* Total + vencimento */}
                  <div className="px-3.5 py-3">
                    <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Total da fatura</p>
                      <p className="font-bold text-gray-900 text-lg">{formatCurrency(fatura.total)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {editingFatura === fatura.key ? (
                        <input type="date" value={editDueDate}
                          onChange={e => setEditDueDate(e.target.value)}
                          onBlur={() => saveFaturaDueDate(fatura, editDueDate)}
                          className="text-xs border border-purple-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 max-w-full"
                          autoFocus />
                      ) : (
                        <>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Vencimento</p>
                            <p className="text-xs font-medium text-gray-700">
                              {fatura.dueDate ? formatDate(fatura.dueDate) : '—'}
                            </p>
                          </div>
                          <button onClick={() => startEditDueDate(fatura)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50">
                            <Pencil size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    </div>
                    {(() => {
                      const limit    = cardLimits[fatura.cardId] || 0
                      const used     = cardUnpaid[fatura.cardId] || 0
                      const pct      = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
                      const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      if (!limit) return null
                      return (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">
                              <span className={pct >= 90 ? 'text-rose-600 font-semibold' : pct >= 70 ? 'text-amber-600 font-semibold' : 'text-gray-700'}>
                                {formatCurrency(used)}
                              </span>{' '}usado
                            </span>
                            <span className="text-gray-400">{formatCurrency(limit - used)} disponível</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Pay button */}
                  {!fatura.allPaid ? (
                    <div className="px-3.5 pb-3.5">
                      <button onClick={() => payFatura(fatura)} disabled={payingFatura === fatura.key}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-600 text-white text-sm font-semibold disabled:opacity-60 active:scale-98">
                        <Wallet size={15} />
                        {payingFatura === fatura.key ? 'Pagando...' : 'Pagar fatura'}
                      </button>
                    </div>
                  ) : (
                    <div className="px-3.5 pb-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                        <CheckCircle2 size={16} /> Paga
                      </div>
                      <button
                        onClick={() => unpayFatura(fatura)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <RotateCcw size={12} />
                        Desfazer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conta' : 'Nova conta'}>
        <BillForm initial={editing} onSuccess={() => { setShowModal(false); loadBills() }} onCancel={() => setShowModal(false)} />
      </Modal>
    </Layout>
  )
}
