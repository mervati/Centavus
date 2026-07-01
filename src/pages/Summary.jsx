import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { formatCurrency, getMonthName } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#22c55e']

export default function Summary() {
  const { user } = useAuth()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState({ income: 0, expense: 0, savDep: 0, savWith: 0, byCategory: [], monthly: [] })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: tx } = await supabase
      .from('transactions')
      .select('*, categories(name,icon,color)')
      .eq('user_id', user.id)

    if (!tx) { setLoading(false); return }

    const monthTx = tx.filter(t => t.date.startsWith(month))
    const income = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const expense = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    const savDep = monthTx.filter(t => t.type === 'savings_deposit').reduce((a, t) => a + Number(t.amount), 0)
    const savWith = monthTx.filter(t => t.type === 'savings_withdrawal').reduce((a, t) => a + Number(t.amount), 0)

    // By category (expenses only)
    const catMap = {}
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      const key = t.categories?.name ?? 'Sem categoria'
      catMap[key] = (catMap[key] || 0) + Number(t.amount)
    })
    const byCategory = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Monthly history (last 6 months)
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(month + '-01')
      d.setMonth(d.getMonth() - i)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mTx = tx.filter(t => t.date.startsWith(ym))
      months.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        receita: mTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0),
        despesa: mTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0),
      })
    }

    setData({ income, expense, savDep, savWith, byCategory, monthly: months })
    setLoading(false)
  }, [user.id, month])

  useEffect(() => { loadData() }, [loadData])

  const balance = data.income - data.expense

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
              <p className="font-bold text-emerald-700 text-sm">{formatCurrency(data.income)}</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
              <p className="text-xs text-rose-600 mb-1">Despesas</p>
              <p className="font-bold text-rose-700 text-sm">{formatCurrency(data.expense)}</p>
            </div>
            <div className={`border rounded-2xl p-3 text-center ${balance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className={`text-xs mb-1 ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>Saldo</p>
              <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>{formatCurrency(balance)}</p>
            </div>
          </div>

          {/* Cofrinho */}
          {(data.savDep > 0 || data.savWith > 0) && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4">
              <div className="text-center flex-1">
                <p className="text-xs text-blue-600 mb-0.5">Depositado</p>
                <p className="font-bold text-blue-700">{formatCurrency(data.savDep)}</p>
              </div>
              <div className="w-px bg-blue-200" />
              <div className="text-center flex-1">
                <p className="text-xs text-blue-600 mb-0.5">Retirado</p>
                <p className="font-bold text-blue-700">{formatCurrency(data.savWith)}</p>
              </div>
            </div>
          )}

          {/* Bar chart */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthly} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value), name === 'receita' ? 'Receita' : 'Despesa']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                />
                <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          {data.byCategory.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">Despesas por categoria</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={v => formatCurrency(v)}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>

              {/* Category breakdown */}
              <div className="mt-2 space-y-2">
                {data.byCategory.map((cat, i) => {
                  const pct = data.expense > 0 ? (cat.value / data.expense * 100).toFixed(0) : 0
                  return (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-gray-700 truncate">{cat.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-700 ml-2 flex-shrink-0">{formatCurrency(cat.value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
