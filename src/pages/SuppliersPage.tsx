import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Truck } from 'lucide-react'
import type { Supplier } from '@/types/database'

export default function SuppliersPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '' })
  const [loading, setLoading] = useState(true)

  const loadSuppliers = useCallback(async () => {
    if (!restaurant) return
    const { data } = await supabase.from('suppliers').select('*').eq('restaurant_id', restaurant.id).order('name')
    setSuppliers(data || [])
    setLoading(false)
  }, [restaurant])

  useEffect(() => {
    if (!restaurant) return
    loadSuppliers()
  }, [restaurant, loadSuppliers])

  function openForm(item?: Supplier) {
    if (item) {
      setEditing(item)
      setForm({ name: item.name, contact_email: item.contact_email || '', contact_phone: item.contact_phone || '' })
    } else {
      setEditing(null)
      setForm({ name: '', contact_email: '', contact_phone: '' })
    }
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    const data = { name: form.name, contact_email: form.contact_email || null, contact_phone: form.contact_phone || null }

    if (editing) {
      await supabase.from('suppliers').update(data).eq('id', editing.id)
    } else {
      await supabase.from('suppliers').insert({ ...data, restaurant_id: restaurant.id })
    }
    setShowForm(false)
    loadSuppliers()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('common.confirm_delete'))) return
    await supabase.from('suppliers').delete().eq('id', id)
    loadSuppliers()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('suppliers.title')}</h1>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          {t('suppliers.add')}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-center py-8">{t('common.loading')}</p>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{t('suppliers.no_suppliers')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map(s => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-2">{s.name}</h3>
              {s.contact_email && <p className="text-sm text-slate-400">{s.contact_email}</p>}
              {s.contact_phone && <p className="text-sm text-slate-400">{s.contact_phone}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => openForm(s)} className="text-xs text-brand-400 hover:text-brand-300">{t('common.edit')}</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:text-red-300">{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">{editing ? t('suppliers.edit') : t('suppliers.add')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('suppliers.name')}</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('suppliers.email')}</label>
                <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('suppliers.phone')}</label>
                <input type="tel" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
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
