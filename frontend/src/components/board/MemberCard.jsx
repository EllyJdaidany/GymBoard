import LiftCell from './LiftCell'
import {
  formatDate,
  getEquipmentIndicator,
  getMemberLifts,
  getMostRecentMeet,
  isOplLinked,
} from './boardUtils'

export default function MemberCard({ memberEntry }) {
  const { member } = memberEntry
  const { equipment, lifts } = getMemberLifts(memberEntry)
  const equipmentLabel = getEquipmentIndicator(equipment)
  const recentMeet = isOplLinked(member) ? getMostRecentMeet(memberEntry) : null

  const weightClass = member.weight_class ?? '—'
  const division = member.division ?? '—'

  return (
    <article className="flex flex-col rounded-xl border border-catalyst-text/10 bg-catalyst-surface p-5">
      <header className="mb-4 border-b border-catalyst-text/10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-catalyst-text">
            {member.first_name} {member.last_name}
          </h2>
          <span
            className={[
              'font-pirulen shrink-0 rounded px-1.5 py-px text-[10px] tracking-wider',
              equipmentLabel === 'EQ'
                ? 'bg-catalyst-accent text-catalyst-text'
                : 'bg-catalyst-base text-catalyst-accent',
            ].join(' ')}
          >
            {equipmentLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-catalyst-text/60">
          {weightClass} · {division}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <LiftCell lift="squat" entry={lifts.squat} member={member} />
        <LiftCell lift="bench" entry={lifts.bench} member={member} />
        <LiftCell lift="deadlift" entry={lifts.deadlift} member={member} />
        <LiftCell lift="total" entry={lifts.total} member={member} />
      </div>

      {recentMeet ? (
        <footer className="mt-4 border-t border-catalyst-text/10 pt-3 text-sm text-catalyst-text/80">
          <p className="truncate font-medium">{recentMeet.meetName}</p>
          <p className="text-catalyst-text/60">{formatDate(recentMeet.date)}</p>
        </footer>
      ) : null}
    </article>
  )
}
