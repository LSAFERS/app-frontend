import { useState } from 'react'
import { supabase } from '../lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

type UploadResult = {
  ok: true
  filename: string
  key: string
  downloadUrl: string
} | {
  error: string
  detail?: string
}

type Props = {
  onUploaded?: () => void
}

export function FileUpload({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null)
    setFile(e.target.files?.[0] ?? null)
  }

  async function handleUpload() {
    if (!file) return

    setLoading(true)
    setResult(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setResult({ error: 'No active session' })
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      const json = await res.json()
      setResult(json)
      if (json.ok) onUploaded?.()
    } catch (err) {
      setResult({ error: 'Upload failed — is the backend running?' })
      console.error(err)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">File Upload</h2>
        <p className="text-xs text-gray-400 mt-0.5">Upload any file — stored in R2, metadata saved in Supabase</p>
      </div>

      {/* File picker */}
      <div className="flex items-center gap-3">
        <label className="flex-1 cursor-pointer">
          <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-gray-300
                          rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 16v-8m0 0-3 3m3-3 3 3M6.75 19.5H17.25A2.25 2.25 0 0 0 19.5 17.25V9L15 4.5H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5A2.25 2.25 0 0 0 6.75 19.5Z" />
            </svg>
            <span className="text-sm text-gray-500 truncate">
              {file ? file.name : 'Choose a file…'}
            </span>
          </div>
          <input
            type="file"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="shrink-0 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* Result */}
      {result && (
        'error' in result ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {result.error}{result.detail ? `: ${result.detail}` : ''}
          </div>
        ) : (
          <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-2">
            <p className="font-medium text-green-800">Upload successful</p>
            <p className="text-green-700 text-xs">
              <span className="font-medium">File:</span> {result.filename}
            </p>
            <a
              href={`${BACKEND_URL}${result.downloadUrl}`}
              download={result.filename}
              className="inline-block text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Download {result.filename}
            </a>
          </div>
        )
      )}
    </div>
  )
}
