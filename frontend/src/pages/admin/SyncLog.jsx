import { useEffect, useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Loading from '../../components/shared/Loading'
import { adminApi } from '../../services/adminApi'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export default function SyncLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await adminApi.getSyncLog()
        if (!cancelled) setEntries(data.entries || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load sync log')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Loading label="Loading sync log..." />

  return (
    <div>
      <PageHeader title="Sync Log" subtitle="OPL sync and matching history" />

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">When</th>
                <th className="px-6 py-3 font-medium">Member</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Results</th>
                <th className="px-6 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-800/80 last:border-b-0">
                  <td className="px-6 py-4 text-slate-300">{formatDate(entry.run_at)}</td>
                  <td className="px-6 py-4 text-slate-100">{entry.member_name || entry.member_id}</td>
                  <td className="px-6 py-4 text-slate-300">{entry.status}</td>
                  <td className="px-6 py-4 text-slate-300">{entry.results_added}</td>
                  <td className="px-6 py-4 text-slate-400">
                    {entry.error_message ? (
                      <span className="line-clamp-2">{entry.error_message}</span>
                    ) : (
                      '—'
                    )}
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
