import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { ScanLine, Trash2, Package, TrendingUp, AlertTriangle } from 'lucide-react'
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

      // Calculate margins for dishes
      const dishesWithCost = (dishRes.data || []).map((dish: Record<string, unknown>) => {
        const diArr = (dish.dish_ingredients || []) as Array<{ ingredient?: { avg_cost?: number }; quantity: number }>
        const totalCost = diArr.reduce((sum: number, di) => {
          return sum + (di.ingredient?.avg_cost || 0) * di.quantity
        }, 0)
        const sellingPrice = (dish.selling_price as number) || 0
        return { ...dish, total_cost: totalCost, margin_percent: sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0 } as Dish
      })
      setDishes(dishesWithCost.sort((a, b) => (b.margin_percent || 0) - (a.margin_percent || 0)))
      setLoading(false)
    })
  }, [restaurant])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">{t('common.loading')}</p></div>
  }

  const stockCounts = {
    ok: ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'ok').length,
    low: ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'low').length,
    critical: ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'critical').length,
  }

  const weeklyWasteCost = wasteLogs.reduce((sum, w) => {
    const wAny = w as WasteLog & { ingredient?: { avg_cost?: number } }
    return sum + (wAny.ingredient?.avg_cost || 0) * w.quantity
  }, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/scan" className="flex flex-col items-center gap-2 p-4 bg-brand-600/10 border border-brand-600/20 rounded-2xl hover:bg-brand-600/20 transition-colors">
          <ScanLine className="w-6 h-6 text-brand-400" />
          <span className="text-sm font-medium text-brand-300">{t('nav.scan')}</span>
        </Link>
        <Link to="/waste" className="flex flex-col items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-colors">
          <Trash2 className="w-6 h-6 text-red-400" />
          <span className="text-sm font-medium text-red-300">{t('nav.waste')}</span>
        </Link>
        <Link to="/inventory" className="flex flex-col items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl hover:bg-blue-500/20 transition-colors">
          <Package className="w-6 h-6 text-blue-400" />
          <span className="text-sm font-medium text-blue-300">{t('nav.inventory')}</span>
        </Link>
        <Link to="/consumption" className="flex flex-col items-center gap-2 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl hover:bg-purple-500/20 transition-colors">
          <TrendingUp className="w-6 h-6 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">{t('nav.consumption')}</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Inventory Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.inventory_health')}</h3>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{stockCounts.ok}</p>
              <p className="text-xs text-slate-500">{t('dashboard.items_ok')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{stockCounts.low}</p>
              <p className="text-xs text-slate-500">{t('dashboard.items_low')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{stockCounts.critical}</p>
              <p className="text-xs text-slate-500">{t('dashboard.items_critical')}</p>
            </div>
          </div>
        </div>

        {/* Waste This Week */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.waste_this_week')}</h3>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(weeklyWasteCost)}</p>
          <p className="text-xs text-slate-500 mt-1">{wasteLogs.length} entries</p>
        </div>

        {/* Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.recent_alerts')}</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">{t('alerts.no_alerts')}</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-300 line-clamp-1">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Dishes by Margin */}
      {dishes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">{t('dashboard.top_dishes')}</h3>
          <div className="space-y-2">
            {dishes.slice(0, 5).map(dish => (
              <div key={dish.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-200">{dish.name}</span>
                <span className={cn('text-sm font-medium',
                  (dish.margin_percent || 0) >= 70 ? 'text-green-400' :
                  (dish.margin_percent || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {(dish.margin_percent || 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
