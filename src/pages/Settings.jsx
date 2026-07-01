import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { Bell, BellOff, RefreshCw, ChevronDown, ChevronUp, Moon, Sun } from 'lucide-react'
import { formatCurrency, todayISO } from '../utils/format'
import { useTheme } from '../contexts/ThemeContext'

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

  const loadData = useCallback(async () => {
    const [{ data: s }, { data: tx }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('id', user.id).single(),
      supabase.from('transactions').select('amount,type').eq('user_id', user.id),
    ])
    if (s) {
      const income   = (tx || []).filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
      const expense  = (tx || []).filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
      const savDep   = (tx || []).filter(t => t.type === 'savings_deposit').reduce((a, t) => a + Number(t.amount), 0)
      const savWith  = (tx || []).filter(t => t.type === 'savings_withdrawal').reduce((a, t) => a + Number(t.amount), 0)
      setBalance(Number(s.initial_balance) + income - expense - savDep + savWith)
      setSavings(Number(s.savings_initial) + savDep - savWith)
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function handleRebalance(e) {
    e.preventDefault()
    setRebalancing(true)
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
          category_id: null,
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
          category_id: null,
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

  return (
    <Layout title="Configurações">
      <div className="px-4 py-4 space-y-4">

        {/* Conta */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Conta</p>
          <p className="font-medium text-gray-900">{user.email}</p>
        </div>

        {/* Tema */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-gray-700' : 'bg-yellow-100'}`}>
                {dark ? <Moon size={20} className="text-yellow-400" /> : <Sun size={20} className="text-yellow-600" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Tema</p>
                <p className="text-xs text-gray-500">{dark ? 'Modo escuro ativo' : 'Modo claro ativo'}</p>
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

        {/* Notificações */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${subscribed ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                {subscribed ? <Bell size={20} className="text-yellow-600" /> : <BellOff size={20} className="text-gray-400" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Lembretes de contas</p>
                <p className="text-xs text-gray-500">
                  {permission === 'denied'
                    ? 'Bloqueado nas configurações do navegador'
                    : subscribed
                    ? 'Notificação 1 dia antes do vencimento'
                    : 'Receba alertas no celular'}
                </p>
              </div>
            </div>
            {permission !== 'denied' && (
              <button
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={pushLoading}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${subscribed ? 'bg-yellow-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${subscribed ? 'left-7' : 'left-1'}`} />
              </button>
            )}
          </div>
        </div>

        {/* Rebalanço */}
        {!loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowRebalance(v => !v)}
              className="w-full p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <RefreshCw size={18} className="text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">Rebalanço</p>
                  <p className="text-xs text-gray-500">Corrigir o saldo atual</p>
                </div>
              </div>
              {showRebalance
                ? <ChevronUp size={18} className="text-gray-400" />
                : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {showRebalance && (
              <form onSubmit={handleRebalance} className="px-4 pb-4 space-y-4 border-t border-gray-100">
                {/* Valores atuais */}
                <div className="mt-4 grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Saldo Banco atual</p>
                    <p className={`font-bold text-sm ${balance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Cofrinho atual</p>
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
        )}

        {/* Feedback de sucesso */}
        {rebalanceSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <p className="text-emerald-700 text-sm font-medium">Rebalanço aplicado! Saldo atualizado.</p>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full py-3 rounded-2xl border border-rose-200 text-rose-600 font-medium"
        >
          Sair da conta
        </button>
      </div>
    </Layout>
  )
}
