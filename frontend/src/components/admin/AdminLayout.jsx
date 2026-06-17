import { Link, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/members', label: 'Members' },
  { to: '/admin/gym-prs', label: 'Gym PRs' },
  { to: '/admin/sync-log', label: 'Sync Log' },
]

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="w-48 shrink-0">
          <p className="mb-4 text-xs uppercase tracking-wider text-slate-500">Admin</p>
          <nav className="space-y-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
