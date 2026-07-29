import { createContext, useEffect, useContext, useState, type ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Ao carregar a página, verifica se o usuário já está logado no localStorage
  useEffect(() => {
    const token = localStorage.getItem('@wolfbyte:token')
    const savedUser = localStorage.getItem('@wolfbyte:user')

    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = (token: string, userData: User) => {
    localStorage.setItem('@wolfbyte:token', token)
    localStorage.setItem('@wolfbyte:user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('@wolfbyte:token')
    localStorage.removeItem('@wolfbyte:user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado para facilitar o consumo nas páginas
export const useAuth = () => useContext(AuthContext)