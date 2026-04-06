import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Plus } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { Ingredient, ConsumptionPeriod } from '@/types/database'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function ConsumptionPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const [periods, setPeriods] = useState<ConsumptionPeriod[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [generating, setGenerating] = useState(false)

  // New period form
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const loadData = useCallback(async () => {
    if (!restaurant) return
    const [pRes, iRes] = await Promise.all([
      supabase.from('consumption_periods').select('*').eq('restaurant_id', restaurant.id).order('period_start', { ascending: false }),
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id).order('name'),
    ])
    setPeriods(pRes.data || [])
    setIngredients(iRes.data || [])
  }, [restaurant])

  useEffect(() => { loadData() }, [loadData])

  async function generatePeriod(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant || !periodStart || !periodEnd) return
    setGenerating(true)

    try {
      // Fetch invoices and waste in the period
      const [invRes, wasteRes] = await Promise.all([
        supabase.from('invoice_items').select('ingredient_id, quantity, unit_price, total, invoice:invoices!inner(restaurant_id, invoice_date)').gte('invoice.invoice_date', periodStart).lte('invoice.invoice_date', periodEnd).eq('invoice.restaurant_id', restaurant.id),
        supabase.from('waste_logs').select('ingredient_id, quantity').eq('restaurant_id', restaurant.id).gte('created_at', periodStart + 'T00:00:00').lte('created_at', periodEnd + 'T23:59:59'),
      ])

      const invoiceItems = invRes.data || []
      const wasteLogs = wasteRes.data || []

      // Build consumption data per ingredient
      const consumption: Record<string, { purchased: number; wasted: number; cost: number }> = {}
      for (const item of invoiceItems) {
        const id = item.ingredient_id
        if (!id) continue
        if (!consumption[id]) consumption[id] = { purchased: 0, wasted: 0, cost: 0 }
        consumption[id].purchased += item.quantity
        consumption[id].cost += item.total
      }
      for (const w of wasteLogs) {
        if (!consumption[w.ingredient_id]) consumption[w.ingredient_id] = { purchased: 0, wasted: 0, cost: 0 }
        consumption[w.ingredient_id].wasted += w.quantity
      }

      // Calculate suggested order: avg daily use * 7 (weekly order)
      const days = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000))
      const suggestedOrder: Record<string, number> = {}
      for (const [id, data] of Object.entries(consumption)) {
        const used = data.purchased - data.wasted
        const dailyUse = used / days
        suggestedOrder[id] = Math.round(dailyUse * 7 * 100) / 100
      }

      await supabase.from('consumption_periods').insert({
        restaurant_id: restaurant.id,
        period_start: periodStart,
        period_end: periodEnd,
        consumption_data: consumption as Record<string, unknown>,
        suggested_order: suggestedOrder as Record<string, unknown>,
      })

      setShowNewPeriod(false)
      setPeriodStart('')
      setPeriodEnd('')
      loadData()
    } finally {
      setGenerating(false)
    }
  }

  // Chart data for the latest period
  const latestPeriod = periods[0]
  const chartData = latestPeriod ? Object.entries(latestPeriod.consumption_data as Record<string, { purchased: number; wasted: number; cost: number }>).map(([id, data]) => {
    const ing = ingredients.find(i => i.id === id)
    return { name: ing?.name || id.slice(0, 8), purchased: data.purchased, wasted: data.wasted }
  }).slice(0, 10) : []

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-sand-900" style={{ fontFamily: 'var(--font-display)' }}>{t('consumption.title')}</h1>
        <button onClick={() => setShowNewPeriod(!showNewPeriod)} className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> {t('consumption.generate')}
        </button>
      </div>

      {/* New Period Form (inline, not modal) */}
      {showNewPeriod && (
        <form onSubmit={generatePeriod} className="bg-white border border-sand-200 rounded-xl p-4 animate-in">
          <h2 className="text-sm font-semibold text-sand-900 mb-3">{t('consumption.new_period')}</h2>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('consumption.start')}</label>
              <input type="date" required value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('consumption.end')}</label>
              <input type="date" required value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <button type="submit" disabled={generating} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {generating ? 'Generating...' : t('consumption.generate')}
            </button>
            <button type="button" onClick={() => setShowNewPeriod(false)} className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium rounded-lg transition-colors">{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {/* Chart for latest period */}
      {chartData.length > 0 && (
        <div className="bg-white border border-sand-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-sand-500 mb-4">
            {latestPeriod.period_start} — {latestPeriod.period_end}: Top Ingredients
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#94918b" fontSize={11} angle={-30} textAnchor="end" height={60} />
              <YAxis stroke="#94918b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e6e1', borderRadius: '8px' }} />
              <Bar dataKey="purchased" fill="#5b8c5a" name="Purchased" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wasted" fill="#c0483b" name="Wasted" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Suggested Order */}
      {latestPeriod && (
        <div className="bg-white border border-sand-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-sand-500 mb-3">{t('consumption.suggested_order')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-sand-500">
                  <th className="text-left py-2 px-3 font-medium">Ingredient</th>
                  <th className="text-right py-2 px-3 font-medium">Purchased</th>
                  <th className="text-right py-2 px-3 font-medium">Wasted</th>
                  <th className="text-right py-2 px-3 font-medium">Suggested (7d)</th>
                  <th className="text-right py-2 px-3 font-medium">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(latestPeriod.suggested_order as Record<string, number>).map(([id, qty]) => {
                  const ing = ingredients.find(i => i.id === id)
                  const cd = (latestPeriod.consumption_data as Record<string, { purchased: number; wasted: number; cost: number }>)[id]
                  return (
                    <tr key={id} className="border-b border-sand-100">
                      <td className="py-2 px-3 text-sand-900">{ing?.name || id.slice(0, 8)}</td>
                      <td className="py-2 px-3 text-right text-sand-600 tabular-nums">{formatNumber(cd?.purchased || 0)} {ing?.unit}</td>
                      <td className="py-2 px-3 text-right text-danger tabular-nums">{formatNumber(cd?.wasted || 0)}</td>
                      <td className="py-2 px-3 text-right text-brand-500 font-medium tabular-nums">{formatNumber(qty)} {ing?.unit}</td>
                      <td className="py-2 px-3 text-right text-sand-600 tabular-nums">{formatCurrency(qty * (ing?.avg_cost || 0))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Previous periods list */}
      {periods.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 text-sand-300 mx-auto mb-3" />
          <p className="text-sand-500">{t('consumption.empty')}</p>
        </div>
      ) : periods.length > 1 && (
        <div className="bg-white border border-sand-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-sand-500 mb-3">Previous Periods</h3>
          <div className="space-y-2">
            {periods.slice(1).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-sand-50 rounded-lg">
                <span className="text-sm text-sand-700">{p.period_start} — {p.period_end}</span>
                <span className="text-xs text-sand-500">{Object.keys(p.consumption_data || {}).length} ingredients</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
