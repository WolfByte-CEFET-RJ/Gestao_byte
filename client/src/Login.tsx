import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import api from './api.js'
import './Login.css'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/login', { username, password })
      const { token, user } = response.data

      const userData = {
        id: user.id,
        username: user.username ?? user.nome ?? username,
        email: user.email ?? ''
      }

      login(token, userData)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('E-mail ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Acesso à plataforma WolfByte">
        <aside className="login-showcase">
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">W</span>
            <span>WolfByte</span>
          </div>
          <div className="login-showcase-copy">
            <span className="login-eyebrow">GESTÃO DA EQUIPE</span>
           
          </div>
          <div className="login-showcase-orbit login-showcase-orbit-one" aria-hidden="true" />
          <div className="login-showcase-orbit login-showcase-orbit-two" aria-hidden="true" />
          <span className="login-showcase-caption">WolfByte · CEFET/RJ</span>
        </aside>

        <div className="login-form-panel">
          <div className="login-form-heading">
            <span className="login-eyebrow">BEM-VINDO DE VOLTA</span>
            <h2>Acesse sua conta</h2>
            <p>Entre com suas credenciais para continuar.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <p className="login-error" role="alert">{error}</p>}

            <label htmlFor="login-username">Usuário</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Seu nome de usuário"
              autoComplete="username"
              required
            />

            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="login-footer">Acesso restrito à coordenação.</p>
        </div>
      </section>
    </main>
  )
}