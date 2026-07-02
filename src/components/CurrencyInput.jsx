import { useState, useEffect } from 'react'

function formatCents(cents) {
  const str = String(Math.abs(cents)).padStart(3, '0')
  const intPart = str.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return intPart + ',' + str.slice(-2)
}

export default function CurrencyInput({ value = 0, onChange, autoFocus = false, label }) {
  const [rawCents, setRawCents] = useState(Math.round((value || 0) * 100))

  useEffect(() => {
    const fromProp = Math.round((value || 0) * 100)
    if (fromProp !== rawCents) setRawCents(fromProp)
  }, [value])

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
    const cents = Number(digits) || 0
    setRawCents(cents)
    onChange(cents / 100)
  }

  function handleFocus(e) {
    const len = e.target.value.length
    e.target.setSelectionRange(len, len)
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-yellow-500 bg-white">
        <span className="text-gray-700 font-medium text-base mr-1 select-none">R$</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus={autoFocus}
          value={formatCents(rawCents)}
          onChange={handleChange}
          onFocus={handleFocus}
          onClick={handleFocus}
          className="flex-1 outline-none text-base bg-transparent text-gray-900"
        />
      </div>
    </div>
  )
}
