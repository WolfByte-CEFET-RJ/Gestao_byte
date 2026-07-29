import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="header">
      {user && (
        <>
          <h3>Bem-vindo, {user.username}</h3>
          <button className="logout-button" onClick={handleLogout}>
            Sair
          </button>
        </>
      )}
    </header>
  )
}

export default Header
