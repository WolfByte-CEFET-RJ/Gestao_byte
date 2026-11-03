import { useState, type ReactNode } from 'react'
import { AuthContext, type User } from './AuthContext'

const getSavedUser = (): User | null => {
  const token = localStorage.getItem('@wolfbyte:token')
  const savedUser = localStorage.getItem('@wolfbyte:user')
  if (!token || !savedUser) return null

  try {
    const user: unknown = JSON.parse(savedUser)
    if (
      typeof user === 'object' &&
      user !== null &&
      'id' in user &&
      'username' in user &&
      typeof user.id === 'string' &&
      typeof user.username === 'string'
    ) {
      return user as User
    }
  } catch {
    return null
  }

  return null
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(getSavedUser)

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
    <AuthContext.Provider value={{ user, loading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
