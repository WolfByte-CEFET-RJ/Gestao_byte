import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PrivateRoute } from './components/Private'
import { Login } from './Login'
import  App  from './pages/App'

export default function Router() {
  return (
    <BrowserRouter>
      {/* O AuthProvider deve envelopar todas as rotas que precisam do contexto */}
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />

          {/* Rotas Protegidas (Exigem autenticação) */}
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<App />} />
            {/* Outras rotas privadas entram aqui */}
          </Route>

          {/* Redirecionamento Padrão */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}