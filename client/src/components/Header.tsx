import { useAuth } from '../context/AuthContext'

function Header() {
  const { user } = useAuth()

  return (
    <header className="header">
      
      {user && <h3>Bem-vindo, {user.username}</h3>}
    </header>
  )
}

export default Header
