import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  const scrollYRef  = useRef(0)
  const backdropRef = useRef(null)

  // iOS body-lock: position fixed impede qualquer movimento da página
  useEffect(() => {
    if (open) {
      scrollYRef.current = window.scrollY
      document.body.style.position   = 'fixed'
      document.body.style.top        = `-${scrollYRef.current}px`
      document.body.style.width      = '100%'
      document.body.style.overflowY  = 'scroll'
    } else {
      document.body.style.position  = ''
      document.body.style.top       = ''
      document.body.style.width     = ''
      document.body.style.overflowY = ''
      window.scrollTo(0, scrollYRef.current)
    }
    return () => {
      document.body.style.position  = ''
      document.body.style.top       = ''
      document.body.style.width     = ''
      document.body.style.overflowY = ''
    }
  }, [open])

  // Impede touchmove no backdrop com passive:false (necessário para preventDefault funcionar)
  useEffect(() => {
    const el = backdropRef.current
    if (!el || !open) return
    const block = e => e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop — bloqueia toque na página por baixo */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />

      {/* Conteúdo do modal — permite scroll vertical dentro */}
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl z-10 max-h-[90vh] overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="sticky top-0 bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
