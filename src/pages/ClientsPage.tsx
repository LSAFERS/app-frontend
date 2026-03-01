import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Client } from '../lib/api'

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    setLoading(true)
    setError(null)
    try {
      setClients(await api.clients.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients')
    }
    setLoading(false)
  }

  async function handleNewClient() {
    setCreating(true)
    try {
      const client = await api.clients.create({ name: 'New Client' })
      navigate(`/clients/${client.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl">

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1B3D8F]">Clients</h1>
        <button
          onClick={handleNewClient}
          disabled={creating}
          className="px-4 py-2 bg-[#1B3D8F] text-white text-sm font-medium rounded-full
                     hover:bg-[#162f72] disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : '+ New Client'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Loading…</p>
      )}

      {!loading && clients.length === 0 && (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-sm">No clients yet.</p>
          <p className="text-xs mt-1">Click &ldquo;+ New Client&rdquo; to get started.</p>
        </div>
      )}

      {!loading && clients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Client Name
                </th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Spouse
                </th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Last Updated
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-900">{client.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{client.spouse_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {new Date(client.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-[#1B3D8F] text-xs font-semibold hover:underline">Open →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
