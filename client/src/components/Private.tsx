import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const PrivateRoute = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Carregando...</div>
  }

  // Se estiver logado, renderiza as rotas filhas (Outlet). Se não, redireciona para /login
  return user ? <Outlet /> : <Navigate to="/login" replace />
}