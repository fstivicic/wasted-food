import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthPage() {
  const { t } = useTranslation()
  const { signIn, signUp } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password)

    if (authError) setError(authError.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-lg">W</div>
            <span className="text-2xl font-bold text-sand-900" style={{ fontFamily: 'var(--font-display)' }}>WastedFood</span>
          </div>
          <p className="text-sand-500 text-sm">Restaurant inventory & waste management</p>
        </div>

        {/* Form */}
        <div className="bg-white border border-sand-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-sand-900 mb-6">
            {isLogin ? t('auth.login') : t('auth.register')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="you@restaurant.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1.5">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-danger/20 rounded-xl text-danger text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : (isLogin ? t('auth.login') : t('auth.register'))}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null) }}
              className="text-sm text-brand-500 hover:text-brand-600"
            >
              {isLogin ? t('auth.no_account') : t('auth.has_account')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
