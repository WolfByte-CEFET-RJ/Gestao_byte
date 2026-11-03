import { createContext, useContext } from 'react'

export interface User {
  id: string
  username: string
  email?: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: (token: string, userData: User) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => useContext(AuthContext)
