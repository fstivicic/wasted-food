import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings, UserPlus, Trash2, Globe } from 'lucide-react'
import type { Role } from '@/types/database'

interface TeamMember {
  id: string
  user_id: string
  role: Role
  user_email?: string
}

const LANGUAGES = [
  { code: 'hr', label: 'Hrvatski' },
  { code: 'en', label: 'English' },
]

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { restaurant, role, refreshRestaurant } = useAuth()
  const [restaurantName, setRestaurantName] = useState('')
  const [address, setAddress] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('staff')
  const [inviting, setInviting] = useState(false)

  const loadData = useCallback(async () => {
    if (!restaurant) return
    setRestaurantName(restaurant.name)
    setAddress(restaurant.address || '')
    setCurrency(restaurant.currency)

    const { data: members } = await supabase.from('restaurant_members').select('id, user_id, role').eq('restaurant_id', restaurant.id)
    setTeamMembers(members || [])
  }, [restaurant])

  useEffect(() => { loadData() }, [loadData])

  async function saveRestaurant(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    setSaving(true)
    await supabase.from('restaurants').update({ name: restaurantName, address: address || null, currency }).eq('id', restaurant.id)
    await refreshRestaurant()
    setSaving(false)
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant || !inviteEmail) return
    setInviting(true)

    // Look up user by email (Supabase auth doesn't expose user list, so we'll just store with email for now)
    // In production, this would use an Edge Function or Supabase admin API
    alert(`Invite functionality requires Supabase Edge Function. Would invite ${inviteEmail} as ${inviteRole}.`)

    setInviteEmail('')
    setInviting(false)
  }

  async function removeMember(memberId: string) {
    if (!confirm(t('common.confirm_delete'))) return
    await supabase.from('restaurant_members').delete().eq('id', memberId)
    loadData()
  }

  function changeLanguage(lang: string) {
    i18n.changeLanguage(lang)
    localStorage.setItem('language', lang)
  }

  const isAdmin = role === 'owner' || role === 'manager'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>

      {/* Restaurant Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">{t('settings.restaurant')}</h2>
        </div>
        <form onSubmit={saveRestaurant} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">{t('settings.restaurant_name')}</label>
            <input type="text" required value={restaurantName} onChange={e => setRestaurantName(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('settings.address')}</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('settings.currency')}</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50">
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="HRK">HRK (kn)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
          {isAdmin && (
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
              {t('common.save')}
            </button>
          )}
        </form>
      </div>

      {/* Language */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">{t('settings.language')}</h2>
        </div>
        <div className="flex gap-3">
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => changeLanguage(lang.code)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${i18n.language === lang.code ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team Management */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">{t('settings.team')}</h2>
          </div>

          {/* Current members */}
          <div className="space-y-2 mb-4">
            {teamMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                <div>
                  <p className="text-sm text-white">{member.user_id.slice(0, 8)}...</p>
                  <p className="text-xs text-slate-500 capitalize">{member.role}</p>
                </div>
                {member.role !== 'owner' && (
                  <button onClick={() => removeMember(member.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>

          {/* Invite form */}
          <form onSubmit={inviteMember} className="flex gap-2">
            <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder={t('settings.invite_email')} className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm">
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
            <button type="submit" disabled={inviting} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
              {t('settings.invite')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
