import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, getMonthName } from '../utils/format'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS         = ['#ef4444', '#dc2626', '#f87171', '#b91c1c', '#fca5a5', '#991b1b', '#fecaca', '#7f1d1d', '#f97316', '#fb923c']
const COLORS_INCOME  = ['#10b981', '#34d399', '#059669', '#6ee7b7', '#22c55e', '#16a34a', '#4ade80', '#15803d', '#86efac', '#166534']

const tooltipStyle = { borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }

// Componentes de gráfico isolados com memo para evitar re-renders desnecessários
const MonthlyBarChart = memo(function MonthlyBarChart({ data }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Últimos 6 meses</h3>
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <ResponsiveContainer width="99%" height={200}>
          <BarChart data={data} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={36} />
            <Tooltip
              formatter={(value, name) => [formatCurrency(value), name === 'receita' ? 'Receita' : 'Despesa']}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})

const EvolutionLineChart = memo(function EvolutionLineChart({ data }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Evolução do saldo</h3>
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <ResponsiveContainer width="99%" height={200}>
          <LineChart data={data} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={36} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={tooltipStyle}
            />
            <Line type="monotone" dataKey="saldo" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})

const CategoryComparison = memo(function CategoryComparison({ currentMonth, previousMonth, allCategories }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Comparação mês a mês (Despesas)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-700">Categoria</th>
              <th className="text-right py-2 px-2 font-medium text-gray-700">Este mês</th>
              <th className="text-right py-2 px-2 font-medium text-gray-700">Mês anterior</th>
              <th className="text-right py-2 px-2 font-medium text-gray-700">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {allCategories.map((cat, i) => {
              const current = currentMonth[cat.name] ?? 0
              const previous = previousMonth[cat.name] ?? 0
              const diff = current - previous
              const diffPct = previous > 0 ? ((diff / previous) * 100).toFixed(0) : '—'
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-900 flex items-center gap-2">
                    <span>{cat.icon}</span> {cat.name}
                  </td>
                  <td className="text-right py-2 px-2 text-gray-700">{formatCurrency(current)}</td>
                  <td className="text-right py-2 px-2 text-gray-500">{formatCurrency(previous)}</td>
                  <td className={`text-right py-2 px-2 font-medium ${diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {diff !== 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                    {diffPct !== '—' && <span className="text-gray-400 ml-1">({diffPct}%)</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})

const CategoryPieChart = memo(function CategoryPieChart({ title, data, total, colors, onCategoryClick }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">{title}</h3>
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <ResponsiveContainer width="99%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={v => formatCurrency(v)} contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-2">
        {data.map((cat, i) => {
          const pct = total > 0 ? (cat.value / total * 100).toFixed(0) : 0
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => onCategoryClick?.(cat)}
              className="flex items-center gap-2 w-full text-left rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors px-1 py-1 -mx-1"
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700 truncate">{cat.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                </div>
              </div>
              <span className="text-xs font-medium text-gray-700 ml-2 flex-shrink-0">{formatCurrency(cat.value)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})

export default function Summary() {
  const { user } = useAuth()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [rawTx, setRawTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [catModal, setCatModal] = useState(null) // { name, icon, color, type }

  const loadData = useCallback(async () => {
    setLoading(true)

    // Busca apenas os 6 meses necessários para o painel, sem trazer histórico todo
    const [y, m] = month.split('-').map(Number)
    const startDate = new Date(y, m - 1 - 5, 1)
    const endDate   = new Date(y, m, 1)
    const fromISO = startDate.toISOString().split('T')[0]
    const toISO   = endDate.toISOString().split('T')[0]

    const { data: tx } = await supabase
      .from('transactions')
      .select('amount,type,date,description,categories(name,icon,color)')
      .eq('user_id', user.id)
      .gte('date', fromISO)
      .lt('date', toISO)

    setRawTx(tx ?? [])
    setLoading(false)
  }, [user.id, month])

  useEffect(() => { loadData() }, [loadData])

  // Todos os cálculos derivados via useMemo — recalculam só quando rawTx ou month mudam
  const derived = useMemo(() => {
    const monthTx  = rawTx.filter(t => t.date.startsWith(month))
    const income   = monthTx.filter(t => t.type === 'income' || t.type === 'cofrinho_income').reduce((a, t) => a + Number(t.amount), 0)
    const expense  = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    const savDep   = monthTx.filter(t => t.type === 'savings_deposit').reduce((a, t) => a + Number(t.amount), 0)
    const savWith  = monthTx.filter(t => t.type === 'savings_withdrawal').reduce((a, t) => a + Number(t.amount), 0)

    const catMap = {}
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      if (!catMap[key]) catMap[key] = { value: 0, icon: t.categories?.icon ?? '📦', color: t.categories?.color ?? '#6b7280' }
      catMap[key].value += Number(t.amount)
    })
    const byCategory = Object.entries(catMap).map(([name, v]) => ({ name, value: v.value, icon: v.icon, color: v.color })).sort((a, b) => b.value - a.value)

    const incomeMap = {}
    monthTx.filter(t => t.type === 'income' || t.type === 'cofrinho_income').forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      if (!incomeMap[key]) incomeMap[key] = { value: 0, icon: t.categories?.icon ?? '📦', color: t.categories?.color ?? '#6b7280' }
      incomeMap[key].value += Number(t.amount)
    })
    const byCategoryIncome = Object.entries(incomeMap).map(([name, v]) => ({ name, value: v.value, icon: v.icon, color: v.color })).sort((a, b) => b.value - a.value)

    const [y, m] = month.split('-').map(Number)
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(y, m - 1 - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mTx = rawTx.filter(t => t.date.startsWith(ym))
      monthly.push({
        name:    d.toLocaleDateString('pt-BR', { month: 'short' }),
        receita: mTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0),
        despesa: mTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0),
      })
    }

    // Comparação mês a mês
    const [py, pm] = (() => {
      const prev = new Date(y, m - 2, 1)
      return [prev.getFullYear(), String(prev.getMonth() + 1).padStart(2, '0')]
    })()
    const prevYM = `${py}-${pm}`

    const prevMonthTx = rawTx.filter(t => t.date.startsWith(prevYM) && t.type === 'expense')
    const prevCatMap = {}
    prevMonthTx.forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      prevCatMap[key] = (prevCatMap[key] ?? 0) + Number(t.amount)
    })

    const currCatMap = {}
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      currCatMap[key] = (currCatMap[key] ?? 0) + Number(t.amount)
    })

    const allCats = [...new Set([...Object.keys(currCatMap), ...Object.keys(prevCatMap)])].sort()
    const comparisonCats = allCats.map(name => {
      const cat = byCategory.find(b => b.name === name) || { name, icon: '📦', color: '#6b7280' }
      return cat
    })

    return { income, expense, savDep, savWith, byCategory, byCategoryIncome, monthly, currCatMap, prevCatMap, comparisonCats }
  }, [rawTx, month])

  const balance = derived.income - derived.expense

  return (
    <Layout title="Resumo">
      {/* Month selector */}
      <div className="px-4 py-3">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 space-y-4 pb-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
              <p className="text-xs text-emerald-600 mb-1">Receitas</p>
              <p className="font-bold text-emerald-700 text-sm">{formatCurrency(derived.income)}</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
              <p className="text-xs text-rose-600 mb-1">Despesas</p>
              <p className="font-bold text-rose-700 text-sm">{formatCurrency(derived.expense)}</p>
            </div>
            <div className={`border rounded-2xl p-3 text-center ${balance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className={`text-xs mb-1 ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>Saldo</p>
              <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>{formatCurrency(balance)}</p>
            </div>
          </div>

          {/* Cofrinho */}
          {(derived.savDep > 0 || derived.savWith > 0) && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4">
              <div className="text-center flex-1">
                <p className="text-xs text-blue-600 mb-0.5">Depositado</p>
                <p className="font-bold text-blue-700">{formatCurrency(derived.savDep)}</p>
              </div>
              <div className="w-px bg-blue-200" />
              <div className="text-center flex-1">
                <p className="text-xs text-blue-600 mb-0.5">Retirado</p>
                <p className="font-bold text-blue-700">{formatCurrency(derived.savWith)}</p>
              </div>
            </div>
          )}

          <MonthlyBarChart data={derived.monthly} />

          <EvolutionLineChart data={derived.monthly} />

          <CategoryComparison
            currentMonth={derived.currCatMap}
            previousMonth={derived.prevCatMap}
            allCategories={derived.comparisonCats}
          />

          {derived.byCategoryIncome.length > 0 && (
            <CategoryPieChart
              title="Receitas por categoria"
              data={derived.byCategoryIncome}
              total={derived.income}
              colors={COLORS_INCOME}
              onCategoryClick={cat => setCatModal({ ...cat, type: 'income' })}
            />
          )}

          {derived.byCategory.length > 0 && (
            <CategoryPieChart
              title="Despesas por categoria"
              data={derived.byCategory}
              total={derived.expense}
              colors={COLORS}
              onCategoryClick={cat => setCatModal({ ...cat, type: 'expense' })}
            />
          )}
        </div>
      )}
      {/* Modal de transações por categoria */}
      <Modal
        open={!!catModal}
        onClose={() => setCatModal(null)}
        title={catModal ? `${catModal.icon} ${catModal.name}` : ''}
      >
        {catModal && (() => {
          const txs = rawTx
            .filter(t => t.date.startsWith(month) && (t.categories?.name ?? 'Sem categoria') === catModal.name)
            .sort((a, b) => b.date.localeCompare(a.date))
          const total = txs.reduce((s, t) => s + Number(t.amount), 0)
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">{txs.length} transaç{txs.length === 1 ? 'ão' : 'ões'}</span>
                <span className={`text-sm font-bold ${catModal.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {catModal.type === 'income' ? '+' : '-'}{formatCurrency(total)}
                </span>
              </div>
              {txs.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">Nenhuma transação</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {txs.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: (catModal.color ?? '#6b7280') + '22' }}>
                        {catModal.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.description ?? '—'}</p>
                        <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
                      </div>
                      <span className={`text-sm font-semibold flex-shrink-0 ${catModal.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {catModal.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </Modal>
    </Layout>
  )
}
