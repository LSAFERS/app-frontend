import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

type FileRecord = {
  id: string
  filename: string
  r2_key: string
  size_bytes: number
  mime_type: string
  uploaded_at: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  session: Session
  refreshTrigger: number
}

export function FileList({ session, refreshTrigger }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFiles() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('file_uploads')
        .select('id, filename, r2_key, size_bytes, mime_type, uploaded_at')
        .eq('user_id', session.user.id)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch files:', error)
        setError('Could not load files')
      } else {
        setFiles(data ?? [])
      }

      setLoading(false)
    }

    fetchFiles()
  }, [session.user.id, refreshTrigger])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Your Files</h2>
        <p className="text-xs text-gray-400 mt-0.5">Files you've uploaded — click to download</p>
      </div>

      {loading && (
        <p className="text-sm text-gray-400 py-2">Loading…</p>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No files uploaded yet.</p>
      )}

      {!loading && files.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 truncate font-medium">{file.filename}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatBytes(file.size_bytes)} · {file.mime_type} · {new Date(file.uploaded_at).toLocaleString()}
                </p>
              </div>
              <a
                href={`${BACKEND_URL}/download/${file.r2_key}`}
                download={file.filename}
                className="ml-4 shrink-0 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
