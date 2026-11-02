import { useState, useEffect } from 'react'
import api from '../api'

interface FormResponse {
  [key: string]: string | undefined
}

const responseColumns = ['Carimbo de data/hora', 'Equipe do Follow Up']

const keepResponseColumns = (data: FormResponse[]): FormResponse[] =>
  data.map((response) => ({
    'Carimbo de data/hora': response['Carimbo de data/hora'],
    'Equipe do Follow Up': response['Equipe do Follow Up']
  }))

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

      const data = keepResponseColumns(response.data.responses || [])
      setResponses(data)
      setColumns(responseColumns)

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
        const data = keepResponseColumns(JSON.parse(cached))
        setResponses(data)
        setColumns(responseColumns)
        localStorage.setItem('@wolfbyte:formResponsesCache', JSON.stringify(data))
      } catch {
        // Ignorar erro de parse
      }
    }
  }, [])

  return (
    <details className="panel form-responses-panel">
      <summary className="follow-up-toggle">
        <h2>
          Respostas do Follow up
          <span className="panel-badge">(Total: {responses.length})</span>
        </h2>
        <span className="follow-up-chevron" aria-hidden="true" />
      </summary>

      <div className="form-responses-content">
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
      </div>
    </details>
  )
}
