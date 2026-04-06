import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/AuthPage'
import CreateRestaurantPage from './pages/CreateRestaurantPage'
import DashboardPage from './pages/DashboardPage'
import ScanPage from './pages/ScanPage'
import StockPage from './pages/StockPage'
import DishesPage from './pages/DishesPage'
import AlertsPage from './pages/AlertsPage'
import ConsumptionPage from './pages/ConsumptionPage'
import SuppliersPage from './pages/SuppliersPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, restaurant } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  if (!restaurant) return <Navigate to="/create-restaurant" replace />
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/create-restaurant" element={<CreateRestaurantPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="dishes" element={<DishesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="consumption" element={<ConsumptionPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
