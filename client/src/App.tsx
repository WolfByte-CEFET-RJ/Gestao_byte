import { useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import './App.css'

import api from './api' 

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
}

function App() {
  const [pipes, setPipes] = useState<Pipe[]>([])
  const [atrasados, setAtrasados] = useState<LateCard[]>([])
  const [totalAtrasados, setTotalAtrasados] = useState<number | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buscarPipes = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/pipes')
      setPipes(response.data.pipes || [])
    } catch (err) {
      console.error(err)
      setError('Erro ao buscar dados da API')
    } finally {
      setLoading(false)
    }
  }

  const buscaAtrasados = async () => {
    try {
      setLoading(true)
      setError('')

      // Rota ajustada para /cards/late
      const response = await api.get('/latecards')
      
      // Mapeia o total geral e a lista dos cards
      setTotalAtrasados(response.data.totalLateCards ?? 0)
      setAtrasados(response.data.top10Cards || [])
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
      
      <main style={{ padding: '20px' }}>
        <h1>Plataforma de gestão de projetos da WolfByte</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={buscarPipes} disabled={loading}>
            {loading ? 'Carregando...' : 'Buscar pipes'}
          </button>
          
          <button onClick={buscaAtrasados} disabled={loading}>
            {loading ? 'Carregando...' : 'Buscar CARDS ATRASADOS'}
          </button>
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        {/* Exibição dos Pipes */}
        {pipes.length > 0 && (
          <section>
            <h2>Pipes da Organização</h2>
            <ul>
              {pipes.map((pipe) => (
                <li key={pipe.id}>
                  <strong>{pipe.name}</strong> - {pipe.cards_count} cards
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Exibição dos Cards Atrasados */}
        {totalAtrasados !== null && (
          <section style={{ marginTop: '20px' }}>
            <h2>
              Cards Atrasados 
              <span style={{ fontSize: '0.8em', color: '#ff4d4d', marginLeft: '10px' }}>
                (Total: {totalAtrasados})
              </span>
            </h2>

            {atrasados.length === 0 ? (
              <p>Nenhum card atrasado encontrado!</p>
            ) : (
              <ul>
                {atrasados.map((card) => (
                  <li key={card.id} style={{ marginBottom: '10px' }}>
                    <strong>{card.title}</strong>
                    <br />
                    <small>
                      Pipe: <em>{card.pipeName}</em> | Fase: <em>{card.phaseName}</em>
                    </small>
                    <br />
                    <small style={{ color: '#d9534f' }}>
                      Motivo: {card.reason}
                      {card.dueDate ? ` (Venceu em: ${new Date(card.dueDate).toLocaleDateString('pt-BR')})` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <Footer />
    </>
  )
}

export default App