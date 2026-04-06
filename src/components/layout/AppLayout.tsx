import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import {
  LayoutDashboard, ScanLine, Package, UtensilsCrossed,
  Bell, TrendingUp, Truck, Settings, LogOut, Menu, X, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

const primaryNav = [
  { to: '/', icon: LayoutDashboard, label: 'nav.dashboard' },
  { to: '/scan', icon: ScanLine, label: 'nav.scan' },
  { to: '/stock', icon: Package, label: 'nav.stock' },
  { to: '/dishes', icon: UtensilsCrossed, label: 'nav.dishes' },
]

const secondaryNav = [
  { to: '/alerts', icon: Bell, label: 'nav.alerts' },
  { to: '/consumption', icon: TrendingUp, label: 'nav.consumption' },
  { to: '/suppliers', icon: Truck, label: 'nav.suppliers' },
  { to: '/settings', icon: Settings, label: 'nav.settings' },
]

export default function AppLayout() {
  const { t } = useTranslation()
  const { signOut, restaurant } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)

  const navLinkClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-150',
    isActive
      ? 'bg-brand-500 text-white shadow-sm'
      : 'text-sand-700 hover:text-sand-900 hover:bg-sand-100'
  )

  return (
    <div className="min-h-screen bg-sand-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-sand-200 fixed inset-y-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-base tracking-tight">W</div>
          <div>
            <span className="text-lg font-bold text-sand-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>WastedFood</span>
          </div>
        </div>

        {/* Restaurant name */}
        {restaurant && (
          <div className="px-5 pb-4">
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">Restaurant</p>
            <p className="text-sm font-semibold text-sand-800 truncate">{restaurant.name}</p>
          </div>
        )}

        {/* Primary nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {primaryNav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {t(item.label)}
            </NavLink>
          ))}

          {/* Secondary nav — collapsible */}
          <div className="pt-4 mt-4 border-t border-sand-200">
            <button
              onClick={() => setShowSecondary(!showSecondary)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-sand-500 uppercase tracking-wider hover:text-sand-700 transition-colors"
            >
              More
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', showSecondary && 'rotate-180')} />
            </button>
            <div className={cn('space-y-0.5 overflow-hidden transition-all duration-200', showSecondary ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0')}>
              {secondaryNav.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {t(item.label)}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-sand-200">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sand-500 hover:text-danger hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="w-[18px] h-[18px]" />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar — primary actions only */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-sand-200 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {primaryNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors min-w-[56px]',
                isActive ? 'text-brand-600' : 'text-sand-500'
              )}
            >
              <item.icon className={cn('w-5 h-5')} />
              {t(item.label).split(' ')[0]}
            </NavLink>
          ))}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn('flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors min-w-[56px]', mobileOpen ? 'text-brand-600' : 'text-sand-500')}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            More
          </button>
        </div>
      </div>

      {/* Mobile "More" overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-sand-950/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute bottom-16 inset-x-4 bg-white rounded-2xl shadow-xl border border-sand-200 p-3 animate-in"
            onClick={e => e.stopPropagation()}
          >
            {restaurant && (
              <div className="px-3 py-2 mb-2">
                <p className="text-xs font-medium text-sand-500">{restaurant.name}</p>
              </div>
            )}
            <nav className="space-y-0.5">
              {secondaryNav.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-sand-700 hover:bg-sand-100'
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
            <div className="mt-2 pt-2 border-t border-sand-200">
              <button
                onClick={() => { signOut(); setMobileOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sand-500 hover:text-danger hover:bg-red-50 transition-colors w-full"
              >
                <LogOut className="w-[18px] h-[18px]" />
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-56 pb-20 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
