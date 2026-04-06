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
  spoilage: '#ef4444', kitchen_error: '#f59e0b', overproduction: '#8b5cf6',
  damage: '#6366f1', expired: '#ec4899', other: '#64748b',
}

function StockBadge({ status }: { status: 'ok' | 'low' | 'critical' }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
      status === 'ok' && 'bg-green-500/15 text-green-400',
      status === 'low' && 'bg-yellow-500/15 text-yellow-400',
      status === 'critical' && 'bg-red-500/15 text-red-400',
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

  // Ingredient form
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

  // Focus waste qty input when panel opens
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

    // Decrement stock
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-white">{t('stock.title')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors border',
            showHistory ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          )}>
            <Trash2 className="w-4 h-4" />
            {t('stock.waste_history')}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => openForm()} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" />
            {t('inventory.add')}
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">{t('stock.total_items')}</p>
          <p className="text-xl font-bold text-white mt-0.5">{ingredients.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">{t('stock.low_stock')}</p>
          <p className="text-xl font-bold text-yellow-400 mt-0.5">{ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'low').length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">{t('stock.critical')}</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{ingredients.filter(i => getStockStatus(i.current_stock, i.par_level) === 'critical').length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">{t('stock.waste_cost')}</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{formatCurrency(totalWasteCost)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('inventory.search')}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Inventory Grid */}
      {loading ? (
        <p className="text-slate-400 text-center py-8">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{search ? t('common.no_results') : t('inventory.no_items')}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(item => {
            const status = getStockStatus(item.current_stock, item.par_level)
            const stockPercent = item.par_level > 0 ? Math.min(100, (item.current_stock / item.par_level) * 100) : 100
            const isWasteOpen = wasteTarget?.id === item.id
            return (
              <div key={item.id} className={cn(
                'bg-slate-900 border rounded-xl transition-all',
                isWasteOpen ? 'border-red-500/40 ring-1 ring-red-500/20' : 'border-slate-800'
              )}>
                {/* Item row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Stock bar */}
                  <div className="w-1.5 h-10 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                    <div
                      className={cn('w-full rounded-full transition-all',
                        status === 'ok' && 'bg-green-500',
                        status === 'low' && 'bg-yellow-500',
                        status === 'critical' && 'bg-red-500',
                      )}
                      style={{ height: `${stockPercent}%`, marginTop: `${100 - stockPercent}%` }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{item.name}</span>
                      <StockBadge status={status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="capitalize">{item.category}</span>
                      <span>{item.current_stock} / {item.par_level} {item.unit}</span>
                      <span>{formatCurrency(item.avg_cost)}/{item.unit}</span>
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
                          ? 'bg-red-500/20 text-red-400'
                          : item.current_stock <= 0
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      )}
                      title={item.current_stock <= 0 ? t('stock.no_stock') : t('stock.waste_this')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('stock.waste')}
                    </button>
                    <button onClick={() => openForm(item)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                      <span className="text-xs">{t('common.edit')}</span>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline waste form */}
                {isWasteOpen && (
                  <form onSubmit={handleWasteSubmit} className="border-t border-red-500/20 px-4 py-3 bg-red-500/5">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-slate-500 mb-1">{t('waste.quantity')} <span className="text-slate-600">(max {item.current_stock} {item.unit})</span></label>
                        <input
                          ref={wasteQtyRef}
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={item.current_stock}
                          value={wasteQty || ''}
                          onChange={e => { setWasteQty(+e.target.value); setWasteError(null) }}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          required
                        />
                      </div>
                      <div className="w-36">
                        <label className="block text-xs text-slate-500 mb-1">{t('waste.reason')}</label>
                        <select value={wasteReason} onChange={e => setWasteReason(e.target.value as WasteReason)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50">
                          {REASONS.map(r => <option key={r} value={r}>{t(`waste.reasons.${r}`)}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-slate-500 mb-1">{t('waste.notes')}</label>
                        <input type="text" value={wasteNotes} onChange={e => setWasteNotes(e.target.value)} placeholder="..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50" />
                      </div>
                      <button type="submit" disabled={wasteSubmitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                        {wasteSubmitting ? '...' : t('stock.confirm_waste')}
                      </button>
                    </div>
                    {wasteError && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {wasteError}
                      </div>
                    )}
                    {wasteQty > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        {t('stock.waste_value')}: <span className="text-red-400 font-medium">{formatCurrency(wasteQty * item.avg_cost)}</span>
                        {' · '}{t('stock.remaining')}: <span className="text-white">{Math.max(0, item.current_stock - wasteQty)} {item.unit}</span>
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
        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">{t('stock.waste_history')}</h2>
          </div>

          {/* Trends row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{t('stock.daily_waste_cost')}</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyWaste}>
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', fontSize: 12 }} />
                  <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {reasonCounts.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{t('stock.by_reason')}</h3>
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
                        <span className="text-xs text-slate-400">{r.name}: {r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent waste table */}
          {wasteLogs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">{t('waste.no_logs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
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
                      <tr key={w.id} className="border-b border-slate-800/50">
                        <td className="py-2 px-3 text-slate-500 text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-white text-sm">{wExt.ingredient?.name || '—'}</td>
                        <td className="py-2 px-3 text-right text-white">{w.quantity} {wExt.ingredient?.unit || ''}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: REASON_COLORS[w.reason] + '20', color: REASON_COLORS[w.reason] }}>
                            {t(`waste.reasons.${w.reason}`)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-red-400">{formatCurrency((wExt.ingredient?.avg_cost || 0) * w.quantity)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ingredient Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">{editing ? t('inventory.edit') : t('inventory.add')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('inventory.name')}</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('inventory.category')}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('inventory.unit')}</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('inventory.stock')}</label>
                  <input type="number" step="0.01" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: +e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('inventory.par_level')}</label>
                  <input type="number" step="0.01" value={form.par_level} onChange={e => setForm({ ...form, par_level: +e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('inventory.avg_cost')}</label>
                  <input type="number" step="0.01" value={form.avg_cost} onChange={e => setForm({ ...form, avg_cost: +e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors">{t('common.save')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
