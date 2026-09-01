import { useState, useEffect } from 'react'
import api from '../api'

interface FormResponse {
  [key: string]: string | undefined
}

export default function FormResponses() {
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [columns, setColumns] = useState<string[]>([])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('@wolfbyte:token')
    return token
      ? { Authorization: `Bearer ${token}` }
      : {}
  }

  const buscarRespostas = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/form-responses', {
        headers: getAuthHeaders()
      })

      const data: FormResponse[] = response.data.responses || []
      setResponses(data)

      // Extrair nomes das colunas do primeiro registro
      if (data.length > 0) {
        const keys = Object.keys(data[0]).filter((key) => data[0][key])
        setColumns(keys)
      }

      localStorage.setItem('@wolfbyte:formResponsesCache', JSON.stringify(data))
    } catch (err) {
      console.error('Erro ao buscar respostas do formulário:', err)
      setError('Erro ao buscar respostas do formulário')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem('@wolfbyte:formResponsesCache')
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setResponses(data)
        if (data.length > 0) {
          const keys = Object.keys(data[0]).filter((key) => data[0][key])
          setColumns(keys)
        }
      } catch {
        // Ignorar erro de parse
      }
    }
  }, [])

  return (
    <section className="panel">
      <h2>
        Respostas do Follow up
        <span className="panel-badge">(Total: {responses.length})</span>
      </h2>

      <button onClick={buscarRespostas} disabled={loading} style={{ marginBottom: '15px' }}>
        {loading ? 'Carregando...' : 'Buscar Respostas'}
      </button>

      {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}

      {responses.length === 0 ? (
        <p>Nenhuma resposta carregada. Clique em "Buscar Respostas" para carregar.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responses.map((response, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={`${index}-${column}`}>{response[column] || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
