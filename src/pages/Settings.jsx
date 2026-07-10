import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { Bell, BellOff, RefreshCw, ChevronDown, ChevronUp, Moon, Sun, CreditCard, Trash2, Plus, Pencil, X, Send, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatCurrency, todayISO } from '../utils/format'
import { useTheme } from '../contexts/ThemeContext'
import CurrencyInput from '../components/CurrencyInput'

const CARD_COLORS = ['#6366f1','#3b82f6','#22c55e','#ef4444','#f97316','#ec4899','#eab308','#6b7280']


export default function Settings() {
  const { user, signOut } = useAuth()
  const [balance, setBalance] = useState(0)
  const [savings, setSavings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showRebalance, setShowRebalance] = useState(false)
  const [newBank, setNewBank] = useState('')
  const [newSavings, setNewSavings] = useState('')
  const [rebalancing, setRebalancing] = useState(false)
  const [rebalanceSuccess, setRebalanceSuccess] = useState(false)
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()
  const { dark, toggleDark } = useTheme()
  const [cards, setCards] = useState([])
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardName, setNewCardName] = useState('')
  const [newCardDay, setNewCardDay] = useState('')
  const [newCardColor, setNewCardColor] = useState('#6366f1')
  const [newCardLimit, setNewCardLimit] = useState(0)
  const [addingCard, setAddingCard] = useState(false)
  const [cardUsage, setCardUsage] = useState({})
  const [editingCardId, setEditingCardId] = useState(null)
  const [editName, setEditName]   = useState('')
  const [editDay, setEditDay]     = useState('')
  const [editColor, setEditColor] = useState('#6366f1')
  const [editLimit, setEditLimit] = useState(0)
  const [updatingCard, setUpdatingCard] = useState(false)
  const [telegramChatId, setTelegramChatId]   = useState(null)
  const [telegramDays1, setTelegramDays1]     = useState(1)
  const [telegramDays2, setTelegramDays2]     = useState(null)
  const [telegramHour, setTelegramHour]       = useState(8)

  const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? 'Centavuss_bot'

  const loadData = useCallback(async () => {
    const [{ data: s }, { data: tx }, { data: c }, { data: creditTx }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('id', user.id).single(),
      supabase.from('transactions').select('amount,type').eq('user_id', user.id),
      supabase.from('credit_cards').select('*').eq('user_id', user.id).order('name'),
      supabase.from('transactions')
        .select('card_id, amount')
        .eq('user_id', user.id)
        .eq('type', 'credit_expense')
        .eq('bill_paid', false),
    ])
    setCards(c ?? [])
    const usage = {}
    for (const t of (creditTx || [])) {
      if (!t.card_id) continue
      usage[t.card_id] = (usage[t.card_id] || 0) + Number(t.amount)
    }
    setCardUsage(usage)
    if (s) {
      setTelegramChatId(s.telegram_chat_id || null)
      setTelegramDays1(s.telegram_notify_days_1 ?? 1)
      setTelegramDays2(s.telegram_notify_days_2 ?? null)
      setTelegramHour(s.telegram_notify_hour ?? 8)
      const sum = (type) => (tx || []).filter(t => t.type === type).reduce((a, t) => a + Number(t.amount), 0)
      const income  = sum('income');  const expense = sum('expense')
      const savDep  = sum('savings_deposit'); const savWith = sum('savings_withdrawal')
      const cofInc  = sum('cofrinho_income'); const cofExp  = sum('cofrinho_expense')
      setBalance(Number(s.initial_balance) + income - expense - savDep + savWith)
      setSavings(Number(s.savings_initial) + savDep - savWith + cofInc - cofExp)
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function handleRebalance(e) {
    e.preventDefault()
    setRebalancing(true)

    // Busca a categoria "Re-balanço"
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Re-balanço')
      .maybeSingle()

    const inserts = []

    if (newBank !== '') {
      const diff = Number(newBank) - balance
      if (diff !== 0) {
        inserts.push({
          user_id: user.id,
          amount: Math.abs(diff),
          type: diff > 0 ? 'income' : 'expense',
          description: 'Re-balanço',
          date: todayISO(),
          category_id: category?.id ?? null,
        })
      }
    }

    if (newSavings !== '') {
      const diff = Number(newSavings) - savings
      if (diff !== 0) {
        inserts.push({
          user_id: user.id,
          amount: Math.abs(diff),
          type: diff > 0 ? 'savings_deposit' : 'savings_withdrawal',
          description: 'Re-balanço',
          date: todayISO(),
          category_id: category?.id ?? null,
        })
      }
    }

    if (inserts.length > 0) {
      await supabase.from('transactions').insert(inserts)
    }

    setRebalancing(false)
    setNewBank('')
    setNewSavings('')
    setShowRebalance(false)
    setRebalanceSuccess(true)
    setTimeout(() => setRebalanceSuccess(false), 3000)
    loadData()
  }

  async function handleAddCard(e) {
    e.preventDefault()
    if (!newCardName.trim() || !newCardDay) return
    const day = Number(newCardDay)
    if (day < 1 || day > 31) return
    setAddingCard(true)
    await supabase.from('credit_cards').insert({
      user_id: user.id, name: newCardName.trim(), closing_day: day, color: newCardColor,
      credit_limit: newCardLimit > 0 ? newCardLimit : null,
    })
    setNewCardName(''); setNewCardDay(''); setNewCardColor('#6366f1'); setNewCardLimit(0); setShowAddCard(false)
    setAddingCard(false)
    loadData()
  }

  async function handleDeleteCard(id) {
    if (!confirm('Remover este cartão? As transações vinculadas serão desvinculadas.')) return
    await supabase.from('credit_cards').delete().eq('id', id)
    loadData()
  }

  function startEditCard(card) {
    setEditingCardId(card.id)
    setEditName(card.name)
    setEditDay(String(card.closing_day))
    setEditColor(card.color)
    setEditLimit(Number(card.credit_limit) || 0)
  }

  async function handleUpdateCard(e) {
    e.preventDefault()
    const day = Number(editDay)
    if (!editName.trim() || !editDay || day < 1 || day > 31) return
    setUpdatingCard(true)
    await supabase.from('credit_cards').update({
      name:         editName.trim(),
      closing_day:  day,
      color:        editColor,
      credit_limit: editLimit > 0 ? editLimit : null,
    }).eq('id', editingCardId)
    setEditingCardId(null)
    setUpdatingCard(false)
    loadData()
  }

  async function handleDisconnectTelegram() {
    await supabase.from('user_settings').update({ telegram_chat_id: null }).eq('id', user.id)
    setTelegramChatId(null)
  }

  async function saveTelegramSettings({ days1, days2, hour } = {}) {
    const d1 = days1 !== undefined ? days1 : telegramDays1
    const d2 = days2 !== undefined ? days2 : telegramDays2
    const h  = hour  !== undefined ? hour  : telegramHour
    if (d1 === telegramDays1 && d2 === telegramDays2 && h === telegramHour) return
    setTelegramDays1(d1)
    setTelegramDays2(d2)
    setTelegramHour(h)
    await supabase.from('user_settings').update({
      telegram_notify_days_1: d1,
      telegram_notify_days_2: d2,
      telegram_notify_hour:   h,
    }).eq('id', user.id)
  }


  const initials = (user.email ?? '?')[0].toUpperCase()

  return (
    <Layout title="Configurações">
      <div className="px-4 py-5 space-y-6">

        {/* Perfil */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg leading-none">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{user.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">Conta pessoal</p>
          </div>
        </div>

        {/* Aparência */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Aparência</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? 'bg-gray-700' : 'bg-yellow-100'}`}>
                  {dark ? <Moon size={18} className="text-yellow-400" /> : <Sun size={18} className="text-yellow-600" />}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Tema escuro</p>
                  <p className="text-xs text-gray-400">{dark ? 'Ativado' : 'Desativado'}</p>
                </div>
              </div>
              <button
                onClick={toggleDark}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${dark ? 'bg-yellow-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${dark ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Notificações</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${telegramChatId ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Send size={18} className={telegramChatId ? 'text-blue-500' : 'text-gray-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">Telegram</p>
              <p className="text-xs text-gray-400">
                {telegramChatId ? 'Conectado — alertas ativos' : 'Receba alertas sobre contas'}
              </p>
            </div>
            {telegramChatId && (
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={13} className="text-white" fill="white" />
              </div>
            )}
          </div>

          {telegramChatId ? (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">

              {/* 1º Alerta */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">1º Alerta</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[{v:0,l:'No dia'},{v:1,l:'1 dia'},{v:2,l:'2 dias'},{v:3,l:'3 dias'},{v:5,l:'5 dias'},{v:7,l:'7 dias'}].map(opt => (
                    <button key={opt.v} onClick={() => saveTelegramSettings({ days1: opt.v })}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        telegramDays1 === opt.v
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2º Alerta */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500">2º Alerta</p>
                  <button
                    onClick={() => saveTelegramSettings({ days2: telegramDays2 !== null ? null : 3 })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${telegramDays2 !== null ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${telegramDays2 !== null ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
                {telegramDays2 !== null && (
                  <div className="flex gap-1.5 flex-wrap">
                    {[{v:0,l:'No dia'},{v:1,l:'1 dia'},{v:2,l:'2 dias'},{v:3,l:'3 dias'},{v:5,l:'5 dias'},{v:7,l:'7 dias'}].map(opt => (
                      <button key={opt.v} onClick={() => saveTelegramSettings({ days2: opt.v })}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                          telegramDays2 === opt.v
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Horário */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Horário (BRT)</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[6,7,8,9,10,12,18,20].map(h => (
                    <button key={h} onClick={() => saveTelegramSettings({ hour: h })}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        telegramHour === h
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                      {String(h).padStart(2,'0')}h
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleDisconnectTelegram}
                className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-500 text-sm font-medium hover:bg-rose-50 transition-all">
                Desconectar Telegram
              </button>
            </div>
          ) : (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
              {BOT_USERNAME ? (
                <>
                  <p className="text-xs text-gray-500">
                    Toque em "Conectar", abra o bot no Telegram e pressione <b>Iniciar</b>. Depois volte aqui e toque em "Já conectei".
                  </p>
                  <a
                    href={`https://t.me/${BOT_USERNAME}?start=${user.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold"
                  >
                    <Send size={15} /> Conectar com Telegram
                    <ExternalLink size={13} className="opacity-70" />
                  </a>
                  <button onClick={loadData}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                    Já conectei — verificar
                  </button>
                </>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
                  Configure <code className="font-mono">VITE_TELEGRAM_BOT_USERNAME</code> no arquivo <code className="font-mono">.env</code> para ativar.
                </p>
              )}
            </div>
          )}
        </div>
        </div>

        {/* Financeiro */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Financeiro</p>
          <div className="space-y-3">

        {/* Cartões de Crédito */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <CreditCard size={18} className="text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Cartões de Crédito</p>
                <p className="text-xs text-gray-400">{cards.length === 0 ? 'Nenhum cadastrado' : `${cards.length} cartão${cards.length !== 1 ? 'ões' : ''}`}</p>
              </div>
            </div>
            <button onClick={() => setShowAddCard(v => !v)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showAddCard ? 'bg-gray-200 text-gray-600' : 'bg-purple-100 text-purple-600'}`}>
              {showAddCard ? <X size={15} /> : <Plus size={15} />}
            </button>
          </div>

          {cards.length > 0 && (
            <div className="px-4 pb-3 space-y-3 border-t border-gray-100 pt-3">
              {cards.map(card => {
                const used  = cardUsage[card.id] || 0
                const limit = Number(card.credit_limit) || 0
                const pct   = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
                const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

                if (editingCardId === card.id) {
                  return (
                    <form key={card.id} onSubmit={handleUpdateCard} className="bg-gray-50 rounded-2xl p-3 space-y-3 border border-gray-200">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nome do cartão</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dia de fechamento</label>
                        <input type="number" min="1" max="31" value={editDay} onChange={e => setEditDay(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Limite do cartão (R$)</label>
                        <CurrencyInput value={editLimit} onChange={setEditLimit} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Cor</label>
                        <div className="flex gap-2 flex-wrap">
                          {CARD_COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setEditColor(c)}
                              className={`w-7 h-7 rounded-full transition-transform ${editColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingCardId(null)}
                          className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium">
                          Cancelar
                        </button>
                        <button type="submit" disabled={updatingCard || !editName.trim() || !editDay}
                          className="flex-1 py-2 rounded-xl bg-yellow-600 text-white text-sm font-semibold disabled:opacity-60">
                          {updatingCard ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  )
                }

                return (
                  <div key={card.id} className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: card.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{card.name}</p>
                      <p className="text-xs text-gray-400">Fecha dia {card.closing_day}</p>
                      {limit > 0 && (
                        <div className="mt-1.5">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">
                              <span className={pct >= 90 ? 'text-rose-600 font-semibold' : pct >= 70 ? 'text-amber-600 font-semibold' : 'text-gray-700'}>
                                {formatCurrency(used)}
                              </span>
                              {' '}usado
                            </span>
                            <span className="text-gray-400">{formatCurrency(limit - used)} disponível</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEditCard(card)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-yellow-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteCard(card.id)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {showAddCard && (
            <form onSubmit={handleAddCard} className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome do cartão</label>
                <input type="text" placeholder="Ex: Santander, Neon..."
                  value={newCardName} onChange={e => setNewCardName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dia de fechamento</label>
                <input type="number" min="1" max="31" placeholder="Ex: 15"
                  value={newCardDay} onChange={e => setNewCardDay(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Limite do cartão (R$)</label>
                <CurrencyInput value={newCardLimit} onChange={setNewCardLimit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {CARD_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewCardColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${newCardColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={addingCard || !newCardName.trim() || !newCardDay}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-60">
                {addingCard ? 'Adicionando...' : 'Adicionar cartão'}
              </button>
            </form>
          )}
        </div>

          </div>{/* fim space-y-3 Financeiro */}
        </div>{/* fim section Financeiro */}

        {/* Avançado */}
        {!loading && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Avançado</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowRebalance(v => !v)}
              className="w-full p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <RefreshCw size={17} className="text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">Rebalanço</p>
                  <p className="text-xs text-gray-400">Corrigir o saldo atual</p>
                </div>
              </div>
              {showRebalance
                ? <ChevronUp size={18} className="text-gray-400" />
                : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {showRebalance && (
              <form onSubmit={handleRebalance} className="px-4 pb-4 space-y-4 border-t border-gray-100">
                  <div className="mt-4 grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Banco atual</p>
                    <p className={`font-bold text-sm ${balance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Cofrinho atual</p>
                    <p className="font-bold text-sm text-blue-600">{formatCurrency(savings)}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Novo Saldo Banco (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Deixe em branco para não alterar"
                    value={newBank}
                    onChange={e => setNewBank(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Novo Cofrinho (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Deixe em branco para não alterar"
                    value={newSavings}
                    onChange={e => setNewSavings(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <p className="text-xs text-gray-400">
                  A diferença será registrada como transação "Re-balanço" no histórico.
                </p>

                <button
                  type="submit"
                  disabled={rebalancing || (newBank === '' && newSavings === '')}
                  className="w-full py-3 rounded-xl bg-yellow-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw size={16} />
                  {rebalancing ? 'Aplicando...' : 'Aplicar rebalanço'}
                </button>
              </form>
            )}
          </div>

          {rebalanceSuccess && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <p className="text-emerald-700 text-sm font-medium">Rebalanço aplicado! Saldo atualizado.</p>
            </div>
          )}
        </div>
        )}

        {/* Conta */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Conta</p>
          <button
            onClick={signOut}
            className="w-full py-3 rounded-2xl bg-white shadow-sm border border-rose-100 text-rose-500 font-medium text-sm"
          >
            Sair da conta
          </button>
        </div>

      </div>
    </Layout>
  )
}
