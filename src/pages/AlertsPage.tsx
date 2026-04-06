import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, Check, AlertTriangle, TrendingDown, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Alert, AlertType } from '@/types/database'

const ALERT_ICONS: Record<AlertType, typeof Bell> = {
  price_spike: TrendingDown,
  margin_erosion: TrendingDown,
  low_stock: Package,
  waste_spike: AlertTriangle,
}
const ALERT_COLORS: Record<AlertType, string> = {
  price_spike: 'text-orange-400',
  margin_erosion: 'text-red-400',
  low_stock: 'text-yellow-400',
  waste_spike: 'text-purple-400',
}

export default function AlertsPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  const loadAlerts = useCallback(async () => {
    if (!restaurant) return
    let query = supabase.from('alerts').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }).limit(100)
    if (filter === 'unread') query = query.eq('read', false)
    const { data } = await query
    setAlerts(data || [])
  }, [restaurant, filter])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  async function markRead(id: string) {
    await supabase.from('alerts').update({ read: true }).eq('id', id)
    loadAlerts()
  }

  async function markAllRead() {
    if (!restaurant) return
    await supabase.from('alerts').update({ read: true }).eq('restaurant_id', restaurant.id).eq('read', false)
    loadAlerts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('alerts.title')}</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1">
            <button onClick={() => setFilter('unread')} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === 'unread' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t('alerts.unread')}
            </button>
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === 'all' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t('alerts.all')}
            </button>
          </div>
          {filter === 'unread' && alerts.length > 0 && (
            <button onClick={markAllRead} className="text-sm text-brand-400 hover:text-brand-300">{t('alerts.mark_all_read')}</button>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{filter === 'unread' ? t('alerts.no_unread') : t('alerts.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => {
            const Icon = ALERT_ICONS[alert.type] || Bell
            const color = ALERT_COLORS[alert.type] || 'text-slate-400'
            return (
              <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${alert.read ? 'bg-slate-900/50 border-slate-800/50' : 'bg-slate-900 border-slate-700'}`}>
                <div className={`mt-0.5 ${color}`}><Icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${alert.read ? 'text-slate-400' : 'text-white'}`}>{alert.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {t(`alerts.types.${alert.type}`)}
                    {alert.metadata && typeof alert.metadata === 'object' && 'amount' in alert.metadata && (
                      <> &middot; {formatCurrency(alert.metadata.amount as number)}</>
                    )}
                    {' '}&middot; {new Date(alert.created_at).toLocaleDateString()}
                  </p>
                </div>
                {!alert.read && (
                  <button onClick={() => markRead(alert.id)} className="text-slate-500 hover:text-brand-400 transition-colors" title="Mark read">
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
