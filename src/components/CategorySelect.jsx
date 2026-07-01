import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CategorySelect({ value, onChange, categories }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef(null)
  const dropRef = useRef(null)

  const selected = categories.find(c => c.id === value)

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropHeight = Math.min(192, categories.length * 44 + 44)
      const top = spaceBelow < dropHeight ? rect.top - dropHeight - 4 : rect.bottom + 4
      setPos({ top, left: rect.left, width: rect.width })
    }
    setOpen(v => !v)
  }

  useEffect(() => {
    function handleClick(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function select(id) {
    onChange(id)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        <span className="flex items-center gap-2 truncate text-gray-700">
          {selected ? <>{selected.icon} {selected.name}</> : <span className="text-gray-400">Sem categoria</span>}
        </span>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-y-auto max-h-48"
        >
          <button
            type="button"
            onClick={() => select('')}
            className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${!value ? 'bg-yellow-50 text-yellow-700 font-medium' : 'text-gray-500'}`}
          >
            Sem categoria
          </button>
          {categories.map(c => (
            <button
              type="button"
              key={c.id}
              onClick={() => select(c.id)}
              className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 border-t border-gray-100 hover:bg-gray-50 transition-colors ${value === c.id ? 'bg-yellow-50 text-yellow-700 font-medium' : 'text-gray-700'}`}
            >
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
