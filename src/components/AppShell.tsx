import type { Session } from '@supabase/supabase-js'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Props = {
  session: Session
  children: React.ReactNode
}

export function AppShell({ session, children }: Props) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col">

      {/* Header — white brand bar matching STWS */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/stwserve_logo.png" alt="STWS logo" className="h-10 w-auto" />
          <span className="text-gray-300 text-lg font-light mx-1">|</span>
          <span className="text-gray-500 text-sm font-medium">
            Federal Retirement Preview
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">{session.user.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600
                       hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <nav className="w-52 bg-white border-r border-gray-200 flex flex-col py-5 shrink-0">
          <p className="px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Menu
          </p>
          <NavLink
            to="/clients"
            className={({ isActive }) =>
              `mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#EEF2FF] text-[#1B3D8F] font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            Clients
          </NavLink>
          {/* Settings — v2 */}
          <span className="mx-2 px-3 py-2.5 text-sm font-medium text-gray-300 cursor-not-allowed">
            Settings
          </span>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto px-8 py-8">
          {children}
        </main>

      </div>
    </div>
  )
}
