import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, FileText, BarChart2, Tag } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/transacoes', icon: ArrowLeftRight, label: 'Transações' },
  { to: '/contas', icon: FileText, label: 'Contas' },
  { to: '/resumo', icon: BarChart2, label: 'Resumo' },
  { to: '/categorias', icon: Tag, label: 'Categorias' },
]

export default function BottomNav() {
  return (
    <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-bottom z-40">
      <div className="flex max-w-lg mx-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors ${
                isActive ? 'text-yellow-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.75} />
            <span className="mt-0.5">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
