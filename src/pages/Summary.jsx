import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { formatCurrency, getMonthName } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS         = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#22c55e']
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

const CategoryPieChart = memo(function CategoryPieChart({ title, data, total, colors }) {
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
            <div key={cat.name} className="flex items-center gap-2">
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
            </div>
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
      .select('amount,type,date,categories(name)')
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
    const income   = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const expense  = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    const savDep   = monthTx.filter(t => t.type === 'savings_deposit').reduce((a, t) => a + Number(t.amount), 0)
    const savWith  = monthTx.filter(t => t.type === 'savings_withdrawal').reduce((a, t) => a + Number(t.amount), 0)

    const catMap = {}
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      catMap[key] = (catMap[key] || 0) + Number(t.amount)
    })
    const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    const incomeMap = {}
    monthTx.filter(t => t.type === 'income').forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      incomeMap[key] = (incomeMap[key] || 0) + Number(t.amount)
    })
    const byCategoryIncome = Object.entries(incomeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

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

    return { income, expense, savDep, savWith, byCategory, byCategoryIncome, monthly }
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

          {derived.byCategoryIncome.length > 0 && (
            <CategoryPieChart
              title="Receitas por categoria"
              data={derived.byCategoryIncome}
              total={derived.income}
              colors={COLORS_INCOME}
            />
          )}

          {derived.byCategory.length > 0 && (
            <CategoryPieChart
              title="Despesas por categoria"
              data={derived.byCategory}
              total={derived.expense}
              colors={COLORS}
            />
          )}
        </div>
      )}
    </Layout>
  )
}
