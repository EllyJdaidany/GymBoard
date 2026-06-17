import WeightDisplay from '../shared/WeightDisplay'
import VerificationBadge from '../shared/VerificationBadge'
import { isGymOnlyMember } from './boardUtils'

const LIFT_LABELS = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
  total: 'Total',
}

export default function LiftCell({ lift, entry, member, showGymOnly }) {
  const gymOnly = showGymOnly ?? isGymOnlyMember(member)
  const meetVerified = !gymOnly && entry?.is_meet_verified

  return (
    <div className="rounded-lg bg-catalyst-base px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-catalyst-text/50">
        {LIFT_LABELS[lift]}
      </p>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <div className="shrink-0">
          <WeightDisplay
            kg={entry?.weight_kg}
            valueClassName="text-lg font-semibold text-catalyst-text"
            unitClassName="text-sm text-catalyst-text/80"
          />
        </div>
        {entry ? <VerificationBadge meetVerified={meetVerified} /> : null}
      </div>
    </div>
  )
}
