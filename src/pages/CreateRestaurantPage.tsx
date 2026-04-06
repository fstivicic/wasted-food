import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'

export default function CreateRestaurantPage() {
  const { t } = useTranslation()
  const { createRestaurant } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: err } = await createRestaurant(name)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sand-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('auth.create_restaurant')}</h1>
          <p className="text-sand-500 text-sm">Set up your restaurant to get started</p>
        </div>

        <div className="bg-white border border-sand-200 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1.5">
                {t('auth.restaurant_name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-sand-50 border border-sand-300 rounded-lg text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="My Restaurant"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-danger/20 rounded-lg text-danger text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.create_restaurant')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
