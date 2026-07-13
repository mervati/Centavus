import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { Plus, Trash2, Pencil, Lock } from 'lucide-react'

const ICONS = ['💰','💳','🏠','🚗','🍔','📚','❤️','🎮','👗','✈️','💼','💻','📈','💡','🛒','🎵','⚽','🎬','🍷','☕','🐶','👶','💊','🏋️','📱','🎁','🔧','💧','👵','🐷','💸']
const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#f97316','#8b5cf6','#22c55e','#6366f1','#14b8a6']

function CategoryForm({ initial, onSuccess, onCancel }) {
  const { user } = useAuth()
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [icon, setIcon] = useState(initial?.icon ?? '💰')
  const [color, setColor] = useState(initial?.color ?? '#7c3aed')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Informe um nome.')
    setLoading(true)
    const row = { user_id: user.id, name: name.trim(), type, icon, color }
    const { error: err } = initial?.id
      ? await supabase.from('categories').update(row).eq('id', initial.id)
      : await supabase.from('categories').insert(row)
    setLoading(false)
    if (err) return setError(err.message)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        {['expense', 'income'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
              type === t
                ? t === 'expense' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {t === 'expense' ? 'Despesa' : 'Receita'}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Alimentação"
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
        <div className="grid grid-cols-7 gap-2">
          {ICONS.map(ic => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={`h-10 text-xl rounded-xl flex items-center justify-center transition-all ${
                icon === ic ? 'bg-yellow-100 ring-2 ring-yellow-500' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium">Cancelar</button>
        <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-yellow-600 text-white font-medium disabled:opacity-60">
          {loading ? 'Salvando...' : initial?.id ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}

export default function Categories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState('expense')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setCategories(data ?? [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(cat) {
    if (cat.is_default) return  // categorias padrão não podem ser removidas
    if (!confirm('Remover esta categoria?')) return
    await supabase.from('categories').delete().eq('id', cat.id)
    loadData()
  }

  const filtered = categories.filter(c => c.type === tab)

  return (
    <Layout
      title="Categorias"
      action={
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white"
        >
          <Plus size={18} />
        </button>
      }
    >
      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 flex gap-2">
        {['expense', 'income'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t ? 'bg-yellow-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {t === 'expense' ? 'Despesas' : 'Receitas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🏷️</p>
          <p className="text-sm">Nenhuma categoria</p>
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {filtered.map(cat => (
            <div key={cat.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: cat.color + '22' }}
              >
                {cat.icon}
              </div>
              <p className="flex-1 font-medium text-gray-900 text-sm">{cat.name}</p>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(cat); setShowModal(true) }}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-yellow-600"
                >
                  <Pencil size={14} />
                </button>
                {cat.is_default ? (
                  <div className="w-7 h-7 flex items-center justify-center text-gray-300" title="Categoria padrão do sistema — não pode ser removida">
                    <Lock size={13} />
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(cat)}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar categoria' : 'Nova categoria'}>
        <CategoryForm
          initial={editing}
          onSuccess={() => { setShowModal(false); loadData() }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </Layout>
  )
}
