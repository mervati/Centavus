import { useState, useEffect } from 'react'

const DURATION = 1400

export default function SplashScreen() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = performance.now()
    let raf

    function tick(now) {
      const elapsed = now - start
      const p = Math.min((elapsed / DURATION) * 100, 100)
      setProgress(p)
      if (p < 100) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 z-50">
      {/* Ícone */}
      <img
        src="/logo.png"
        alt="Centavus"
        className="w-24 h-24 rounded-3xl shadow-lg"
      />

      {/* Nome e slogan */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Centavus</h1>
        <p className="text-sm text-gray-400 mt-1">Suas finanças pessoais</p>
      </div>

      {/* Barra de progresso */}
      <div className="w-56 mt-2">
        <div className="flex justify-end mb-1">
          <span
            className="text-xs font-semibold text-yellow-500"
            style={{ transition: 'opacity 0.3s' }}
          >
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
