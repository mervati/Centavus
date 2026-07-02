import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import CategorySelect from './CategorySelect'
import CurrencyInput from './CurrencyInput'
import { todayISO, formatCurrency } from '../utils/format'
import { CreditCard, Wallet, PiggyBank, AlertCircle } from 'lucide-react'

function calcBillMonth(purchaseDate, closingDay, installmentIndex) {
  const d = new Date(purchaseDate + 'T12:00:00')
  const purchaseDay = d.getDate()
  const baseMonth = purchaseDay >= closingDay
    ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
    : new Date(d.getFullYear(), d.getMonth(), 1)
  const billDate = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + installmentIndex, 1)
  return billDate.toISOString().split('T')[0]
}

const MAIN_TYPES = [
  { value: 'income',       label: 'Receita',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'expense',      label: 'Despesa',    cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'transfer',     label: 'Cofrinho +', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'transfer_out', label: 'Cofrinho -', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
]

export default function TransactionForm({ onSuccess, onCancel, initial }) {
  const { user } = useAuth()
  const [mainType, setMainType]         = useState('expense')
  const [payMethod, setPayMethod]       = useState('')
  const [wallet, setWallet]             = useState('banco')
  const [selectedCard, setSelectedCard] = useState(null)
  const [installments, setInstallments] = useState(1)
  const [amount, setAmount]             = useState(0)
  const [description, setDescription]   = useState('')
  const [date, setDate]                 = useState(todayISO())
  const [categoryId, setCategoryId]     = useState('')
  const [categories, setCategories]     = useState([])
  const [cards, setCards]               = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const pendingCatId = useRef(null)

  const isTransfer  = mainType === 'transfer' || mainType === 'transfer_out'
  const isPayFlow   = mainType === 'income' || mainType === 'expense'
  const showDetails = isTransfer || payMethod !== ''

  useEffect(() => {
    supabase.from('credit_cards').select('*').eq('user_id', user.id).order('name')
      .then(({ data }) => setCards(data ?? []))
  }, [user.id])

  useEffect(() => {
    const catType = mainType === 'income' ? 'income' : 'expense'
    supabase.from('categories').select('*').eq('user_id', user.id).eq('type', catType).order('name')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (pendingCatId.current !== null) {
          setCategoryId(pendingCatId.current)
          pendingCatId.current = null
        } else if (!initial?.id) {
          setCategoryId('')
        }
      })
  }, [mainType, user.id])

  // Preenche o formulário ao editar
  useEffect(() => {
    if (!initial?.id) return
    const t = initial.type

    if (t === 'savings_deposit')   { setMainType('transfer');     setPayMethod('') }
    else if (t === 'savings_withdrawal') { setMainType('transfer_out'); setPayMethod('') }
    else if (t === 'credit_expense') {
      setMainType('expense')
      setPayMethod('credit')
      setSelectedCard(initial.card_id || null)
      setInstallments(initial.installments || 1)
    } else {
      const main = (t === 'income' || t === 'cofrinho_income') ? 'income' : 'expense'
      setMainType(main)
      setPayMethod('pix')
      setWallet(t === 'cofrinho_income' || t === 'cofrinho_expense' ? 'cofrinho' : (initial.wallet || 'banco'))
    }

    setAmount(initial.amount ?? 0)
    setDescription(initial.description ?? '')
    setDate(initial.date ?? todayISO())
    setCategoryId(initial.category_id || '')
    pendingCatId.current = initial.category_id || ''
  }, [initial])

  function selectMain(type) {
    setMainType(type)
    setPayMethod('')
    setSelectedCard(null)
    setInstallments(1)
  }

  function resolveType() {
    if (mainType === 'transfer')     return 'savings_deposit'
    if (mainType === 'transfer_out') return 'savings_withdrawal'
    if (payMethod === 'credit')      return 'credit_expense'
    if (mainType === 'income')       return wallet === 'cofrinho' ? 'cofrinho_income'  : 'income'
    if (mainType === 'expense')      return wallet === 'cofrinho' ? 'cofrinho_expense' : 'expense'
    return 'expense'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!amount || amount <= 0) return setError('Informe um valor válido.')
    if (!description.trim()) return setError('Informe uma descrição.')
    if (payMethod === 'credit' && !selectedCard) return setError('Selecione um cartão.')
    setLoading(true)

    const type     = resolveType()
    const totalAmt = amount

    if (type === 'credit_expense') {
      const card = cards.find(c => c.id === selectedCard)
      if (initial?.id) {
        // Edição: atualiza apenas a parcela específica
        const installNum = initial.installment_number ?? 1
        const totalInst  = initial.installments ?? 1
        const row = {
          amount:             Math.round(totalAmt / totalInst * 100) / 100,
          total_amount:       totalAmt,
          description:        totalInst > 1 ? `${description.trim()} ${installNum}/${totalInst}` : description.trim(),
          date,
          category_id:        categoryId || null,
          card_id:            selectedCard,
          bill_month:         calcBillMonth(date, card?.closing_day ?? 1, installNum - 1),
        }
        const { error: err } = await supabase.from('transactions').update(row).eq('id', initial.id)
        setLoading(false)
        if (err) return setError(err.message)
      } else {
        // Nova transação: insere todas as parcelas
        const installAmt = Math.round(totalAmt / installments * 100) / 100
        const rows = Array.from({ length: installments }, (_, i) => ({
          user_id:            user.id,
          type:               'credit_expense',
          amount:             installAmt,
          total_amount:       totalAmt,
          description:        installments > 1 ? `${description.trim()} ${i + 1}/${installments}` : description.trim(),
          date,
          category_id:        categoryId || null,
          payment_method:     'credit',
          card_id:            selectedCard,
          installments,
          installment_number: i + 1,
          bill_month:         calcBillMonth(date, card.closing_day, i),
          bill_paid:          false,
        }))
        const { error: err } = await supabase.from('transactions').insert(rows)
        setLoading(false)
        if (err) return setError(err.message)
      }
    } else {
      const row = {
        user_id:        user.id,
        type,
        amount:         totalAmt,
        description:    description.trim(),
        date,
        category_id:    categoryId || null,
        payment_method: isTransfer ? 'pix' : payMethod || 'pix',
        wallet:         isTransfer ? null  : wallet,
      }
      const { error: err } = initial?.id
        ? await supabase.from('transactions').update(row).eq('id', initial.id)
        : await supabase.from('transactions').insert(row)
      setLoading(false)
      if (err) return setError(err.message)
    }
    onSuccess()
  }

  const installAmt = installments > 1 && amount > 0
    ? formatCurrency(Math.round(amount / installments * 100) / 100)
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        {MAIN_TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => selectMain(t.value)}
            className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
              mainType === t.value ? t.cls + ' border-current' : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Forma de pagamento */}
      {isPayFlow && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Forma de pagamento</p>
          <div className={`grid gap-2 ${mainType === 'expense' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button type="button" onClick={() => setPayMethod('pix')}
              className={`py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                payMethod === 'pix' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}>
              <Wallet size={15} /> Pix
            </button>
            {mainType === 'expense' && (
              <button type="button" onClick={() => setPayMethod('credit')}
                className={`py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  payMethod === 'credit' ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                <CreditCard size={15} /> Crédito
              </button>
            )}
          </div>

          {/* Pix: carteira */}
          {payMethod === 'pix' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setWallet('banco')}
                className={`py-2 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                  wallet === 'banco' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                <Wallet size={13} /> Banco
              </button>
              <button type="button" onClick={() => setWallet('cofrinho')}
                className={`py-2 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                  wallet === 'cofrinho' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                <PiggyBank size={13} /> Cofrinho
              </button>
            </div>
          )}

          {/* Crédito: cartão + parcelas */}
          {payMethod === 'credit' && (
            <div className="mt-2 space-y-3">
              {cards.length === 0 ? (
                <p className="text-xs text-center text-gray-500 bg-gray-50 rounded-xl py-3">
                  Nenhum cartão cadastrado. Adicione em Configurações.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {cards.map(card => (
                    <button key={card.id} type="button" onClick={() => setSelectedCard(card.id)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                        selectedCard === card.id ? 'text-white' : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                      style={selectedCard === card.id ? { backgroundColor: card.color, borderColor: card.color } : {}}>
                      {card.name}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Parcelas</p>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <button key={n} type="button" onClick={() => setInstallments(n)}
                      className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        installments === n ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campos de detalhe */}
      {showDetails && (
        <>
          <div>
            <CurrencyInput label="Valor (R$)" value={amount} onChange={setAmount} autoFocus />
            {payMethod === 'credit' && installAmt && (
              <p className="text-xs text-gray-500 mt-1">{installments}x de {installAmt}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" placeholder="Ex: Supermercado, Salário..."
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full max-w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>

          {isPayFlow && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
              <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
              <p className="text-sm font-medium text-rose-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-yellow-600 text-white font-medium disabled:opacity-60">
              {loading ? 'Salvando...' : initial?.id ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
