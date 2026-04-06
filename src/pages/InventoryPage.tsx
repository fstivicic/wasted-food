import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Package } from 'lucide-react'
import { cn, formatCurrency, getStockStatus } from '@/lib/utils'
import type { Ingredient } from '@/types/database'

const CATEGORIES = ['proteins', 'dairy', 'vegetables', 'fruits', 'grains', 'spices', 'oils', 'beverages', 'other']
const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'dozen', 'bunch', 'can', 'bottle', 'box']

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

export default function InventoryPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [form, setForm] = useState({ name: '', category: 'other', unit: 'kg', current_stock: 0, par_level: 0, avg_cost: 0 })

  const loadIngredients = useCallback(async () => {
    if (!restaurant) return
    const { data } = await supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id).order('name')
    setIngredients(data || [])
    setLoading(false)
  }, [restaurant])

  useEffect(() => {
    if (!restaurant) return
    loadIngredients()
  }, [restaurant, loadIngredients])

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
    loadIngredients()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('common.confirm_delete'))) return
    await supabase.from('ingredients').delete().eq('id', id)
    loadIngredients()
  }

  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('inventory.title')}</h1>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          {t('inventory.add')}
        </button>
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

      {/* Table */}
      {loading ? (
        <p className="text-slate-400 text-center py-8">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{search ? t('common.no_results') : t('inventory.no_items')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left py-3 px-3 font-medium">{t('inventory.name')}</th>
                <th className="text-left py-3 px-3 font-medium">{t('inventory.category')}</th>
                <th className="text-right py-3 px-3 font-medium">{t('inventory.stock')}</th>
                <th className="text-right py-3 px-3 font-medium">{t('inventory.par_level')}</th>
                <th className="text-center py-3 px-3 font-medium">Status</th>
                <th className="text-right py-3 px-3 font-medium">{t('inventory.avg_cost')}</th>
                <th className="text-right py-3 px-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const status = getStockStatus(item.current_stock, item.par_level)
                return (
                  <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-3 px-3 text-white font-medium">{item.name}</td>
                    <td className="py-3 px-3 text-slate-400 capitalize">{item.category}</td>
                    <td className="py-3 px-3 text-right text-white">{item.current_stock} {item.unit}</td>
                    <td className="py-3 px-3 text-right text-slate-400">{item.par_level} {item.unit}</td>
                    <td className="py-3 px-3 text-center"><StockBadge status={status} /></td>
                    <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(item.avg_cost)}/{item.unit}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => openForm(item)} className="text-slate-400 hover:text-white text-xs mr-2">{t('common.edit')}</button>
                      <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-400 text-xs">{t('common.delete')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
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
