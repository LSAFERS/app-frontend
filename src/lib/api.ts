import { supabase } from './supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No active session')
  return { Authorization: `Bearer ${session.access_token}` }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json as T
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Client = {
  id: string
  name: string
  spouse_name: string | null
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export type ScenarioData = {
  id: string | null
  inputs: Record<string, unknown>
  updated_at: string | null
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  clients: {
    list: () =>
      request<Client[]>('/clients'),

    get: (id: string) =>
      request<Client>(`/clients/${id}`),

    create: (body: Partial<Client>) =>
      request<Client>('/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    update: (id: string, body: Partial<Client>) =>
      request<Client>(`/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    delete: (id: string) =>
      request<{ ok: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
  },

  scenario: {
    get: (clientId: string) =>
      request<ScenarioData>(`/clients/${clientId}/scenario`),

    save: (clientId: string, inputs: Record<string, unknown>) =>
      request<ScenarioData>(`/clients/${clientId}/scenario`, {
        method: 'PUT',
        body: JSON.stringify({ inputs }),
      }),
  },
}
