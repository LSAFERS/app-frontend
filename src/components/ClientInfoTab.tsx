import { useState } from 'react'
import { api, type Client } from '../lib/api'

type Props = {
  client: Client
  onUpdated: (client: Client) => void
}

export function ClientInfoTab({ client, onUpdated }: Props) {
  const [form, setForm] = useState({
    name: client.name,
    spouse_name: client.spouse_name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await api.clients.update(client.id, {
        name: form.name,
        spouse_name: form.spouse_name || null,
        email: form.email || null,
        phone: form.phone || null,
      })
      onUpdated(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  const fields: { name: keyof typeof form; label: string; type?: string; required?: boolean }[] = [
    { name: 'name', label: 'Client Name', required: true },
    { name: 'spouse_name', label: 'Spouse Name' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel' },
  ]

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-4">
      {fields.map(({ name, label, type = 'text', required }) => (
        <div key={name}>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type={type}
            name={name}
            value={form[name]}
            onChange={handleChange}
            required={required}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-[#1B3D8F]/20 focus:border-[#1B3D8F]
                       placeholder:text-gray-300"
          />
        </div>
      ))}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-[#1B3D8F] text-white text-sm font-medium rounded-full
                     hover:bg-[#162f72] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>
        )}
      </div>
    </form>
  )
}
