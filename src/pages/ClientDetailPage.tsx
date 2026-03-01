import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Client } from '../lib/api'
import { ClientInfoTab } from '../components/ClientInfoTab'
import { ScenarioInputsTab } from '../components/ScenarioInputsTab'
import { ScenarioPreviewTab } from '../components/ScenarioPreviewTab'

type Tab = 'info' | 'inputs' | 'preview'

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    loadClient(id)
  }, [id])

  async function loadClient(clientId: string) {
    setLoading(true)
    setError(null)
    try {
      setClient(await api.clients.get(clientId))
    } catch {
      setError('Client not found')
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    try {
      await api.clients.delete(id)
      navigate('/clients')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading…</p>
  }

  if (error || !client) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        {error ?? 'Unknown error'}
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Client Info' },
    { key: 'inputs', label: 'Scenario Inputs' },
    { key: 'preview', label: 'Retirement Preview' },
  ]

  return (
    <div className="max-w-4xl">

      {/* Back link */}
      <button
        onClick={() => navigate('/clients')}
        className="text-xs text-slate-400 hover:text-slate-600 mb-4 block transition-colors"
      >
        ← Back to Clients
      </button>

      {/* Client header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3D8F]">{client.name}</h1>
          {client.spouse_name && (
            <p className="text-sm text-slate-500 mt-0.5">Spouse: {client.spouse_name}</p>
          )}
        </div>

        {/* Delete — inline confirm */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Delete client
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <span className="text-xs text-red-700">Delete this client and all their data?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-[#CC2229] text-[#1B3D8F] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <ClientInfoTab client={client} onUpdated={(updated) => setClient(updated)} />
      )}
      {activeTab === 'inputs' && (
        <ScenarioInputsTab
          clientId={client.id}
          onGoToPreview={() => setActiveTab('preview')}
        />
      )}
      {activeTab === 'preview' && (
        <ScenarioPreviewTab
          client={client}
          onGoToInputs={() => setActiveTab('inputs')}
        />
      )}
    </div>
  )
}
