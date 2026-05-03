import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import TablePage from './pages/TablePage'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 20 }}>
      ♠
    </div>
  )

  return (
    <Routes>
      {/* Table page is public - anyone can view */}
      <Route path="/table/:id" element={<TablePage />} />
      {/* Home requires login */}
      <Route path="/" element={user ? <HomePage /> : <AuthPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
