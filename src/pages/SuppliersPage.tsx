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
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-sand-900" style={{ fontFamily: 'var(--font-display)' }}>{t('suppliers.title')}</h1>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          {t('suppliers.add')}
        </button>
      </div>

      {/* Inline form (replaces modal) */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-sand-200 rounded-xl p-4 animate-in">
          <h2 className="text-sm font-semibold text-sand-900 mb-3">{editing ? t('suppliers.edit') : t('suppliers.add')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('suppliers.name')}</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('suppliers.email')}</label>
              <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-sand-500 mb-1">{t('suppliers.phone')}</label>
              <input type="tel" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">{t('common.save')}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium rounded-lg transition-colors">{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 text-sand-300 mx-auto mb-3" />
          <p className="text-sand-500">{t('suppliers.no_suppliers')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-white border border-sand-200 rounded-xl px-4 py-3">
              <div>
                <h3 className="text-sand-900 font-medium text-sm">{s.name}</h3>
                <div className="flex gap-3 text-xs text-sand-500 mt-0.5">
                  {s.contact_email && <span>{s.contact_email}</span>}
                  {s.contact_phone && <span>{s.contact_phone}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openForm(s)} className="text-xs text-brand-500 hover:text-brand-600 font-medium">{t('common.edit')}</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-danger hover:text-danger/80 font-medium">{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
