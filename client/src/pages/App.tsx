import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './App.css'

import api from '../api' 

// Interfaces opcionais para tipagem do TypeScript
interface Pipe {
  id: string;
  name: string;
  cards_count: number;
}

interface LateCard {
  id: string;
  title: string;
  createdAt: string;
  dueDate: string | null;
  pipeName: string;
  phaseName: string;
  reason: string;
  owner?: string;
}

function App() {
  const [pipes, setPipes] = useState<Pipe[]>([])
  const [atrasados, setAtrasados] = useState<LateCard[]>([])
  const [totalAtrasados, setTotalAtrasados] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(10)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getAuthHeaders = () => {
    const token = localStorage.getItem('@wolfbyte:token')
    return token
      ? { Authorization: `Bearer ${token}` }
      : {}
  }

  const buscarPipes = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/pipes', {
        headers: getAuthHeaders()
      })
      setPipes(response.data.pipes || [])
    } catch (err) {
      console.error(err)
      setError('Erro ao buscar dados da API')
    } finally {
      setLoading(false)
    }
  }

  const buscaAtrasados = async (page = 1) => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get(`/latecards?page=${page}&pageSize=${pageSize}`, {
        headers: getAuthHeaders()
      })
      
      setTotalAtrasados(response.data.totalLateCards ?? 0)
      setCurrentPage(response.data.page ?? page)
      setTotalPages(response.data.totalPages ?? 1)
      setAtrasados(response.data.cards || [])
    } catch (err) {
      console.error(err)
      setError('Erro ao buscar dados da API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header />
      
      <main>
        <h1>Plataforma de gestão de projetos da WolfByte</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={buscarPipes} disabled={loading}>
            {loading ? 'Carregando...' : 'Buscar pipes'}
          </button>
          
          <button onClick={() => buscaAtrasados(1)} disabled={loading}>
            {loading ? 'Carregando...' : 'Buscar CARDS ATRASADOS'}
          </button>
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div className="dashboard-grid">
          <section className="panel">
            <h2>Pipes da Organização</h2>
            {pipes.length === 0 ? (
              <p>Nenhum pipe carregado. Clique em "Buscar pipes" para carregar.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome do Pipe</th>
                    <th>Cards abertos</th>
                  </tr>
                </thead>
                <tbody>
                  {pipes.map((pipe) => (
                    <tr key={pipe.id}>
                      <td>{pipe.name}</td>
                      <td>{pipe.cards_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h2>
              Cards Atrasados
              <span className="panel-badge">(Total: {totalAtrasados ?? 0})</span>
            </h2>
            {totalAtrasados === null ? (
              <p>Clique em "Buscar CARDS ATRASADOS" para visualizar os dados.</p>
            ) : atrasados.length === 0 ? (
              <p>Nenhum card atrasado encontrado!</p>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Pipe</th>
                      <th>Fase</th>
                      <th>Responsável</th>
                      <th>Prazo</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atrasados.map((card) => (
                      <tr key={card.id}>
                        <td>{card.title}</td>
                        <td>{card.pipeName}</td>
                        <td>{card.phaseName}</td>
                        <td>{card.owner || 'Não definido'}</td>
                        <td>{card.dueDate ? new Date(card.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}</td>
                        <td>{card.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => buscaAtrasados(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => buscaAtrasados(currentPage + 1)}
                      disabled={currentPage >= totalPages || loading}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default App