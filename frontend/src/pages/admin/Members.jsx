import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Loading from '../../components/shared/Loading'
import LinkOplModal from '../../components/admin/LinkOplModal'
import AddMemberModal from '../../components/admin/AddMemberModal'
import AddGymPrModal from '../../components/admin/AddGymPrModal'
import OplStatusPill, {
  OPL_FILTER_OPTIONS,
  filterMembersByOplStatus,
  countMembersByOplFilter,
} from '../../components/admin/OplStatusPill'
import { adminApi } from '../../services/adminApi'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export default function Members() {
  const [allMembers, setAllMembers] = useState([])
  const [counts, setCounts] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [linkMember, setLinkMember] = useState(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddGymPrs, setShowAddGymPrs] = useState(false)
  const [editGymMember, setEditGymMember] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await adminApi.getMembers('all')
      setAllMembers(data.members || [])
      setCounts(data.counts || null)
    } catch (err) {
      setLoadError(err.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const filteredMembers = useMemo(() => {
    let members = filterMembersByOplStatus(allMembers, activeFilter)
    const query = searchQuery.trim().toLowerCase()
    if (!query) return members

    return members.filter((member) => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase()
      const email = (member.email || '').toLowerCase()
      const username = (member.opl_username || '').toLowerCase()
      return fullName.includes(query) || email.includes(query) || username.includes(query)
    })
  }, [allMembers, activeFilter, searchQuery])

  const displayCounts = useMemo(() => {
    if (counts) return counts
    return countMembersByOplFilter(allMembers)
  }, [counts, allMembers])

  if (loading) {
    return <Loading label="Loading members..." />
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
        title="Members"
        subtitle="All Catalyst members and their OpenPowerlifting profile status"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAddGymPrs(true)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Add gym PRs
            </button>
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Add member
            </button>
          </div>
        }
      />

      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {OPL_FILTER_OPTIONS.map((option) => {
            const count = displayCounts[option.id] ?? 0
            const isActive = activeFilter === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {option.label}
                <span className={`ml-2 ${isActive ? 'text-violet-200' : 'text-slate-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name, email, or OPL username"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 sm:max-w-xs"
        />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {activeFilter === 'connected'
              ? 'Members with a linked or probable OPL profile.'
              : activeFilter === 'no_connection'
                ? 'Members with no OPL match yet.'
                : activeFilter === 'other'
                  ? 'Members needing review or with sync errors.'
                  : 'Full member roster from Catalyst.'}
          </p>
        </div>

        {filteredMembers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400">No members match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">OPL status</th>
                  <th className="px-6 py-3 font-medium">OPL profile</th>
                  <th className="px-6 py-3 font-medium">Linked</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="border-b border-slate-800/80 last:border-b-0">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100">
                        {member.first_name} {member.last_name}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{member.email || '—'}</td>
                    <td className="px-6 py-4">
                      <OplStatusPill status={member.opl_match_status} />
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {member.opl_username ? `@${member.opl_username}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {formatDate(member.opl_linked_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditGymMember(member)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          Gym PRs
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkMember(member)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          Link OPL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAddMember ? (
        <AddMemberModal
          onClose={() => setShowAddMember(false)}
          onCreated={loadMembers}
        />
      ) : null}

      {showAddGymPrs ? (
        <AddGymPrModal
          onClose={() => setShowAddGymPrs(false)}
          onCreated={loadMembers}
        />
      ) : null}

      {editGymMember ? (
        <AddGymPrModal
          editMember={editGymMember}
          onClose={() => setEditGymMember(null)}
          onCreated={loadMembers}
        />
      ) : null}

      {linkMember ? (
        <LinkOplModal
          member={linkMember}
          onClose={() => setLinkMember(null)}
          onResolved={loadMembers}
        />
      ) : null}
    </div>
  )
}
