const STATUS_STYLES = {
  auto_linked: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  linked: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  probable_match: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  needs_review: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  error: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  no_profile: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  unset: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
}

const STATUS_LABELS = {
  auto_linked: 'Connected',
  linked: 'Connected',
  probable_match: 'Probable match',
  needs_review: 'Needs review',
  error: 'Error',
  no_profile: 'No profile',
  unset: 'Not matched',
}

export function formatOplStatus(status) {
  if (!status) return 'unset'
  return status
}

export function getOplStatusLabel(status) {
  const key = formatOplStatus(status)
  return STATUS_LABELS[key] || String(status).replaceAll('_', ' ')
}

export function getOplFilterGroup(status) {
  const normalized = formatOplStatus(status)
  if (['auto_linked', 'linked', 'probable_match'].includes(normalized)) {
    return 'connected'
  }
  if (['needs_review', 'error'].includes(normalized)) {
    return 'other'
  }
  return 'no_connection'
}

export const OPL_FILTER_OPTIONS = [
  { id: 'all', label: 'All members' },
  { id: 'connected', label: 'Connected' },
  { id: 'no_connection', label: 'No connection' },
  { id: 'other', label: 'Other statuses' },
]

export function filterMembersByOplStatus(members, filterId) {
  if (filterId === 'all') return members
  return members.filter((member) => getOplFilterGroup(member.opl_match_status) === filterId)
}

export function countMembersByOplFilter(members) {
  const counts = { all: members.length, connected: 0, no_connection: 0, other: 0 }
  for (const member of members) {
    const group = getOplFilterGroup(member.opl_match_status)
    counts[group] += 1
  }
  return counts
}

export default function OplStatusPill({ status }) {
  const key = formatOplStatus(status)
  const style = STATUS_STYLES[key] || STATUS_STYLES.unset
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      {getOplStatusLabel(status)}
    </span>
  )
}
