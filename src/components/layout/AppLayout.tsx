import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import {
  LayoutDashboard, ScanLine, Package, Trash2, UtensilsCrossed,
  Bell, TrendingUp, Truck, Settings, LogOut, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'nav.dashboard' },
  { to: '/scan', icon: ScanLine, label: 'nav.scan' },
  { to: '/inventory', icon: Package, label: 'nav.inventory' },
  { to: '/waste', icon: Trash2, label: 'nav.waste' },
  { to: '/dishes', icon: UtensilsCrossed, label: 'nav.dishes' },
  { to: '/alerts', icon: Bell, label: 'nav.alerts' },
  { to: '/consumption', icon: TrendingUp, label: 'nav.consumption' },
  { to: '/suppliers', icon: Truck, label: 'nav.suppliers' },
  { to: '/settings', icon: Settings, label: 'nav.settings' },
]

export default function AppLayout() {
  const { t } = useTranslation()
  const { signOut, restaurant } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed inset-y-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">W</div>
          <span className="text-lg font-bold text-white">WastedFood</span>
        </div>

        {/* Restaurant name */}
        {restaurant && (
          <div className="px-5 py-3 border-b border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Restaurant</p>
            <p className="text-sm font-medium text-slate-200 truncate">{restaurant.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600/15 text-brand-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">W</div>
            <span className="text-base font-bold text-white">WastedFood</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-400 hover:text-white">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-slate-950/80" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-14 right-0 w-64 bg-slate-900 border-l border-slate-800 h-[calc(100vh-56px)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {restaurant && (
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Restaurant</p>
                <p className="text-sm font-medium text-slate-200 truncate">{restaurant.name}</p>
              </div>
            )}
            <nav className="px-3 py-4 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-600/15 text-brand-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-800">
              <button
                onClick={() => { signOut(); setMobileOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors w-full"
              >
                <LogOut className="w-5 h-5" />
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
