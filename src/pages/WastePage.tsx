import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Ingredient, WasteLog, WasteReason } from '@/types/database'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const REASONS: WasteReason[] = ['spoilage', 'kitchen_error', 'overproduction', 'damage', 'expired', 'other']
const REASON_COLORS: Record<string, string> = {
  spoilage: '#ef4444', kitchen_error: '#f59e0b', overproduction: '#8b5cf6',
  damage: '#6366f1', expired: '#ec4899', other: '#64748b',
}

export default function WastePage() {
  const { t } = useTranslation()
  const { restaurant, user } = useAuth()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([])
  const [tab, setTab] = useState<'log' | 'history' | 'trends'>('log')

  // Form
  const [ingredientId, setIngredientId] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [reason, setReason] = useState<WasteReason>('spoilage')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    if (!restaurant) return
    const [ingRes, wasteRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('waste_logs').select('*, ingredient:ingredients(name, unit, avg_cost)').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }).limit(100),
    ])
    setIngredients(ingRes.data || [])
    setWasteLogs(wasteRes.data || [])
  }, [restaurant])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant || !user || !ingredientId) return
    setSubmitting(true)

    // Insert waste log
    await supabase.from('waste_logs').insert({
      restaurant_id: restaurant.id,
      ingredient_id: ingredientId,
      quantity,
      reason,
      notes: notes || null,
      logged_by: user.id,
    })

    // Decrement stock
    const { data: ing } = await supabase.from('ingredients').select('current_stock').eq('id', ingredientId).single()
    if (ing) {
      await supabase.from('ingredients').update({ current_stock: Math.max(0, ing.current_stock - quantity) }).eq('id', ingredientId)
    }

    setIngredientId('')
    setQuantity(0)
    setReason('spoilage')
    setNotes('')
    setSubmitting(false)
    loadData()
  }

  // Trend data
  const reasonCounts = REASONS.map(r => ({
    name: t(`waste.reasons.${r}`),
    value: wasteLogs.filter(w => w.reason === r).length,
    color: REASON_COLORS[r],
  })).filter(r => r.value > 0)

  // Weekly bar chart: waste cost per day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const dailyWaste = last7Days.map(day => {
    const logs = wasteLogs.filter(w => w.created_at.startsWith(day))
    const cost = logs.reduce((sum, w) => {
      const ing = w as WasteLog & { ingredient?: { avg_cost?: number } }
      return sum + (ing.ingredient?.avg_cost || 0) * w.quantity
    }, 0)
    return { day: day.slice(5), cost: Math.round(cost * 100) / 100 }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('waste.title')}</h1>
        <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1">
          {(['log', 'history', 'trends'] as const).map(tabName => (
            <button key={tabName} onClick={() => setTab(tabName)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === tabName ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t(`waste.${tabName === 'log' ? 'log_waste' : tabName}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Log Form */}
      {tab === 'log' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('waste.ingredient')}</label>
              <select required value={ingredientId} onChange={e => setIngredientId(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">— Select —</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('waste.quantity')}</label>
                <input type="number" step="0.01" required min="0.01" value={quantity || ''} onChange={e => setQuantity(+e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('waste.reason')}</label>
                <select value={reason} onChange={e => setReason(e.target.value as WasteReason)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {REASONS.map(r => <option key={r} value={r}>{t(`waste.reasons.${r}`)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('waste.notes')}</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
              {t('waste.submit')}
            </button>
          </form>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        wasteLogs.length === 0 ? (
          <div className="text-center py-12">
            <Trash2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">{t('waste.no_logs')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left py-3 px-3 font-medium">Date</th>
                  <th className="text-left py-3 px-3 font-medium">{t('waste.ingredient')}</th>
                  <th className="text-right py-3 px-3 font-medium">{t('waste.quantity')}</th>
                  <th className="text-left py-3 px-3 font-medium">{t('waste.reason')}</th>
                  <th className="text-right py-3 px-3 font-medium">{t('dishes.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {wasteLogs.map(w => {
                  const wExt = w as WasteLog & { ingredient?: { name?: string; unit?: string; avg_cost?: number } }
                  return (
                    <tr key={w.id} className="border-b border-slate-800/50">
                      <td className="py-3 px-3 text-slate-400">{new Date(w.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-3 text-white">{wExt.ingredient?.name || '—'}</td>
                      <td className="py-3 px-3 text-right text-white">{w.quantity} {wExt.ingredient?.unit || ''}</td>
                      <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: REASON_COLORS[w.reason] + '20', color: REASON_COLORS[w.reason] }}>{t(`waste.reasons.${w.reason}`)}</span></td>
                      <td className="py-3 px-3 text-right text-red-400">{formatCurrency((wExt.ingredient?.avg_cost || 0) * w.quantity)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Trends */}
      {tab === 'trends' && (
        <div className="space-y-6">
          {/* Daily waste cost bar chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Daily Waste Cost (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyWaste}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#ef4444' }} />
                <Bar dataKey="cost" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Reason breakdown pie */}
          {reasonCounts.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Waste by Reason</h3>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={reasonCounts} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {reasonCounts.map((r, i) => <Cell key={i} fill={r.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {reasonCounts.map(r => (
                    <div key={r.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-sm text-slate-300">{r.name}: {r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
