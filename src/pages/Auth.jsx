import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const { error: err } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password)

    setLoading(false)
    if (err) return setError(err.message)
    if (mode === 'register') setSuccess('Verifique seu e-mail para confirmar o cadastro!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Centavus" className="w-28 h-28 mx-auto mb-3 rounded-3xl shadow-xl" />
          <h1 className="text-3xl font-black text-white tracking-wide">CENTAVUS</h1>
          <p className="text-yellow-400 text-xs mt-1 tracking-widest uppercase">Finanças Pessoais · PWA</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-yellow-600 text-white font-semibold disabled:opacity-60 mt-2"
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
