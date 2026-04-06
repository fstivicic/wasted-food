import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { ScanLine, Package, AlertTriangle, ArrowRight } from 'lucide-react'
import { cn, formatCurrency, getStockStatus } from '@/lib/utils'
import type { Ingredient, Alert, WasteLog, Dish } from '@/types/database'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    Promise.all([
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id),
      supabase.from('alerts').select('*').eq('restaurant_id', restaurant.id).eq('read', false).order('created_at', { ascending: false }).limit(5),
      supabase.from('waste_logs').select('*, ingredient:ingredients(name, unit)').eq('restaurant_id', restaurant.id).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: false }),
      supabase.from('dishes').select('*, dish_ingredients(*, ingredient:ingredients(*))').eq('restaurant_id', restaurant.id),
    ]).then(([ingRes, alertRes, wasteRes, dishRes]) => {
      setIngredients(ingRes.data || [])
      setAlerts(alertRes.data || [])
      setWasteLogs(wasteRes.data || [])

      const dishesWithCost = (dishRes.data || []).map((dish: Record<string, unknown>) => {
        const diArr = (dish.dish_ingredients || []) as Array<{ ingredient?: { avg_cost?: number }; quantity: number }>
        const totalCost = diArr.reduce((sum: number, di) => {
          return sum + (di.ingredient?.avg_cost || 0) * di.quantity
        }, 0)
        const sellingPrice = (dish.selling_price as number) || 0
        return { ...dish, total_cost: totalCost, margin_percent: sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0 } as Dish
      })
      setDishes(dishesWithCost.sort((a: any, b: any) => (b.margin_percent || 0) - (a.margin_percent || 0)))
      setLoading(false)
    })
  }, [restaurant])

  if (loading) {
    return (
      <div className="space-y-6 stagger">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </div>
      </div>
    )
  }

  const criticalItems = ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'critical')
  const lowItems = ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'low')
  const needsAttention = criticalItems.length + lowItems.length + alerts.length

  const weeklyWasteCost = wasteLogs.reduce((sum, w) => {
    const wAny = w as WasteLog & { ingredient?: { avg_cost?: number } }
    return sum + (wAny.ingredient?.avg_cost || 0) * w.quantity
  }, 0)

  return (
    <div className="space-y-8 animate-in">
      {/* Greeting — serif display font, warm */}
      <div>
        <h1 className="text-3xl font-bold text-sand-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {t('dashboard.title')}
        </h1>
        <p className="text-sand-500 mt-1 text-[15px]">{restaurant?.name}</p>
      </div>

      {/* Attention banner — only when something needs action */}
      {needsAttention > 0 && (
        <Link
          to="/stock"
          className="flex items-center gap-4 p-4 bg-brand-50 border-l-4 border-brand-500 rounded-lg hover:bg-brand-100 transition-colors group"
        >
          <AlertTriangle className="w-5 h-5 text-brand-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-sand-900">
              {criticalItems.length > 0 && `${criticalItems.length} critical`}
              {criticalItems.length > 0 && lowItems.length > 0 && ', '}
              {lowItems.length > 0 && `${lowItems.length} low stock`}
              {(criticalItems.length > 0 || lowItems.length > 0) && alerts.length > 0 && ' · '}
              {alerts.length > 0 && `${alerts.length} ${t('dashboard.recent_alerts').toLowerCase()}`}
            </p>
            <p className="text-sm text-sand-600">Tap to review your stock</p>
          </div>
          <ArrowRight className="w-4 h-4 text-sand-400 group-hover:text-brand-600 transition-colors shrink-0" />
        </Link>
      )}

      {/* Two-column asymmetric layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — primary metrics (3 cols) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Stock health — inline, not card */}
          <div>
            <h2 className="text-xs font-semibold text-sand-500 uppercase tracking-wider mb-3">{t('dashboard.inventory_health')}</h2>
            <div className="flex gap-6">
              <div>
                <p className="text-3xl font-bold text-ok tabular-nums">{ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'ok').length}</p>
                <p className="text-sm text-sand-500">{t('dashboard.items_ok')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-warn tabular-nums">{lowItems.length}</p>
                <p className="text-sm text-sand-500">{t('dashboard.items_low')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-danger tabular-nums">{criticalItems.length}</p>
                <p className="text-sm text-sand-500">{t('dashboard.items_critical')}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-bold text-danger tabular-nums">{formatCurrency(weeklyWasteCost)}</p>
                <p className="text-sm text-sand-500">{t('dashboard.waste_this_week')}</p>
              </div>
            </div>
          </div>

          {/* Critical items inline list */}
          {criticalItems.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-sand-500 uppercase tracking-wider mb-2">Needs restock</h2>
              <div className="space-y-1">
                {criticalItems.slice(0, 6).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-sand-100 last:border-0">
                    <span className="text-[15px] font-medium text-sand-800">{item.name}</span>
                    <span className="text-sm text-danger font-semibold tabular-nums">{item.current_stock} / {item.par_level} {item.unit}</span>
                  </div>
                ))}
              </div>
              {criticalItems.length > 6 && (
                <Link to="/stock" className="text-sm text-brand-600 font-medium hover:text-brand-700 mt-2 inline-block">
                  View all {criticalItems.length} items &rarr;
                </Link>
              )}
            </div>
          )}

          {/* Top dishes */}
          {dishes.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-sand-500 uppercase tracking-wider mb-3">{t('dashboard.top_dishes')}</h2>
              <div className="space-y-1.5">
                {dishes.slice(0, 5).map((dish, i) => (
                  <div key={dish.id} className="flex items-center gap-3 py-2 border-b border-sand-100 last:border-0">
                    <span className="text-sm text-sand-400 font-medium w-5">{i + 1}.</span>
                    <span className="text-[15px] text-sand-800 flex-1">{dish.name}</span>
                    <span className={cn('text-sm font-semibold tabular-nums',
                      (dish.margin_percent || 0) >= 70 ? 'text-ok' :
                      (dish.margin_percent || 0) >= 60 ? 'text-warn' : 'text-danger'
                    )}>
                      {(dish.margin_percent || 0).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — quick actions + alerts (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick scan CTA */}
          <Link
            to="/scan"
            className="flex items-center gap-3 p-4 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors shadow-sm group"
          >
            <ScanLine className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{t('nav.scan')}</p>
              <p className="text-brand-100 text-sm">Camera or upload</p>
            </div>
            <ArrowRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>

          <Link
            to="/stock"
            className="flex items-center gap-3 p-4 bg-white border border-sand-200 text-sand-800 rounded-xl hover:border-sand-300 hover:shadow-sm transition-all group"
          >
            <Package className="w-6 h-6 text-sand-500 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{t('nav.stock')}</p>
              <p className="text-sand-500 text-sm">{ingredients.length} items</p>
            </div>
            <ArrowRight className="w-4 h-4 text-sand-400 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-sand-500 uppercase tracking-wider mb-3">{t('dashboard.recent_alerts')}</h2>
              <div className="space-y-2">
                {alerts.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-start gap-2.5 py-2">
                    <AlertTriangle className="w-4 h-4 text-warn mt-0.5 shrink-0" />
                    <p className="text-sm text-sand-700 leading-snug">{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
