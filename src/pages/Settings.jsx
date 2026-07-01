import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { Save, Bell, BellOff } from 'lucide-react'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [initialBalance, setInitialBalance] = useState('')
  const [savingsInitial, setSavingsInitial] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('user_settings').select('*').eq('id', user.id).single()
    if (data) {
      setInitialBalance(data.initial_balance)
      setSavingsInitial(data.savings_initial)
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('user_settings').upsert({
      id: user.id,
      initial_balance: Number(initialBalance) || 0,
      savings_initial: Number(savingsInitial) || 0,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <Layout title="Configurações">
      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Conta</p>
          <p className="font-medium text-gray-900">{user.email}</p>
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

        {!loading && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-semibold text-gray-900">Saldos iniciais</h3>
            <p className="text-xs text-gray-500 -mt-2">Ajuste o ponto de partida para o cálculo do saldo.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={e => setInitialBalance(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cofrinho inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                value={savingsInitial}
                onChange={e => setSavingsInitial(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                success ? 'bg-emerald-600 text-white' : 'bg-yellow-600 text-white disabled:opacity-60'
              }`}
            >
              <Save size={16} />
              {saving ? 'Salvando...' : success ? 'Salvo!' : 'Salvar alterações'}
            </button>
          </form>
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
