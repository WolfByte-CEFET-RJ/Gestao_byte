import { useState } from 'react'
import api from '../api'

interface FormResponse {
  [key: string]: string | undefined
}

const responseColumns = ['Carimbo de data/hora', 'Equipe do Follow Up']

const getCachedResponses = (): FormResponse[] => {
  const cached = localStorage.getItem('@wolfbyte:formResponsesCache')
  if (!cached) return []

  try {
    const data: unknown = JSON.parse(cached)
    if (!Array.isArray(data)) return []

    return data.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) return {}
      const response = item as FormResponse
      return {
        'Carimbo de data/hora': response['Carimbo de data/hora'],
        'Equipe do Follow Up': response['Equipe do Follow Up']
      }
    })
  } catch {
    return []
  }
}

const keepResponseColumns = (data: FormResponse[]): FormResponse[] =>
  data.map((response) => ({
    'Carimbo de data/hora': response['Carimbo de data/hora'],
    'Equipe do Follow Up': response['Equipe do Follow Up']
  }))

export default function FormResponses() {
  const [responses, setResponses] = useState<FormResponse[]>(getCachedResponses)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

      localStorage.setItem('@wolfbyte:formResponsesCache', JSON.stringify(data))
    } catch (err) {
      console.error('Erro ao buscar respostas do formulário:', err)
      setError('Erro ao buscar respostas do formulário')
    } finally {
      setLoading(false)
    }
  }

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
                  {responseColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.map((response, index) => (
                  <tr key={index}>
                    {responseColumns.map((column) => (
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
