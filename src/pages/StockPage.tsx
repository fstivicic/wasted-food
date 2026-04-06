import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Package, Trash2, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, getStockStatus } from '@/lib/utils'
import type { Ingredient, WasteLog, WasteReason } from '@/types/database'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const CATEGORIES = ['proteins', 'dairy', 'vegetables', 'fruits', 'grains', 'spices', 'oils', 'beverages', 'other']
const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'dozen', 'bunch', 'can', 'bottle', 'box']
const REASONS: WasteReason[] = ['spoilage', 'kitchen_error', 'overproduction', 'damage', 'expired', 'other']
const REASON_COLORS: Record<string, string> = {
  spoilage: '#c0483b', kitchen_error: '#c8973e', overproduction: '#8b5cf6',
  damage: '#6366f1', expired: '#ec4899', other: '#94918b',
}

function StockBadge({ status }: { status: 'ok' | 'low' | 'critical' }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
      status === 'ok' && 'bg-green-50 text-ok',
      status === 'low' && 'bg-amber-50 text-warn',
      status === 'critical' && 'bg-red-50 text-danger',
    )}>
      {status === 'ok' ? 'OK' : status === 'low' ? 'Low' : 'Critical'}
    </span>
  )
}

export default function StockPage() {
  const { t } = useTranslation()
  const { restaurant, user } = useAuth()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Ingredient form (inline, not modal)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [form, setForm] = useState({ name: '', category: 'other', unit: 'kg', current_stock: 0, par_level: 0, avg_cost: 0 })

  // Waste panel
  const [wasteTarget, setWasteTarget] = useState<Ingredient | null>(null)
  const [wasteQty, setWasteQty] = useState(0)
  const [wasteReason, setWasteReason] = useState<WasteReason>('spoilage')
  const [wasteNotes, setWasteNotes] = useState('')
  const [wasteSubmitting, setWasteSubmitting] = useState(false)
  const [wasteError, setWasteError] = useState<string | null>(null)
  const wasteQtyRef = useRef<HTMLInputElement>(null)

  // Waste history panel
  const [showHistory, setShowHistory] = useState(false)

  const loadData = useCallback(async () => {
    if (!restaurant) return
    const [ingRes, wasteRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('waste_logs').select('*, ingredient:ingredients(name, unit, avg_cost)').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }).limit(50),
    ])
    setIngredients(ingRes.data || [])
    setWasteLogs(wasteRes.data || [])
    setLoading(false)
  }, [restaurant])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (wasteTarget) {
      setTimeout(() => wasteQtyRef.current?.focus(), 100)
    }
  }, [wasteTarget])

  // --- Ingredient CRUD ---
  function openForm(item?: Ingredient) {
    if (item) {
      setEditing(item)
      setForm({ name: item.name, category: item.category, unit: item.unit, current_stock: item.current_stock, par_level: item.par_level, avg_cost: item.avg_cost })
    } else {
      setEditing(null)
      setForm({ name: '', category: 'other', unit: 'kg', current_stock: 0, par_level: 0, avg_cost: 0 })
    }
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    if (editing) {
      await supabase.from('ingredients').update({ ...form }).eq('id', editing.id)
    } else {
      await supabase.from('ingredients').insert({ ...form, restaurant_id: restaurant.id, last_cost: form.avg_cost })
    }
    setShowForm(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('common.confirm_delete'))) return
    await supabase.from('ingredients').delete().eq('id', id)
    loadData()
  }

  // --- Waste ---
  function openWaste(item: Ingredient) {
    setWasteTarget(item)
    setWasteQty(0)
    setWasteReason('spoilage')
    setWasteNotes('')
    setWasteError(null)
  }

  async function handleWasteSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant || !user || !wasteTarget) return

    if (wasteQty <= 0) {
      setWasteError(t('stock.waste_min_error'))
      return
    }
    if (wasteQty > wasteTarget.current_stock) {
      setWasteError(t('stock.waste_exceeds_stock'))
      return
    }

    setWasteSubmitting(true)
    setWasteError(null)

    await supabase.from('waste_logs').insert({
      restaurant_id: restaurant.id,
      ingredient_id: wasteTarget.id,
      quantity: wasteQty,
      reason: wasteReason,
      notes: wasteNotes || null,
      logged_by: user.id,
    })

    await supabase.from('ingredients').update({
      current_stock: Math.max(0, wasteTarget.current_stock - wasteQty)
    }).eq('id', wasteTarget.id)

    setWasteSubmitting(false)
    setWasteTarget(null)
    loadData()
  }

  // --- Computed ---
  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  const totalWasteCost = wasteLogs.reduce((sum, w) => {
    const wExt = w as WasteLog & { ingredient?: { avg_cost?: number } }
    return sum + (wExt.ingredient?.avg_cost || 0) * w.quantity
  }, 0)

  const reasonCounts = REASONS.map(r => ({
    name: t(`waste.reasons.${r}`),
    value: wasteLogs.filter(w => w.reason === r).length,
    color: REASON_COLORS[r],
  })).filter(r => r.value > 0)

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const dailyWaste = last7Days.map(day => {
    const logs = wasteLogs.filter(w => w.created_at.startsWith(day))
    const cost = logs.reduce((sum, w) => {
      const wExt = w as WasteLog & { ingredient?: { avg_cost?: number } }
      return sum + (wExt.ingredient?.avg_cost || 0) * w.quantity
    }, 0)
    return { day: day.slice(5), cost: Math.round(cost * 100) / 100 }
  })

  return (
    <div className="space-y-4 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-sand-900" style={{ fontFamily: 'var(--font-display)' }}>{t('stock.title')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors border',
            showHistory ? 'bg-red-50 border-danger/30 text-danger' : 'bg-white border-sand-200 text-sand-600 hover:text-sand-900 hover:border-sand-300'
          )}>
            <Trash2 className="w-4 h-4" />
            {t('stock.waste_history')}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => openForm()} className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" />
            {t('inventory.add')}
          </button>
        </div>
      </div>

      {/* Inline ingredient form (replaces modal) */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-sand-200 rounded-xl p-4 animate-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-sand-900">{editing ? t('inventory.edit') : t('inventory.add')}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-sand-400 hover:text-sand-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-sand-500 mb-1">{t('inventory.name')}</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('inventory.category')}</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('inventory.unit')}</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('inventory.stock')}</label>
              <input type="number" step="0.01" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: +e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('inventory.par_level')}</label>
              <input type="number" step="0.01" value={form.par_level} onChange={e => setForm({ ...form, par_level: +e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('inventory.avg_cost')}</label>
              <input type="number" step="0.01" value={form.avg_cost} onChange={e => setForm({ ...form, avg_cost: +e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">{t('common.save')}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium rounded-lg transition-colors">{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {/* Summary strip */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-sand-500">{t('stock.total_items')}: <strong className="text-sand-900 tabular-nums">{ingredients.length}</strong></span>
        <span className="text-sand-500">{t('stock.low_stock')}: <strong className="text-warn tabular-nums">{ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'low').length}</strong></span>
        <span className="text-sand-500">{t('stock.critical')}: <strong className="text-danger tabular-nums">{ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'critical').length}</strong></span>
        <span className="text-sand-500">{t('stock.waste_cost')}: <strong className="text-danger tabular-nums">{formatCurrency(totalWasteCost)}</strong></span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('inventory.search')}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Inventory Grid */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-sand-300 mx-auto mb-3" />
          <p className="text-sand-500">{search ? t('common.no_results') : t('inventory.no_items')}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(item => {
            const status = getStockStatus(item.current_stock, item.par_level)
            const stockPercent = item.par_level > 0 ? Math.min(100, (item.current_stock / item.par_level) * 100) : 100
            const isWasteOpen = wasteTarget?.id === item.id
            return (
              <div key={item.id} className={cn(
                'bg-white border rounded-xl transition-all',
                isWasteOpen ? 'border-danger/40 ring-1 ring-danger/20' : 'border-sand-200'
              )}>
                {/* Item row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Stock bar */}
                  <div className="w-1.5 h-10 rounded-full bg-sand-100 overflow-hidden flex-shrink-0">
                    <div
                      className={cn('w-full rounded-full transition-all',
                        status === 'ok' && 'bg-ok',
                        status === 'low' && 'bg-warn',
                        status === 'critical' && 'bg-danger',
                      )}
                      style={{ height: `${stockPercent}%`, marginTop: `${100 - stockPercent}%` }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sand-900 truncate">{item.name}</span>
                      <StockBadge status={status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-sand-500 mt-0.5">
                      <span className="capitalize">{item.category}</span>
                      <span className="tabular-nums">{item.current_stock} / {item.par_level} {item.unit}</span>
                      <span className="tabular-nums">{formatCurrency(item.avg_cost)}/{item.unit}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => isWasteOpen ? setWasteTarget(null) : openWaste(item)}
                      disabled={item.current_stock <= 0}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
                        isWasteOpen
                          ? 'bg-red-50 text-danger'
                          : item.current_stock <= 0
                            ? 'bg-sand-100 text-sand-300 cursor-not-allowed'
                            : 'bg-red-50 text-danger hover:bg-red-100'
                      )}
                      title={item.current_stock <= 0 ? t('stock.no_stock') : t('stock.waste_this')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('stock.waste')}
                    </button>
                    <button onClick={() => openForm(item)} className="p-1.5 text-sand-400 hover:text-sand-700 rounded-lg hover:bg-sand-100 transition-colors">
                      <span className="text-xs">{t('common.edit')}</span>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-sand-400 hover:text-danger rounded-lg hover:bg-red-50 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline waste form */}
                {isWasteOpen && (
                  <form onSubmit={handleWasteSubmit} className="border-t border-danger/20 px-4 py-3 bg-red-50/50">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-sand-500 mb-1">{t('waste.quantity')} <span className="text-sand-400">(max {item.current_stock} {item.unit})</span></label>
                        <input
                          ref={wasteQtyRef}
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={item.current_stock}
                          value={wasteQty || ''}
                          onChange={e => { setWasteQty(+e.target.value); setWasteError(null) }}
                          className="w-full px-3 py-2 bg-white border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-danger/50"
                          required
                        />
                      </div>
                      <div className="w-36">
                        <label className="block text-xs text-sand-500 mb-1">{t('waste.reason')}</label>
                        <select value={wasteReason} onChange={e => setWasteReason(e.target.value as WasteReason)} className="w-full px-3 py-2 bg-white border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-danger/50">
                          {REASONS.map(r => <option key={r} value={r}>{t(`waste.reasons.${r}`)}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-sand-500 mb-1">{t('waste.notes')}</label>
                        <input type="text" value={wasteNotes} onChange={e => setWasteNotes(e.target.value)} placeholder="..." className="w-full px-3 py-2 bg-white border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-danger/50" />
                      </div>
                      <button type="submit" disabled={wasteSubmitting} className="px-4 py-2 bg-danger hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                        {wasteSubmitting ? '...' : t('stock.confirm_waste')}
                      </button>
                    </div>
                    {wasteError && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-danger">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {wasteError}
                      </div>
                    )}
                    {wasteQty > 0 && (
                      <p className="text-xs text-sand-500 mt-2">
                        {t('stock.waste_value')}: <span className="text-danger font-medium">{formatCurrency(wasteQty * item.avg_cost)}</span>
                        {' · '}{t('stock.remaining')}: <span className="text-sand-900 font-medium">{Math.max(0, item.current_stock - wasteQty)} {item.unit}</span>
                      </p>
                    )}
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Waste History & Trends (collapsible) */}
      {showHistory && (
        <div className="space-y-4 mt-2 animate-in">
          <h2 className="text-lg font-semibold text-sand-900">{t('stock.waste_history')}</h2>

          {/* Trends row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-sand-200 rounded-xl p-4">
              <h3 className="text-xs font-medium text-sand-500 uppercase tracking-wider mb-3">{t('stock.daily_waste_cost')}</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyWaste}>
                  <XAxis dataKey="day" stroke="#94918b" fontSize={11} />
                  <YAxis stroke="#94918b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e6e1', borderRadius: '8px', fontSize: 12 }} />
                  <Bar dataKey="cost" fill="#c0483b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {reasonCounts.length > 0 && (
              <div className="bg-white border border-sand-200 rounded-xl p-4">
                <h3 className="text-xs font-medium text-sand-500 uppercase tracking-wider mb-3">{t('stock.by_reason')}</h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={reasonCounts} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                        {reasonCounts.map((r, i) => <Cell key={i} fill={r.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {reasonCounts.map(r => (
                      <div key={r.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="text-xs text-sand-600">{r.name}: {r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent waste table */}
          {wasteLogs.length === 0 ? (
            <p className="text-sm text-sand-400 text-center py-6">{t('waste.no_logs')}</p>
          ) : (
            <div className="overflow-x-auto bg-white border border-sand-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-sand-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3 font-medium">{t('stock.date')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('waste.ingredient')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('waste.quantity')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('waste.reason')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('dishes.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteLogs.slice(0, 20).map(w => {
                    const wExt = w as WasteLog & { ingredient?: { name?: string; unit?: string; avg_cost?: number } }
                    return (
                      <tr key={w.id} className="border-b border-sand-100">
                        <td className="py-2 px-3 text-sand-500 text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-sand-900 text-sm">{wExt.ingredient?.name || '—'}</td>
                        <td className="py-2 px-3 text-right text-sand-900 tabular-nums">{w.quantity} {wExt.ingredient?.unit || ''}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: REASON_COLORS[w.reason] + '15', color: REASON_COLORS[w.reason] }}>
                            {t(`waste.reasons.${w.reason}`)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-danger tabular-nums">{formatCurrency((wExt.ingredient?.avg_cost || 0) * w.quantity)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
