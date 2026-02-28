import { useState } from 'react'
import { supabase } from '../lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

type Result =
  | { ok: true; user: { id: string; email: string } }
  | { error: string }

export function ProtectedCall() {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  async function callProtected() {
    setLoading(true)
    setResult(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setResult({ error: 'No active session' })
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${BACKEND_URL}/protected`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setResult(json)
    } catch (err) {
      setResult({ error: 'Request failed — is the backend running?' })
      console.error(err)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Protected Backend Call</h2>
          <p className="text-xs text-gray-400 mt-0.5">Sends your JWT to /protected and shows the response</p>
        </div>
        <button
          onClick={callProtected}
          disabled={loading}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Calling…' : 'Call /protected'}
        </button>
      </div>

      {result && (
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-gray-700">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
