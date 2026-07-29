import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import api from './api.js'

export function Login() {
  const [username, setusername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      // 1. Chamada para a sua API backend
      const response = await api.post('/login', { username, password })
      const { token, user } = response.data

      const userData = {
        id: user.id,
        username: user.username ?? user.nome ?? username,
        email: user.email ?? ''
      }

      // 2. Salva os dados no estado global via Context
      login(token, userData)

      // 3. Redireciona o usuário para a página principal
      navigate('/dashboard', { replace: true })

    } catch (err) {
      setError('E-mail ou senha inválidos.')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <input 
        type="username" 
        value={username} 
        onChange={(e) => setusername(e.target.value)} 
        placeholder="Usuário"
      />
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        placeholder="Senha"
      />
      <button type="submit">Entrar</button>
    </form>
  )
}