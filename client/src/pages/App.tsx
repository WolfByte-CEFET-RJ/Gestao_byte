import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './App.css'

import api from '../api'
import FormResponses from '../components/FormResponses'

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
  labels?: string[];
}

const categoryOptions = ['ALL', 'WEB', 'GAMES', 'HARDWARE', 'IA', 'PUBLICIDADE'] as const

type Category = (typeof categoryOptions)[number]

const categoryKeywords: Record<Category, string[]> = {
  ALL: [],
  WEB: ['web', 'website', 'site', 'front-end', 'frontend', 'app'],
  GAMES: ['game', 'games', 'gaming', 'jogo', 'jogos'],
  HARDWARE: ['hardware', 'device', 'board', 'equipamento', 'dispositivo'],
  IA: ['ia', 'ai', 'inteligencia', 'inteligência', 'machine learning', 'aprendizado'],
  PUBLICIDADE: ['publicidade', 'ad', 'ads', 'marketing', 'propaganda', 'anuncio', 'anúncio']
}

const categoryDisplay: Record<string, string> = {
  ALL: 'Todos',
  WEB: 'Web',
  GAMES: 'Games',
  HARDWARE: 'Hardware',
  IA: 'IA',
  PUBLICIDADE: 'Publicidade'
}

const parseStorage = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function App() {
  const [pipes, setPipes] = useState<Pipe[]>(() => parseStorage<Pipe[]>('@wolfbyte:pipesCache', []))
  const [atrasados, setAtrasados] = useState<LateCard[]>(() => parseStorage<LateCard[]>('@wolfbyte:latecardsCache', []))
  const [totalAtrasados, setTotalAtrasados] = useState<number | null>(() => {
    const raw = localStorage.getItem('@wolfbyte:totalAtrasados')
    return raw !== null ? Number(raw) : null
  })
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const raw = localStorage.getItem('@wolfbyte:currentPage')
    return raw !== null ? Number(raw) : 1
  })
  const [totalPages, setTotalPages] = useState<number>(() => {
    const raw = localStorage.getItem('@wolfbyte:totalPages')
    return raw !== null ? Number(raw) : 1
  })
  const [pageSize] = useState(10)
  const [selectedCategory, setSelectedCategory] = useState<Category>(() => {
    const saved = localStorage.getItem('@wolfbyte:dashboardCategory') as Category | null
    return saved && categoryOptions.includes(saved) ? saved : 'ALL'
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getAuthHeaders = () => {
    const token = localStorage.getItem('@wolfbyte:token')
    return token
      ? { Authorization: `Bearer ${token}` }
      : {}
  }

  const persistCategory = (category: Category) => {
    setSelectedCategory(category)
    localStorage.setItem('@wolfbyte:dashboardCategory', category)
  }

  const matchesCategory = (text: string, category: Category) => {
    if (category === 'ALL') return true
    const normalized = text.toLowerCase()
    return categoryKeywords[category].some((keyword) => normalized.includes(keyword))
  }

  const filterPipe = (pipe: Pipe) => {
    if (selectedCategory === 'ALL') return true
    return matchesCategory(pipe.name, selectedCategory)
  }

  const filterCard = (card: LateCard) => {
    if (selectedCategory === 'ALL') return true

    return (
      matchesCategory(card.title, selectedCategory) ||
      matchesCategory(card.pipeName, selectedCategory) ||
      matchesCategory(card.phaseName, selectedCategory) ||
      matchesCategory(card.reason, selectedCategory)
    )
  }

  const filteredPipes = pipes.filter(filterPipe)
  const filteredAtrasados = atrasados.filter(filterCard)

  // calcular dados do gráfico por tag (NÃO afetado pelo filtro visual)
  const tagCounts: Record<string, number> = {}
  // aglomera por label normalizada (case-insensitive), preservando a primeira forma para exibição
  const nameMap: Record<string, string> = {}
  atrasados.forEach((card) => {
    const raw = card.labels && card.labels.length ? card.labels : []
    const labels = raw
      .map((l) => {
        if (!l) return ''
        if (typeof l === 'string') return l
        if (typeof l === 'object' && 'name' in l) return String((l as any).name)
        return ''
      })
      .map((s) => s.trim())
      .filter(Boolean)

    if (labels.length === 0) {
      const key = 'sem tag'
      nameMap[key] = nameMap[key] || 'Sem tag'
      tagCounts[key] = (tagCounts[key] || 0) + 1
    } else {
      labels.forEach((lbl) => {
        const key = lbl.toLowerCase()
        if (!nameMap[key]) nameMap[key] = lbl
        tagCounts[key] = (tagCounts[key] || 0) + 1
      })
    }
  })


  const buscarPipes = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/pipes', {
        headers: getAuthHeaders()
      })

      const fetchedPipes: Pipe[] = response.data.pipes || []
      setPipes(fetchedPipes)
      localStorage.setItem('@wolfbyte:pipesCache', JSON.stringify(fetchedPipes))
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
      
      const fetchedCards: LateCard[] = response.data.cards || []
      const pageNumber = response.data.page ?? page
      const pages = response.data.totalPages ?? 1
      const total = response.data.totalLateCards ?? 0

      setTotalAtrasados(total)
      setCurrentPage(pageNumber)
      setTotalPages(pages)
      setAtrasados(fetchedCards)

      localStorage.setItem('@wolfbyte:latecardsCache', JSON.stringify(fetchedCards))
      localStorage.setItem('@wolfbyte:totalAtrasados', String(total))
      localStorage.setItem('@wolfbyte:currentPage', String(pageNumber))
      localStorage.setItem('@wolfbyte:totalPages', String(pages))
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

        <div className="dashboard-filters">
          <span>Filtro:</span>
          {categoryOptions.map((category) => (
            <button
              key={category}
              className={`filter-button ${selectedCategory === category ? 'active' : ''}`}
              type="button"
              onClick={() => persistCategory(category)}
              disabled={loading}
            >
              {categoryDisplay[category] || category}
            </button>
          ))}
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <FormResponses />

        <div className="dashboard-grid">
          <section className="panel">
            <h2>Pipes da Organização</h2>
            {pipes.length === 0 ? (
              <p>Nenhum pipe carregado. Clique em "Buscar pipes" para carregar.</p>
            ) : filteredPipes.length === 0 ? (
              <p>Nenhum pipe encontrado para a categoria selecionada.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome do Pipe</th>
                    <th>Cards abertos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPipes.map((pipe) => (
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
            ) : filteredAtrasados.length === 0 ? (
              <p>Nenhum card atrasado encontrado para a categoria selecionada.</p>
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
                    {filteredAtrasados.map((card) => (
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