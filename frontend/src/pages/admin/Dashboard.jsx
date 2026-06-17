import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import Loading from '../../components/shared/Loading'
import LinkOplModal from '../../components/admin/LinkOplModal'
import ImportCsvPanel from '../../components/admin/ImportCsvPanel'
import OplStatusPill from '../../components/admin/OplStatusPill'
import { adminApi } from '../../services/adminApi'

function formatStatus(status) {
  return String(status || 'unknown').replaceAll('_', ' ')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-100">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [attentionMembers, setAttentionMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncSummary, setSyncSummary] = useState(null)
  const [linkMember, setLinkMember] = useState(null)
  const [rowActionId, setRowActionId] = useState(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [statsData, attentionData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getAttentionMembers(),
      ])
      setStats(statsData)
      setAttentionMembers(attentionData.members || [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  async function handleSyncAll() {
    setSyncing(true)
    setSyncSummary(null)
    try {
      const summary = await adminApi.syncAll()
      setSyncSummary(summary)
      await loadDashboard()
    } catch (err) {
      setSyncSummary({ error: err.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleRetry(memberId) {
    setRowActionId(memberId)
    try {
      await adminApi.retryMember(memberId)
      await loadDashboard()
    } finally {
      setRowActionId(null)
    }
  }

  if (loading) {
    return <Loading label="Loading dashboard..." />
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        {loadError}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Import members, trigger syncs, and review matching status"
      />

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={stats.total_members} />
        <StatCard label="OPL linked" value={stats.opl_linked} />
        <StatCard label="Needs review" value={stats.needs_review} />
        <StatCard label="No profile" value={stats.no_profile} />
      </section>

      <ImportCsvPanel onImported={loadDashboard} />

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-100">Members needing attention</h2>
          <p className="mt-1 text-sm text-slate-400">
            Review ambiguous matches, confirm probable links, and retry failed syncs.
          </p>
        </div>

        {attentionMembers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400">No members need attention right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Last sync attempt</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attentionMembers.map((member) => (
                  <tr key={member.id} className="border-b border-slate-800/80 last:border-b-0">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100">
                        {member.first_name} {member.last_name}
                      </p>
                      {member.opl_username ? (
                        <p className="text-xs text-slate-500">@{member.opl_username}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <OplStatusPill status={member.opl_match_status} />
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <p>{formatDate(member.last_sync?.run_at)}</p>
                      {member.last_sync?.status ? (
                        <p className="text-xs text-slate-500">{formatStatus(member.last_sync.status)}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setLinkMember(member)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          Link OPL
                        </button>
                        {member.opl_match_status === 'error' ? (
                          <button
                            type="button"
                            disabled={rowActionId === member.id}
                            onClick={() => handleRetry(member.id)}
                            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                          >
                            {rowActionId === member.id ? 'Retrying...' : 'Retry'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Gym PR entry</h2>
        <p className="mt-1 text-sm text-slate-400">
          Log in-gym squat, bench, deadlift, and total PRs for the weight-class board. Gym records
          do not count toward DOTS leaderboards.
        </p>
        <Link
          to="/admin/gym-prs"
          className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Enter gym PRs
        </Link>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Sync controls</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pull the latest meet results from OpenPowerlifting for all linked members.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Syncing...
              </>
            ) : (
              'Sync all members now'
            )}
          </button>

          <Link
            to="/admin/sync-log"
            className="text-sm text-violet-300 hover:text-violet-200"
          >
            View full sync log
          </Link>
        </div>

        {syncSummary ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            {syncSummary.error ? (
              <p className="text-rose-300">{syncSummary.error}</p>
            ) : (
              <p>
                Synced {syncSummary.members_synced} of {syncSummary.total} members. Updated PRs for{' '}
                {syncSummary.prs_updated}. Errors: {syncSummary.errors}.
              </p>
            )}
          </div>
        ) : null}
      </section>

      {linkMember ? (
        <LinkOplModal
          member={linkMember}
          onClose={() => setLinkMember(null)}
          onResolved={loadDashboard}
        />
      ) : null}
    </div>
  )
}
